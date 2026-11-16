import { beforeAll, describe, expect, it } from 'vitest';
import { criarBancoComMigracoes } from '../bancoLocal.mjs';

/**
 * Migration 032: push, preferências e lembretes (#55).
 *
 * As regras de envio (tipo desligado, silêncio, limite, validade) moram
 * no banco, em `pushes_para_enviar`. Este arquivo prova cada uma num
 * Postgres de verdade, com RLS ligada.
 */

let db;
let ana;
let beto;

async function comoUsuario(uid, sql, params = []) {
  await db.exec('begin');
  try {
    await db.query(`select set_config('app.uid', $1, true)`, [uid]);
    await db.exec('set local role authenticated');
    const r = await db.query(sql, params);
    await db.exec('reset role');
    await db.exec('commit');
    return r;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

const P256 = 'B' + 'A'.repeat(86);
const AUTH = 'x'.repeat(22);

async function inscrever(uid, n = 1) {
  return comoUsuario(uid, `select public.salvar_inscricao_push($1, $2, $3, 'teste')`, [`https://push.exemplo/${uid}/${n}`, P256, AUTH]);
}

async function enfileirar(uid, tipo, idadeHoras = 0) {
  await db.query(
    `insert into public.notificacoes (user_id, canal, tipo, titulo, corpo, criado_em)
     values ($1, 'push', $2, 't', 'c', now() - make_interval(hours => $3))`,
    [uid, tipo, idadeHoras],
  );
}

async function semSilencio(uid, limite = 3, tipos = {}) {
  return comoUsuario(uid, `select * from public.salvar_preferencias_notificacao($1::jsonb, 5, 5, $2)`, [JSON.stringify(tipos), limite]);
}

async function enviar() {
  const r = await db.query(`select * from public.pushes_para_enviar(100)`);
  // O worker marca como enviada depois de entregar.
  for (const linha of r.rows) await db.query(`update public.notificacoes set enviada_em = now() where id = $1`, [linha.id]);
  return r.rows;
}

const motivo = async (uid, tipo) =>
  (await db.query(`select descartada from public.notificacoes where user_id = $1 and tipo = $2 and canal = 'push' order by criado_em desc limit 1`, [uid, tipo])).rows[0]?.descartada;

beforeAll(async () => {
  db = await criarBancoComMigracoes();
  const r = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values
       ('ana.push@test.br', '{"nome":"Ana"}'), ('beto.push@test.br', '{"nome":"Beto"}') returning id`,
  );
  [ana, beto] = r.rows.map((x) => x.id);
});

describe('inscrição de push', () => {
  it('cada um lê só as próprias inscrições', async () => {
    await inscrever(ana);
    await inscrever(beto);
    const r = await comoUsuario(ana, `select user_id from public.push_inscricoes`);
    expect(r.rows.map((x) => x.user_id)).toEqual([ana]);
  });

  it('o mesmo navegador trocando de conta passa a inscrição para a conta nova', async () => {
    await comoUsuario(beto, `select public.salvar_inscricao_push($1, $2, $3)`, [`https://push.exemplo/${ana}/1`, P256, AUTH]);
    const r = await db.query(`select user_id from public.push_inscricoes where endpoint = $1`, [`https://push.exemplo/${ana}/1`]);
    expect(r.rows[0].user_id).toBe(beto);
    await inscrever(ana, 1); // devolve para os próximos testes
  });

  it('endpoint que não é https é recusado', async () => {
    await expect(
      comoUsuario(ana, `select public.salvar_inscricao_push('http://inseguro', $1, $2)`, [P256, AUTH]),
    ).rejects.toThrow();
  });

  it('o aluno não grava inscrição direto na tabela', async () => {
    await expect(
      comoUsuario(ana, `insert into public.push_inscricoes (user_id, endpoint, p256dh, auth) values ($1, 'https://x', $2, $3)`, [ana, P256, AUTH]),
    ).rejects.toThrow();
  });

  it('cliente não chama as funções do servidor', async () => {
    await expect(comoUsuario(ana, `select public.lembretes_do_dia('revisao')`)).rejects.toThrow();
    await expect(comoUsuario(ana, `select * from public.pushes_para_enviar(10)`)).rejects.toThrow();
  });
});

describe('preferências', () => {
  it('guarda só as chaves conhecidas e prende os números na faixa', async () => {
    const r = await comoUsuario(ana, `select * from public.salvar_preferencias_notificacao($1::jsonb, 30, -4, 99)`, [
      JSON.stringify({ revisao: false, liga: 'sim', invasor: true }),
    ]);
    const p = r.rows[0];
    expect(p.tipos).toEqual({ revisao: false });
    expect([p.silencio_inicio, p.silencio_fim, p.limite_diario]).toEqual([23, 0, 10]);
  });
});

describe('o que sai e o que não sai', () => {
  it('tipo desligado é descartado com o motivo', async () => {
    await semSilencio(ana, 3, { revisao: false });
    await enfileirar(ana, 'revisao');
    await enviar();
    expect(await motivo(ana, 'revisao')).toBe('desativada');
  });

  it('lembrete com mais de 24h expira; alerta de saúde não expira', async () => {
    await semSilencio(ana, 10);
    await enfileirar(ana, 'ofensiva', 30);
    await enfileirar(ana, 'alerta_saude', 30);
    const saiu = await enviar();
    expect(await motivo(ana, 'ofensiva')).toBe('expirada');
    expect(saiu.map((x) => x.tipo)).toContain('alerta_saude');
  });

  it('o limite diário corta o excesso, mas o alerta passa por cima', async () => {
    await db.query(`delete from public.notificacoes where user_id = $1`, [beto]);
    await semSilencio(beto, 2);
    for (let i = 0; i < 4; i++) await enfileirar(beto, 'liga_convite');
    await enfileirar(beto, 'alerta_saude');
    const saiu = await enviar();
    expect(saiu.filter((x) => x.tipo === 'liga_convite')).toHaveLength(2);
    expect(saiu.some((x) => x.tipo === 'alerta_saude')).toBe(true);
    const r = await db.query(`select count(*)::int as n from public.notificacoes where user_id = $1 and descartada = 'limite diario'`, [beto]);
    expect(r.rows[0].n).toBe(2);
  });

  it('no horário silencioso o push espera, não some', async () => {
    const h = (await db.query(`select extract(hour from now() at time zone 'America/Sao_Paulo')::int as h`)).rows[0].h;
    await comoUsuario(ana, `select * from public.salvar_preferencias_notificacao('{}'::jsonb, $1, $2, 10)`, [h, (h + 1) % 24]);
    await enfileirar(ana, 'consulta');
    const saiu = await enviar();
    expect(saiu.some((x) => x.tipo === 'consulta')).toBe(false);
    expect(await motivo(ana, 'consulta')).toBeNull();
    // Fim do silêncio: sai.
    await semSilencio(ana, 10);
    expect((await enviar()).some((x) => x.tipo === 'consulta')).toBe(true);
  });

  it('sem aparelho inscrito não há para onde mandar', async () => {
    const r = await db.query(`insert into auth.users (email) values ('sem.aparelho@test.br') returning id`);
    const uid = r.rows[0].id;
    await enfileirar(uid, 'revisao');
    await enviar();
    expect(await motivo(uid, 'revisao')).toBe('sem aparelho');
  });
});

describe('mensagens do app também viram push', () => {
  it('a cópia em push nunca leva mais que o aviso genérico', async () => {
    await db.query(
      `insert into public.notificacoes (user_id, tipo, titulo, corpo) values ($1, 'mensagem_apoio', 'Nova mensagem', 'Você tem uma mensagem nova no app.')`,
      [ana],
    );
    const r = await db.query(`select corpo from public.notificacoes where user_id = $1 and canal = 'push' and tipo = 'mensagem_apoio'`, [ana]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].corpo).toBe('Você tem uma mensagem nova no app.');
  });
});

describe('lembretes do dia', () => {
  it('revisão vencida vira UM lembrete por aluno, e não repete no mesmo dia', async () => {
    await db.query(`delete from public.notificacoes where user_id = $1 and tipo = 'revisao'`, [ana]);
    await inscrever(ana, 2); // dois aparelhos não dobram o lembrete
    await db.query(
      `insert into public.revisoes_espacadas (user_id, topico_id, topico_nome, proxima_revisao)
       values ($1, 't1', 'Funções', current_date - 1), ($1, 't2', 'Logaritmos', current_date - 2)`,
      [ana],
    );
    expect((await db.query(`select public.lembretes_do_dia('revisao') as n`)).rows[0].n).toBe(1);
    expect((await db.query(`select public.lembretes_do_dia('revisao') as n`)).rows[0].n).toBe(0);
    const r = await db.query(`select corpo from public.notificacoes where user_id = $1 and tipo = 'revisao' order by criado_em desc limit 1`, [ana]);
    expect(r.rows[0].corpo).toContain('2 revisões');
  });

  it('ofensiva em risco: estudou ontem, ainda não hoje', async () => {
    await db.query(
      `insert into public.gamificacao (user_id, streak, ultimo_acesso)
       values ($1, 4, (now() at time zone 'America/Sao_Paulo')::date - 1)
       on conflict (user_id) do update set streak = 4, ultimo_acesso = excluded.ultimo_acesso`,
      [beto],
    );
    expect((await db.query(`select public.lembretes_do_dia('ofensiva') as n`)).rows[0].n).toBe(1);
  });
});
