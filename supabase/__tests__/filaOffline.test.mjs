import { beforeAll, describe, expect, it } from 'vitest';
import { criarBancoComMigracoes } from '../bancoLocal.mjs';

/** Migration 033: operação offline aplicada uma vez só (#56). */
let db;
let ana;

async function como(uid, sql, params = []) {
  await db.exec('begin');
  try {
    await db.query(`select set_config('app.uid', $1, true)`, [uid]);
    await db.exec('set local role authenticated');
    const r = await db.query(sql, params);
    await db.exec('reset role');
    await db.exec('commit');
    return r.rows[0];
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
const aplicar = (chave, tipo, dados, feita = null) =>
  como(ana, `select public.aplicar_operacao($1, $2, $3::jsonb, $4) as r`, [chave, tipo, JSON.stringify(dados), feita]).then((x) => x.r);

beforeAll(async () => {
  db = await criarBancoComMigracoes();
  ana = (await db.query(`insert into auth.users (email) values ('ana.offline@test.br') returning id`)).rows[0].id;
});

describe('fila offline', () => {
  it('o reenvio da mesma operação não dobra o XP', async () => {
    const a = await aplicar('xp-chave-001', 'xp', { tipo: 'quiz', descricao: 'Quiz offline', xp: 40 });
    expect(a.gamificacao.xp).toBe(40);
    expect(await aplicar('xp-chave-001', 'xp', { tipo: 'quiz', descricao: 'Quiz offline', xp: 40 })).toEqual({ duplicada: true });
    const g = await db.query(`select xp from public.gamificacao where user_id = $1`, [ana]);
    expect(g.rows[0].xp).toBe(40);
  });

  it('o quiz feito em modo avião guarda a hora em que foi feito', async () => {
    const feita = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    await aplicar('quiz-chave-01', 'quiz_resultado', { materia: 'Matemática', acertos: 7, total: 10, xpGanho: 70 }, feita);
    await aplicar('quiz-chave-01', 'quiz_resultado', { materia: 'Matemática', acertos: 7, total: 10, xpGanho: 70 }, feita);
    const r = await db.query(`select acertos, criado_em from public.quiz_resultados where user_id = $1`, [ana]);
    expect(r.rows).toHaveLength(1);
    expect(Math.abs(new Date(r.rows[0].criado_em).getTime() - new Date(feita).getTime())).toBeLessThan(1000);
  });

  it('hora do aparelho no futuro vira "agora"; com mais de 7 dias é recusada', async () => {
    const futuro = new Date(Date.now() + 5 * 86400 * 1000).toISOString();
    await aplicar('quiz-chave-02', 'quiz_resultado', { materia: 'Física', acertos: 1, total: 2 }, futuro);
    const r = await db.query(`select criado_em from public.quiz_resultados where user_id = $1 and materia = 'Física'`, [ana]);
    expect(new Date(r.rows[0].criado_em).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    const antiga = new Date(Date.now() - 8 * 86400 * 1000).toISOString();
    await expect(aplicar('quiz-chave-03', 'quiz_resultado', { materia: 'X', acertos: 1, total: 1 }, antiga)).rejects.toThrow(/antiga/);
  });

  it('placar por tópico também passa pela fila', async () => {
    await aplicar('topico-chave-1', 'desempenho_topico', { materia: 'Matemática', topico: 'Funções', acertou: true });
    await aplicar('topico-chave-1', 'desempenho_topico', { materia: 'Matemática', topico: 'Funções', acertou: true });
    const r = await db.query(`select * from public.quiz_desempenho_topicos where user_id = $1`, [ana]);
    expect(r.rows).toHaveLength(1);
    const linha = r.rows[0];
    expect(linha.acertos).toBe(1);
  });

  it('o aluno não lê nem grava a tabela de chaves direto', async () => {
    await expect(como(ana, `insert into public.operacoes_sincronizadas (user_id, chave, tipo) values ($1, 'forjada-001', 'xp')`, [ana])).rejects.toThrow();
  });

  it('tipo desconhecido é recusado e a chave não fica gasta', async () => {
    await expect(aplicar('estranha-0001', 'apagar_tudo', {})).rejects.toThrow(/desconhecido/);
    const r = await db.query(`select count(*)::int as n from public.operacoes_sincronizadas where chave = 'estranha-0001'`);
    expect(r.rows[0].n).toBe(0);
  });
});
