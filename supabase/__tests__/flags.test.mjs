import { beforeAll, describe, expect, it } from 'vitest';
import { criarBancoComMigracoes } from '../bancoLocal.mjs';

/** Migrations 035 (feature flags) e 036 (índices). */
let db;
let usuarios = [];
let escola;

async function flagsDe(uid) {
  await db.exec('begin');
  try {
    await db.query(`select set_config('app.uid', $1, true)`, [uid]);
    await db.exec('set local role authenticated');
    const r = await db.query(`select * from public.minhas_flags() as chave`);
    await db.exec('reset role');
    await db.exec('commit');
    return r.rows.map((x) => x.chave);
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

beforeAll(async () => {
  db = await criarBancoComMigracoes();
  escola = (await db.query(`insert into public.escolas (nome) values ('Piloto') returning id`)).rows[0].id;
  const r = await db.query(`insert into auth.users (email) select 'u' || g || '@flags.test' from generate_series(1, 1000) g returning id`);
  usuarios = r.rows.map((x) => x.id);
  await db.query(`update public.perfis set escola_id = $1 where id = any($2)`, [escola, usuarios.slice(0, 50)]);
});

describe('feature flags (#69)', () => {
  it('10% dos alunos, sem nova build', async () => {
    await db.query(`insert into public.feature_flags (chave, ativa, porcentagem) values ('quiz_novo', true, 10)`);
    const r = await db.query(`select count(*)::int as n from unnest($1::uuid[]) u where public.balde_da_flag(u, 'quiz_novo') < 10`, [usuarios]);
    expect(r.rows[0].n).toBeGreaterThan(70);
    expect(r.rows[0].n).toBeLessThan(130);
  });

  it('a mesma pessoa vê sempre a mesma coisa, e subir a porcentagem mantém quem já tinha', async () => {
    const com10 = [];
    for (const u of usuarios.slice(0, 200)) if ((await flagsDe(u)).includes('quiz_novo')) com10.push(u);
    await db.query(`update public.feature_flags set porcentagem = 30 where chave = 'quiz_novo'`);
    for (const u of com10) expect(await flagsDe(u)).toContain('quiz_novo');
  });

  it('desligada não vale para ninguém', async () => {
    await db.query(`update public.feature_flags set ativa = false where chave = 'quiz_novo'`);
    expect(await flagsDe(usuarios[0])).toEqual([]);
  });

  it('piloto por escola: só quem é da escola', async () => {
    await db.query(`insert into public.feature_flags (chave, ativa, porcentagem, escolas) values ('piloto', true, 100, array[$1]::uuid[])`, [escola]);
    expect(await flagsDe(usuarios[0])).toContain('piloto');
    expect(await flagsDe(usuarios[999])).not.toContain('piloto');
  });

  it('aluno não lê a tabela de flags direto', async () => {
    await db.query(`grant select on public.feature_flags to authenticated`);
    await db.exec('begin');
    await db.query(`select set_config('app.uid', $1, true)`, [usuarios[0]]);
    await db.exec('set local role authenticated');
    const r = await db.query(`select * from public.feature_flags`);
    await db.exec('rollback');
    expect(r.rows).toEqual([]);
  });
});

describe('índices de escala (#68)', () => {
  it('os índices novos existem', async () => {
    const r = await db.query(`select indexname from pg_indexes where schemaname = 'public'`);
    const nomes = r.rows.map((x) => x.indexname);
    for (const n of ['perfis_turma_papel_idx', 'quiz_desemp_user_atualizado_idx', 'notif_push_pendente_idx', 'gamificacao_ofensiva_idx']) expect(nomes).toContain(n);
  });
});
