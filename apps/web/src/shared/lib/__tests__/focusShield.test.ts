import { describe, expect, it } from 'vitest';
import {
  TETO_DIARIO_MOEDAS,
  calcularMoedas,
  faixaDe,
  moedasDeHoje,
  penalidadeInterrupcoes,
  proximaFaixa,
  resumirSessoes,
} from '../focusShield';
import type { SessaoOffline } from '../../types';

function sessao(parcial: Partial<SessaoOffline>): SessaoOffline {
  return {
    inicio: new Date().toISOString(),
    fim: new Date().toISOString(),
    minutosOffline: 25,
    interrupcoes: 0,
    modo: 'enem',
    moedasCreditadas: 31,
    ...parcial,
  };
}

describe('calcularMoedas', () => {
  it('nao paga sessao curta demais (menos de 5 min)', () => {
    expect(calcularMoedas(4).moedas).toBe(0);
  });

  it('paga meia moeda por minuto na faixa de aquecimento', () => {
    // 10 min x 0.5 x modo enem (1.0) x sem penalidade = 5
    expect(calcularMoedas(10).moedas).toBe(5);
  });

  it('paga 1.25x a partir de um pomodoro completo', () => {
    // 25 x 1.25 = 31.25 -> 31 (piso)
    expect(calcularMoedas(25).moedas).toBe(31);
  });

  it('aplica o multiplicador do modo', () => {
    expect(calcularMoedas(25, 0, 'leve').moedas).toBe(25); // 25 x 1.25 x 0.8
    expect(calcularMoedas(25, 0, 'maratona').moedas).toBe(37); // 25 x 1.25 x 1.2 = 37.5
  });

  it('desconta 10% por interrupcao, com piso de 40%', () => {
    expect(penalidadeInterrupcoes(3)).toBeCloseTo(0.7);
    expect(penalidadeInterrupcoes(20)).toBe(0.4);
    // 60 min x 1.5 x 0.7 = 63
    expect(calcularMoedas(60, 3).moedas).toBe(63);
  });

  it('respeita o teto diario e sinaliza quando corta', () => {
    const r = calcularMoedas(120, 0, 'enem', TETO_DIARIO_MOEDAS - 10);
    expect(r.moedas).toBe(10);
    expect(r.limitadoPorTeto).toBe(true);
  });

  it('corta sessao acima de 4 horas', () => {
    expect(calcularMoedas(600).minutos).toBe(240);
  });
});

describe('faixas', () => {
  it('classifica pela duracao', () => {
    expect(faixaDe(3).mult).toBe(0);
    expect(faixaDe(20).mult).toBe(1);
    expect(faixaDe(95).mult).toBe(1.75);
  });

  it('informa quanto falta para a proxima faixa', () => {
    expect(proximaFaixa(20)).toEqual({ faltam: 5, mult: 1.25 });
    expect(proximaFaixa(200)).toBeNull();
  });
});

describe('resumo de sessoes', () => {
  it('agrega totais e conta as de hoje', () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const resumo = resumirSessoes([
      sessao({ minutosOffline: 30, moedasCreditadas: 37 }),
      sessao({ minutosOffline: 60, moedasCreditadas: 90, inicio: ontem }),
    ]);

    expect(resumo.totalMinutos).toBe(90);
    expect(resumo.totalMoedas).toBe(127);
    expect(resumo.melhorSessao).toBe(60);
    expect(resumo.media).toBe(45);
    expect(resumo.sessoesHoje).toBe(1);
  });

  it('soma apenas as moedas de hoje para o teto', () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const total = moedasDeHoje([
      sessao({ moedasCreditadas: 40 }),
      sessao({ moedasCreditadas: 999, inicio: ontem }),
    ]);
    expect(total).toBe(40);
  });
});
