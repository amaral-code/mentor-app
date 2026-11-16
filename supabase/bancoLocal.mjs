import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Banco Postgres de verdade (PGlite em WASM) com todas as migrations
 * aplicadas, emulando o minimo do Supabase: schema auth, auth.users,
 * auth.uid() lendo uma GUC, e os papeis anon/authenticated/service_role.
 *
 * Usado por dois lados, para que nunca divirjam:
 *   - supabase/__tests__/migracoes.test.mjs (RLS, constraints, funcoes)
 *   - packages/api/scripts/gerar-tipos-banco.mjs (tipos TypeScript)
 *
 * Migration nova: acrescente o arquivo em MIGRACOES, na ordem.
 * A 001 fica de fora: a 003 recria o schema completo por cima dela.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.join(AQUI, 'migrations');

export const MIGRACOES = [
  '003_schema_completo.sql',
  '004_fix_recursao_ligas.sql',
  '005_loja_compra_servidor.sql',
  '006_ligas_e_comunidade.sql',
  '007_entrada_por_codigo.sql',
  '008_corrige_nivel.sql',
  '009_tarefa_idempotente.sql',
  '010_bemestar_marketplace_foco.sql',
  '011_bemestar_funcoes_rls.sql',
  '012_persona_ativa_texto.sql',
  '013_redacao_por_foto.sql',
  '014_quiz_antirrepeticao.sql',
  '015_quiz_desempenho.sql',
  '016_conversas_chat.sql',
  '017_reiniciar_indice.sql',
  '018_instituicao_convites.sql',
  '019_focus_metrics.sql',
  '020_insights_turma.sql',
  '021_onboarding.sql',
  '022_termometro_cognitivo.sql',
  '023_sala_foco.sql',
  '024_vinculo_por_codigo.sql',
  '025_resumo_para_responsavel.sql',
  '026_professor_por_turma.sql',
  '027_psicologo_consentimento_prontuario.sql',
  '028_conta_demonstracao.sql',
  '029_corrige_insights_escala.sql',
  '030_teto_moedas_fuso.sql',
  '031_ofensiva_brasilia_teto_xp_trava_nascimento.sql',
  '032_push_preferencias.sql',
  '033_fila_offline.sql',
  '034_relatorio_turma_planos_consulta.sql',
  '035_feature_flags.sql',
  '036_indices_escala.sql',
];

/** Cria o banco e aplica as migrations. Devolve a instancia do PGlite. */
export async function criarBancoComMigracoes() {
  const db = await PGlite.create({ extensions: { btree_gist } });

  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(), email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('app.uid', true), '')::uuid $$;
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated, service_role;
  `);

  for (const arquivo of MIGRACOES) {
    await db.exec(fs.readFileSync(path.join(PASTA, arquivo), 'utf8'));
  }
  return db;
}
