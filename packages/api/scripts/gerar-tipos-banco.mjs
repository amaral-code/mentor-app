#!/usr/bin/env node
/**
 * Gera packages/api/src/database.types.ts a partir das MIGRATIONS.
 *
 *   npm run gen:types   --workspace @mentor/api   # regrava o arquivo
 *   npm run check:types --workspace @mentor/api   # falha se estiver desatualizado (CI)
 *
 * Por que não `supabase gen types`: ele precisa de Docker ou do token de
 * acesso ao projeto, e lê o banco publicado, que pode estar atrás (ou à
 * frente) do repositório. Aqui a fonte é o próprio SQL versionado,
 * aplicado no mesmo Postgres em memória (PGlite) que os testes de
 * migration usam. Migration nova sem tipo atualizado quebra o CI.
 *
 * A saída segue o formato do `supabase gen types typescript`, então
 * `createClient<Database>()` funciona igual quando a equipe quiser
 * tipar o cliente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarBancoComMigracoes } from '../../../supabase/bancoLocal.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(AQUI, '..', 'src', 'database.types.ts');
const VERIFICAR = process.argv.includes('--check');

const db = await criarBancoComMigracoes();
const q = async (sql) => (await db.query(sql)).rows;

// ------------------------------------------------------------------ enums
const enums = await q(`
  select t.typname as nome, e.enumlabel as valor
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
   order by t.typname, e.enumsortorder`);
const ENUMS = new Map();
for (const { nome, valor } of enums) {
  if (!ENUMS.has(nome)) ENUMS.set(nome, []);
  ENUMS.get(nome).push(valor);
}

// --------------------------------------------------------- tipo PG -> TS
const NUMERO = new Set(['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid']);
const TEXTO = new Set([
  'text', 'varchar', 'bpchar', 'char', 'name', 'uuid', 'citext', 'date', 'time', 'timetz',
  'timestamp', 'timestamptz', 'interval', 'inet', 'cidr', 'macaddr', 'bytea', 'tsvector', 'money',
  'tstzrange', 'tsrange', 'daterange', 'int4range', 'int8range', 'numrange',
]);

function tipoTs(udt) {
  if (udt.startsWith('_')) {
    const base = tipoTs(udt.slice(1));
    return base.includes(' ') ? `(${base})[]` : `${base}[]`;
  }
  if (udt === 'bool') return 'boolean';
  if (NUMERO.has(udt)) return 'number';
  if (TEXTO.has(udt)) return 'string';
  if (udt === 'json' || udt === 'jsonb') return 'Json';
  if (ENUMS.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  if (udt === 'void') return 'undefined';
  return 'unknown';
}

// ----------------------------------------------------- tabelas e views
const colunas = await q(`
  select c.table_name as tabela, t.table_type as tipo, c.column_name as coluna,
         c.udt_name as udt, c.is_nullable = 'YES' as anulavel,
         c.column_default is not null as tem_padrao,
         c.is_identity = 'YES' as identidade,
         c.is_generated = 'ALWAYS' as gerada
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public'
   order by c.table_name, c.ordinal_position`);

const TABELAS = new Map();
const VIEWS = new Map();
for (const c of colunas) {
  const alvo = c.tipo === 'VIEW' ? VIEWS : TABELAS;
  if (!alvo.has(c.tabela)) alvo.set(c.tabela, []);
  alvo.get(c.tabela).push(c);
}

// ------------------------------------------------------------ funcoes
const funcoes = await q(`
  select p.proname as nome,
         p.oid::regprocedure::text as assinatura,
         coalesce(p.proargnames, '{}') as nomes,
         coalesce(p.proallargtypes, p.proargtypes::oid[]) as tipos,
         coalesce(p.proargmodes, '{}') as modos,
         p.pronargs as n_entrada,
         p.pronargdefaults as n_padrao,
         rt.typname as retorno,
         p.proretset as conjunto
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
   where n.nspname = 'public'
     and p.prokind = 'f'
     and rt.typname not in ('trigger', 'event_trigger')
     -- Funcoes internas de extensoes (btree_gist cria ~200 em public).
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
   order by p.proname, p.oid::regprocedure::text`);

const nomesTipo = new Map(
  (await q(`select oid::int as oid, typname from pg_type`)).map((r) => [Number(r.oid), r.typname]),
);
const comoArray = (v) => (Array.isArray(v) ? v : String(v).replace(/[{}]/g, '').split(',').filter(Boolean));

function descreverFuncao(f) {
  const nomes = comoArray(f.nomes);
  const tipos = comoArray(f.tipos).map((o) => nomesTipo.get(Number(o)) ?? 'unknown');
  const modos = comoArray(f.modos);
  const entrada = [];
  const saida = [];
  tipos.forEach((t, i) => {
    const modo = modos[i] ?? 'i';
    const nome = nomes[i] || `arg${i}`;
    if (modo === 'i' || modo === 'b' || modo === 'v') entrada.push({ nome, tipo: tipoTs(t) });
    if (modo === 'o' || modo === 'b' || modo === 't') saida.push({ nome, tipo: tipoTs(t) });
  });
  // Os ultimos `n_padrao` argumentos de entrada tem DEFAULT: opcionais.
  const primeiroOpcional = entrada.length - Number(f.n_padrao || 0);
  const args = entrada.length
    ? `{\n${entrada
        .map((a, i) => `          ${chave(a.nome)}${i >= primeiroOpcional ? '?' : ''}: ${a.tipo}`)
        .join('\n')}\n        }`
    : 'Record<PropertyKey, never>';
  let retorno;
  if (saida.length) {
    retorno = `{\n${saida.map((s) => `          ${chave(s.nome)}: ${s.tipo}`).join('\n')}\n        }`;
  } else if (f.retorno === 'record') {
    retorno = 'Record<string, unknown>';
  } else if (TABELAS.has(f.retorno) || VIEWS.has(f.retorno)) {
    const grupo = TABELAS.has(f.retorno) ? 'Tables' : 'Views';
    retorno = `Database["public"]["${grupo}"]["${f.retorno}"]["Row"]`;
  } else {
    retorno = tipoTs(f.retorno);
  }
  if (f.conjunto) retorno = retorno.includes('\n') ? `${retorno}[]` : `(${retorno})[]`;
  return { args, retorno };
}

// ------------------------------------------------------------ escrita
const chave = (n) => (/^[A-Za-z_$][\w$]*$/.test(n) ? n : JSON.stringify(n));
const ind = (n) => ' '.repeat(n);

function blocoColunas(cols, modo) {
  return cols
    .map((c) => {
      let t = tipoTs(c.udt);
      if (c.anulavel) t += ' | null';
      if (modo === 'Row') return `${ind(10)}${chave(c.coluna)}: ${t}`;
      if (c.gerada) return `${ind(10)}${chave(c.coluna)}?: never`;
      const opcional = modo === 'Update' || c.anulavel || c.tem_padrao || c.identidade;
      return `${ind(10)}${chave(c.coluna)}${opcional ? '?' : ''}: ${t}`;
    })
    .join('\n');
}

const tabelasTs = [...TABELAS]
  .map(
    ([nome, cols]) => `      ${chave(nome)}: {
        Row: {
${blocoColunas(cols, 'Row')}
        }
        Insert: {
${blocoColunas(cols, 'Insert')}
        }
        Update: {
${blocoColunas(cols, 'Update')}
        }
        Relationships: []
      }`,
  )
  .join('\n');

const viewsTs = [...VIEWS]
  .map(
    ([nome, cols]) => `      ${chave(nome)}: {
        Row: {
${blocoColunas(cols, 'Row')}
        }
        Relationships: []
      }`,
  )
  .join('\n');

// Funcoes sobrecarregadas viram uniao, como no gerador oficial.
const porNome = new Map();
for (const f of funcoes) {
  if (!porNome.has(f.nome)) porNome.set(f.nome, []);
  porNome.get(f.nome).push(descreverFuncao(f));
}
const funcoesTs = [...porNome]
  .map(([nome, versoes]) => {
    const corpo = versoes
      .map((v) => `{\n        Args: ${v.args}\n        Returns: ${v.retorno}\n      }`)
      .join(' | ');
    return `      ${chave(nome)}: ${corpo}`;
  })
  .join('\n');

const enumsTs = [...ENUMS]
  .map(([nome, valores]) => `      ${chave(nome)}: ${valores.map((v) => JSON.stringify(v)).join(' | ')}`)
  .join('\n');

const vazio = '      [_ in never]: never';

const saida = `/*
 * ARQUIVO GERADO. Não edite à mão.
 * Fonte: supabase/migrations (aplicadas no PGlite por supabase/bancoLocal.mjs).
 * Regerar: npm run gen:types --workspace @mentor/api
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${tabelasTs || vazio}
    }
    Views: {
${viewsTs || vazio}
    }
    Functions: {
${funcoesTs || vazio}
    }
    Enums: {
${enumsTs || vazio}
    }
    CompositeTypes: {
${vazio}
    }
  }
}

type Publico = Database["public"]

/** Linha de uma tabela ou view: \`Tables<'perfis'>\`. */
export type Tables<T extends keyof Publico["Tables"] | keyof Publico["Views"]> =
  T extends keyof Publico["Tables"]
    ? Publico["Tables"][T]["Row"]
    : T extends keyof Publico["Views"]
      ? Publico["Views"][T]["Row"]
      : never

/** O que um insert aceita: \`TablesInsert<'perfis'>\`. */
export type TablesInsert<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Insert"]

/** O que um update aceita: \`TablesUpdate<'perfis'>\`. */
export type TablesUpdate<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Update"]

/** Valores de um enum do banco: \`Enums<'papel_usuario'>\`. */
export type Enums<T extends keyof Publico["Enums"]> = Publico["Enums"][T]

/** Argumentos e retorno de uma função (RPC): \`Rpc<'vincular_por_codigo'>\`. */
export type Rpc<T extends keyof Publico["Functions"]> = Publico["Functions"][T]
`;

await db.close();

const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8').replace(/\r\n/g, '\n') : '';
if (VERIFICAR) {
  if (atual !== saida) {
    console.error(
      'packages/api/src/database.types.ts está desatualizado em relação às migrations.\n' +
        'Rode: npm run gen:types --workspace @mentor/api  e faça commit do resultado.',
    );
    process.exit(1);
  }
  console.log(`Tipos do banco em dia (${TABELAS.size} tabelas, ${VIEWS.size} views, ${porNome.size} funções).`);
} else {
  fs.writeFileSync(SAIDA, saida);
  console.log(`Gerado ${path.relative(process.cwd(), SAIDA)}: ${TABELAS.size} tabelas, ${VIEWS.size} views, ${porNome.size} funções, ${ENUMS.size} enums.`);
}
