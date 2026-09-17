import { describe, it, expect } from 'vitest';
import { paraDiaLocal, proximoStreak } from '../utils';

/**
 * O streak e a metrica que o aluno ve todo dia na Central. Os casos
 * abaixo travam as duas falhas reais que existiam aqui:
 *
 *   1. "ontem" era calculado em UTC e comparado com uma data LOCAL,
 *      entao quem estudava a noite num fuso a oeste perdia a sequencia;
 *   2. o efeito no App lia o valor errado e a sequencia nunca avancava.
 */
describe('proximoStreak', () => {
  it('soma 1 quando o ultimo acesso foi ontem', () => {
    const agora = new Date(2026, 8, 17, 10, 0, 0); // 17/09/2026, 10h local
    expect(proximoStreak('2026-09-16', 4, agora)).toBe(5);
  });

  it('recomeca em 1 quando pulou um dia', () => {
    const agora = new Date(2026, 8, 17, 10, 0, 0);
    expect(proximoStreak('2026-09-15', 9, agora)).toBe(1);
  });

  it('recomeca em 1 sem historico', () => {
    expect(proximoStreak('', 7, new Date(2026, 8, 17, 10, 0, 0))).toBe(1);
  });

  /*
   * A REGRESSAO QUE IMPORTA.
   *
   * 22h local. Num fuso a oeste de Greenwich (UTC-3), `toISOString()`
   * neste instante ja aponta para o dia seguinte - era assim que o
   * "ontem" saia trocado e zerava a sequencia de quem estuda de
   * madrugada. Com data local nos dois lados, a conta fecha em qualquer
   * hora do dia.
   */
  it('mantem a sequencia para quem entra tarde da noite', () => {
    const noite = new Date(2026, 8, 17, 22, 30, 0);
    expect(proximoStreak('2026-09-16', 11, noite)).toBe(12);
  });

  it('atravessa a virada do mes', () => {
    const primeiroDeOutubro = new Date(2026, 9, 1, 23, 45, 0);
    expect(proximoStreak('2026-09-30', 2, primeiroDeOutubro)).toBe(3);
  });

  it('atravessa a virada do ano', () => {
    const anoNovo = new Date(2027, 0, 1, 0, 30, 0);
    expect(proximoStreak('2026-12-31', 30, anoNovo)).toBe(31);
  });
});

describe('paraDiaLocal', () => {
  it('usa o calendario local, nao UTC', () => {
    // 23h de 17/09 em UTC-3 ja e 18/09 em UTC. O dia local continua 17.
    expect(paraDiaLocal(new Date(2026, 8, 17, 23, 0, 0))).toBe('2026-09-17');
  });

  it('preenche mes e dia com zero a esquerda', () => {
    expect(paraDiaLocal(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});
