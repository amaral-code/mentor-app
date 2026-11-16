import { beforeEach, describe, expect, it } from 'vitest';
import { configurarPlataforma, criarArmazenamentoEmMemoria } from '../plataforma';
import { enfileirarOperacao, esperaParaTentativa, operacoesPendentes, sincronizarFila, type ResultadoEnvio } from '../filaOffline';

beforeEach(() => configurarPlataforma({ armazenamento: () => memoria }));
let memoria = criarArmazenamentoEmMemoria();
beforeEach(() => { memoria = criarArmazenamentoEmMemoria(); });

const T0 = Date.parse('2026-11-16T12:00:00Z');

describe('fila offline', () => {
  it('um quiz inteiro em modo avião fica guardado e sai na ordem quando a rede volta', async () => {
    enfileirarOperacao('desempenho_topico', { topico: 'Funções', acertou: true }, T0);
    enfileirarOperacao('quiz_resultado', { acertos: 7, total: 10 }, T0 + 1);
    enfileirarOperacao('xp', { xp: 70 }, T0 + 2);

    const semRede = await sincronizarFila(async () => ({ status: 'rede' }), T0 + 10);
    expect(semRede.pendentes).toBe(3);

    const ordem: string[] = [];
    const ok = await sincronizarFila(async (op) => { ordem.push(op.tipo); return { status: 'aplicada' }; }, T0 + 10 + esperaParaTentativa(1));
    expect(ordem).toEqual(['desempenho_topico', 'quiz_resultado', 'xp']);
    expect(ok.pendentes).toBe(0);
    expect(operacoesPendentes()).toEqual([]);
  });

  it('a chave sobrevive ao reenvio: é a mesma nas duas tentativas', async () => {
    enfileirarOperacao('xp', { xp: 10 }, T0);
    const chaves: string[] = [];
    await sincronizarFila(async (op) => { chaves.push(op.chave); return { status: 'rede' }; }, T0);
    await sincronizarFila(async (op) => { chaves.push(op.chave); return { status: 'aplicada' }; }, T0 + 60_000);
    expect(chaves[0]).toBe(chaves[1]);
  });

  it('espera crescente entre tentativas, com teto de 10 minutos', () => {
    expect([1, 2, 3].map(esperaParaTentativa)).toEqual([5000, 10000, 20000]);
    expect(esperaParaTentativa(30)).toBe(600000);
  });

  it('não tenta de novo antes da hora', async () => {
    enfileirarOperacao('xp', { xp: 10 }, T0);
    await sincronizarFila(async () => ({ status: 'rede' }), T0);
    let chamou = false;
    await sincronizarFila(async () => { chamou = true; return { status: 'aplicada' }; }, T0 + 1000);
    expect(chamou).toBe(false);
  });

  it('recusa definitiva sai da fila; falha de rede interrompe a rodada', async () => {
    enfileirarOperacao('xp', { xp: -1 }, T0);
    enfileirarOperacao('xp', { xp: 10 }, T0);
    enfileirarOperacao('xp', { xp: 20 }, T0);
    const respostas: ResultadoEnvio[] = [{ status: 'recusada', motivo: 'invalida' }, { status: 'rede' }];
    let n = 0;
    const r = await sincronizarFila(async () => respostas[n++] ?? { status: 'aplicada' }, T0);
    expect(r.recusadas).toHaveLength(1);
    expect(n).toBe(2);
    expect(r.pendentes).toBe(2);
  });

  it('operação com mais de 7 dias é descartada', async () => {
    enfileirarOperacao('xp', { xp: 10 }, T0);
    const r = await sincronizarFila(async () => ({ status: 'aplicada' }), T0 + 8 * 86400 * 1000);
    expect(r.aplicadas).toHaveLength(0);
    expect(r.pendentes).toBe(0);
  });

  it('operação que entra durante o envio não é apagada', async () => {
    enfileirarOperacao('quiz_resultado', { acertos: 1, total: 1 }, T0);
    const r = await sincronizarFila(async () => {
      // O aluno termina outra coisa enquanto a primeira está na rede.
      enfileirarOperacao('xp', { xp: 10 }, T0);
      enfileirarOperacao('desempenho_topico', { acertou: true }, T0);
      return { status: 'rede' };
    }, T0);
    expect(r.pendentes).toBe(3);
    expect(operacoesPendentes().map((o) => o.tipo)).toEqual(['quiz_resultado', 'xp', 'desempenho_topico']);
  });

  it('quando a conexão volta, envia sem esperar a espera crescente', async () => {
    enfileirarOperacao('xp', { xp: 10 }, T0);
    await sincronizarFila(async () => ({ status: 'rede' }), T0);
    const r = await sincronizarFila(async () => ({ status: 'aplicada' }), T0 + 1000, { ignorarEspera: true });
    expect(r.aplicadas).toHaveLength(1);
  });

  it('exceção do executor conta como rede, não perde a operação', async () => {
    enfileirarOperacao('xp', { xp: 10 }, T0);
    const r = await sincronizarFila(async () => { throw new TypeError('Failed to fetch'); }, T0);
    expect(r.pendentes).toBe(1);
  });
});
