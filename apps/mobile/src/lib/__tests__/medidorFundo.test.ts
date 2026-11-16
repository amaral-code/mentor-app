import { describe, expect, it } from 'vitest';
import { criarMedidor } from '../medidorFundo';

describe('criarMedidor (escudo sem módulo nativo)', () => {
  it('soma só o tempo em segundo plano e conta cada volta', () => {
    const m = criarMedidor();
    m.saiu(0);
    expect(m.noFundo()).toBe(true);
    m.voltou(10 * 60_000);
    m.saiu(12 * 60_000);
    expect(m.minutosOffline(15 * 60_000)).toBe(13);
    m.voltou(20 * 60_000);
    expect(m.minutosOffline(25 * 60_000)).toBe(18);
    expect(m.interrupcoes()).toBe(2);
  });

  it('voltar sem ter saído e sair duas vezes não inventam tempo', () => {
    const m = criarMedidor();
    m.voltou(5_000);
    m.saiu(60_000);
    m.saiu(120_000);
    m.voltou(180_000);
    expect(m.minutosOffline(180_000)).toBe(2);
    expect(m.interrupcoes()).toBe(1);
  });

  it('relógio que anda para trás não gera tempo negativo', () => {
    const m = criarMedidor();
    m.saiu(100_000);
    m.voltou(40_000);
    expect(m.minutosOffline(40_000)).toBe(0);
  });
});
