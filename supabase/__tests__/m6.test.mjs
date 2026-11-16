import { beforeAll, describe, expect, it } from 'vitest';
import { criarBancoComMigracoes } from '../bancoLocal.mjs';

/**
 * Migration 034 (M6): relatório da turma, isolamento entre escolas,
 * limite por plano, cancelamento com reembolso e formato do CRP.
 */
let db;

async function como(uid, sql, params = []) {
  await db.exec('begin');
  try {
    await db.query(`select set_config('app.uid', $1, true)`, [uid]);
    await db.exec('set local role authenticated');
    const r = await db.query(sql, params);
    await db.exec('reset role');
    await db.exec('commit');
    return r.rows;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
const criar = async (email, nome) =>
  (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('nome', $2::text)) returning id`, [email, nome])).rows[0].id;

let escolaA, escolaB, turmaA, turmaB, secA, secB, profA, alunosA, alunoB;

beforeAll(async () => {
  db = await criarBancoComMigracoes();
  escolaA = (await db.query(`insert into public.escolas (nome) values ('Escola A') returning id`)).rows[0].id;
  escolaB = (await db.query(`insert into public.escolas (nome) values ('Escola B') returning id`)).rows[0].id;
  turmaA = (await db.query(`insert into public.turmas (escola_id, nome) values ($1, '3A') returning id`, [escolaA])).rows[0].id;
  turmaB = (await db.query(`insert into public.turmas (escola_id, nome) values ($1, '3B') returning id`, [escolaB])).rows[0].id;
  secA = await criar('sec.a@test.br', 'Sec A');
  secB = await criar('sec.b@test.br', 'Sec B');
  profA = await criar('prof.a@test.br', 'Prof A');
  await db.query(`update public.perfis set papel='educator', escola_id=$2 where id=$1`, [secA, escolaA]);
  await db.query(`update public.perfis set papel='educator', escola_id=$2 where id=$1`, [secB, escolaB]);
  await db.query(`update public.perfis set papel='teacher', escola_id=$2 where id=$1`, [profA, escolaA]);
  await db.query(`insert into public.turma_professores (turma_id, professor_id) values ($1, $2)`, [turmaA, profA]);

  alunosA = [];
  for (let i = 0; i < 4; i++) {
    const id = await criar(`aluno.a${i}@test.br`, `Aluno A${i}`);
    await db.query(`update public.perfis set escola_id=$2, turma_id=$3 where id=$1`, [id, escolaA, turmaA]);
    alunosA.push(id);
  }
  alunoB = await criar('aluno.b@test.br', 'Aluno B');
  await db.query(`update public.perfis set escola_id=$2, turma_id=$3 where id=$1`, [alunoB, escolaB, turmaB]);

  // Funções: os 4 alunos da 3A responderam. Logaritmos: só 2 (abaixo do piso).
  for (const [i, id] of alunosA.entries()) {
    await db.query(`insert into public.quiz_desempenho_topicos (user_id, materia, topico, acertos, erros) values ($1, 'Matemática', 'Funções', $2, $3)`, [id, i, 3 - i]);
  }
  for (const id of alunosA.slice(0, 2)) {
    await db.query(`insert into public.quiz_desempenho_topicos (user_id, materia, topico, acertos, erros) values ($1, 'Matemática', 'Logaritmos', 0, 5)`, [id]);
  }
  await db.query(`insert into public.quiz_desempenho_topicos (user_id, materia, topico, acertos, erros) values ($1, 'Química', 'Soluções', 9, 1)`, [alunoB]);
});

describe('relatório da turma (#60)', () => {
  it('o professor vê a própria turma por tópico', async () => {
    const resumo = (await como(profA, `select * from public.resumo_turma($1, 30)`, [turmaA]))[0];
    expect(resumo).toMatchObject({ turma_nome: '3A', total_alunos: 4, alunos_ativos: 4 });
    expect(Number(resumo.taxa_acerto)).toBeCloseTo((6 / 22) * 100, 0);
    const linhas = await como(profA, `select * from public.relatorio_turma($1, 30)`, [turmaA]);
    expect(linhas.map((l) => l.topico)).toEqual(['Funções']);
    expect(linhas[0]).toMatchObject({ alunos_medidos: 4, alunos_com_dificuldade: 2 });
  });

  it('tópico com menos de 3 alunos não aparece: seria a nota de alguém identificável', async () => {
    const linhas = await como(secA, `select * from public.relatorio_turma($1, 30)`, [turmaA]);
    expect(linhas.some((l) => l.topico === 'Logaritmos')).toBe(false);
  });

  it('aluno não lê relatório nenhum', async () => {
    await expect(como(alunosA[0], `select * from public.relatorio_turma($1, 30)`, [turmaA])).rejects.toThrow(/sem_permissao/);
  });
});

describe('isolamento entre escolas (#63)', () => {
  it('a secretaria da escola B não lê relatório nem resumo da escola A', async () => {
    await expect(como(secB, `select * from public.relatorio_turma($1, 30)`, [turmaA])).rejects.toThrow(/sem_permissao/);
    await expect(como(secB, `select * from public.resumo_turma($1, 30)`, [turmaA])).rejects.toThrow(/sem_permissao/);
  });

  it('nas visões agregadas cada escola só vê a si mesma', async () => {
    const turmasB = await como(secB, `select * from public.minhas_turmas()`);
    expect(turmasB.map((t) => t.id)).toEqual([turmaB]);
    const insightsB = await como(secB, `select * from public.insights_turma_24h(168)`);
    expect(insightsB.every((l) => l.materia === 'Química')).toBe(true);
    const insightsA = await como(secA, `select * from public.insights_turma_24h(168)`);
    expect(insightsA.some((l) => l.materia === 'Química')).toBe(false);
  });

  it('a secretaria não lê o desempenho nem o perfil de aluno de outra escola', async () => {
    // O Supabase dá SELECT a `authenticated` em toda tabela nova; quem
    // filtra é a RLS. O PGlite não tem esse padrão, então a permissão é
    // dada aqui para o teste provar a RLS, e não a falta de permissão.
    await db.query(`grant select on public.quiz_desempenho_topicos, public.perfis to authenticated`);
    const desemp = await como(secB, `select * from public.quiz_desempenho_topicos where user_id = any($1)`, [alunosA]);
    expect(desemp).toHaveLength(0);
    const perfis = await como(secB, `select id from public.perfis where id = any($1)`, [alunosA]);
    expect(perfis).toHaveLength(0);
  });
});

describe('limite de alunos por plano (#63)', () => {
  it('passar do limite é recusado, inclusive pela importação (service_role)', async () => {
    await db.query(`update public.escolas set limite_alunos = 4 where id = $1`, [escolaA]);
    const novo = await criar('aluno.extra@test.br', 'Extra');
    await expect(db.query(`update public.perfis set escola_id = $2, turma_id = $3 where id = $1`, [novo, escolaA, turmaA])).rejects.toThrow(/limite de alunos/);
    await db.query(`update public.escolas set limite_alunos = null where id = $1`, [escolaA]);
    await db.query(`update public.perfis set escola_id = $2, turma_id = $3 where id = $1`, [novo, escolaA, turmaA]);
  });

  it('mudar de turma dentro da mesma escola não conta como aluno novo', async () => {
    await db.query(`update public.escolas set limite_alunos = 5 where id = $1`, [escolaA]);
    const t2 = (await db.query(`insert into public.turmas (escola_id, nome) values ($1, '3C') returning id`, [escolaA])).rows[0].id;
    await db.query(`update public.perfis set turma_id = $2 where id = $1`, [alunosA[0], t2]);
  });
});

describe('consulta: cancelamento e CRP (#62)', () => {
  let psi, aluno;
  beforeAll(async () => {
    psi = await criar('psi.m6@test.br', 'Psi');
    aluno = await criar('aluno.m6@test.br', 'Aluno Consulta');
  });

  it('CRP fora do formato é recusado', async () => {
    await expect(db.query(`select public.registrar_psicologo('psi.m6@test.br', 'qualquer coisa')`)).rejects.toThrow(/CRP/);
    await db.query(`select public.registrar_psicologo('psi.m6@test.br', '06/123456')`);
  });

  async function consulta(horasAteInicio, pago = true) {
    return (await db.query(
      `insert into public.agendamentos (aluno_id, psicologo_id, inicio, fim, valor_centavos, status_pagamento, status)
       values ($1, $2, now() + make_interval(hours => $3), now() + make_interval(hours => $3) + interval '50 minutes', 15000, $4, 'confirmado') returning id`,
      [aluno, psi, horasAteInicio, pago ? 'pago' : 'pendente'],
    )).rows[0].id;
  }

  it('aluno cancela com 24h ou mais: reembolso integral', async () => {
    const id = await consulta(48);
    expect((await como(aluno, `select * from public.cancelar_consulta($1)`, [id]))[0].reembolso).toBe('integral');
  });

  it('aluno cancela em cima da hora: sem reembolso', async () => {
    const id = await consulta(3);
    expect((await como(aluno, `select * from public.cancelar_consulta($1)`, [id]))[0].reembolso).toBe('nenhum');
  });

  it('o profissional cancela: reembolso integral, mesmo em cima da hora, e o aluno é avisado', async () => {
    const id = await consulta(1);
    const r = (await como(psi, `select * from public.cancelar_consulta($1)`, [id]))[0];
    expect(r.reembolso).toBe('integral');
    const aviso = await db.query(`select count(*)::int as n from public.notificacoes where user_id = $1 and tipo = 'consulta' and titulo = 'Consulta cancelada'`, [aluno]);
    expect(aviso.rows[0].n).toBeGreaterThan(0);
  });

  it('consulta não paga não tem reembolso a decidir', async () => {
    const id = await consulta(48, false);
    expect((await como(aluno, `select * from public.cancelar_consulta($1)`, [id]))[0].reembolso).toBeNull();
  });
});
