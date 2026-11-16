import { beforeAll, describe, expect, it } from 'vitest';
import { criarBancoComMigracoes } from '../bancoLocal.mjs';

/**
 * Migration 037 (M8): exportar e excluir a conta (LGPD) e feedback do beta.
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

let aluno, outro, psi;

beforeAll(async () => {
  db = await criarBancoComMigracoes();
  // PGlite não tem os grants padrão do Supabase: dá o que o app teria.
  await db.exec(`grant select on all tables in schema public to authenticated;`);
  aluno = await criar('aluno@test.br', 'Ana Aluna');
  outro = await criar('outro@test.br', 'Outro');
  psi = await criar('psi@test.br', 'Paula Psi');
  await db.query(`select public.registrar_psicologo('psi@test.br', '06/123456')`);

  await db.query(`insert into public.quiz_resultados (user_id, materia, acertos, total, xp_ganho) values ($1, 'Biologia', 7, 10, 70), ($2, 'Física', 1, 10, 10)`, [aluno, outro]);
  await db.query(`insert into public.push_inscricoes (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/x', repeat('k', 87), 'segredoAuthDoNavegador1')`, [aluno]);
  const n1 = (await db.query(`insert into public.prontuario_notas (psicologo_id, aluno_id, texto) values ($1, $2, 'primeira sessão') returning id`, [psi, aluno])).rows[0].id;
  await db.query(`insert into public.prontuario_notas (psicologo_id, aluno_id, tipo, retifica_id, texto) values ($1, $2, 'retificacao', $3, 'correção')`, [psi, aluno, n1]);
});

describe('exportar_meus_dados', () => {
  it('traz os dados da pessoa e nada de outra', async () => {
    const [{ exportar_meus_dados: dados }] = await como(aluno, 'select public.exportar_meus_dados()');
    expect(dados.perfil.id).toBe(aluno);
    expect(dados.quiz_resultados).toHaveLength(1);
    expect(dados.quiz_resultados[0].materia).toBe('Biologia');
    expect(JSON.stringify(dados)).not.toContain('Física');
  });

  it('deixa de fora a inscrição de push (chave do navegador)', async () => {
    const [{ exportar_meus_dados: dados }] = await como(aluno, 'select public.exportar_meus_dados()');
    expect(dados.push_inscricoes).toBeUndefined();
    expect(JSON.stringify(dados)).not.toContain('segredoAuthDoNavegador1');
  });

  it('o paciente não recebe o prontuário; o psicólogo recebe o que escreveu', async () => {
    const [{ exportar_meus_dados: doAluno }] = await como(aluno, 'select public.exportar_meus_dados()');
    expect(JSON.stringify(doAluno)).not.toContain('primeira sessão');
    const [{ exportar_meus_dados: doPsi }] = await como(psi, 'select public.exportar_meus_dados()');
    expect(doPsi.prontuario_escrito).toHaveLength(2);
  });

  it('sem login, recusa', async () => {
    await expect(como('', 'select public.exportar_meus_dados()')).rejects.toThrow();
  });
});

describe('exclusão de conta', () => {
  it('o próprio app não chama o preparo (só o back-end)', async () => {
    await expect(como(aluno, 'select public.preparar_exclusao_conta($1)', [aluno])).rejects.toThrow(/permission denied/);
  });

  it('apagar o aluno leva os dados dele e preserva o prontuário com o nome', async () => {
    const preparo = (await db.query('select public.preparar_exclusao_conta($1) as r', [aluno])).rows[0].r;
    expect(preparo).toMatchObject({ papel: 'student', notas_preservadas: 2 });
    await db.query('delete from auth.users where id = $1', [aluno]);

    const restos = await db.query(`select count(*)::int as n from public.quiz_resultados where user_id = $1`, [aluno]);
    expect(restos.rows[0].n).toBe(0);
    const notas = await db.query(`select aluno_id, paciente_excluido from public.prontuario_notas order by criado_em`);
    expect(notas.rows).toHaveLength(2);
    expect(notas.rows.every((n) => n.aluno_id === null && n.paciente_excluido === 'Ana Aluna')).toBe(true);
    const registro = await db.query(`select papel from public.exclusoes_conta`);
    expect(registro.rows).toEqual([{ papel: 'student' }]);
  });

  it('o psicólogo consegue excluir a conta mesmo com retificação no prontuário', async () => {
    await db.query('select public.preparar_exclusao_conta($1)', [psi]);
    await db.query('delete from auth.users where id = $1', [psi]);
    const notas = await db.query(`select count(*)::int as n from public.prontuario_notas`);
    expect(notas.rows[0].n).toBe(0);
  });
});

describe('feedback do beta', () => {
  it('grava, cada um lê só o seu, e para em 10 por dia', async () => {
    for (let i = 0; i < 10; i++) {
      await como(outro, `select public.enviar_feedback('ideia', $1, 9::smallint, 'quiz', '1.0')`, [`ideia ${i}`]);
    }
    await expect(como(outro, `select public.enviar_feedback('ideia', 'mais uma')`)).rejects.toThrow(/limite/);
    const meus = await como(outro, 'select count(*)::int as n from public.feedback_beta');
    expect(meus[0].n).toBe(10);
    const terceiro = await criar('terceiro@test.br', 'Terceiro');
    const alheios = await como(terceiro, 'select count(*)::int as n from public.feedback_beta');
    expect(alheios[0].n).toBe(0);
  });

  it('recusa nota fora de 0 a 10 e texto vazio', async () => {
    const quem = await criar('quarto@test.br', 'Quarto');
    await expect(como(quem, `select public.enviar_feedback('elogio', 'bom', 11::smallint)`)).rejects.toThrow();
    await expect(como(quem, `select public.enviar_feedback('problema', '   ')`)).rejects.toThrow();
  });
});
