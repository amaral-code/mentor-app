import { describe, expect, it } from 'vitest';
import {
  INTERVALOS_BASE,
  ajustarFacilidade,
  forcaDaMemoria,
  limitarCargaDiaria,
  montarAgenda,
  proximaRevisao,
  revisoesDeHoje,
  somarDias,
} from '../srsEngine';
import type { RevisaoEspacada } from '../../types';

const HOJE = new Date('2026-03-10T12:00:00');

function revisao(parcial: Partial<RevisaoEspacada>): RevisaoEspacada {
  return {
    topicoId: 'bio:citologia',
    topicoNome: 'Citologia',
    materia: 'Biologia',
    nivelMemoria: 1,
    intervaloDias: 3,
    facilidade: 2.5,
    revisoesFeitas: 1,
    proximaRevisao: '2026-03-10',
    ultimaRevisao: '2026-03-07',
    ...parcial,
  };
}

describe('proximaRevisao', () => {
  it('topico novo com nota alta cai no segundo degrau da curva', () => {
    const r = proximaRevisao(undefined, 90, HOJE);
    expect(r.subiuDeNivel).toBe(true);
    expect(r.nivelMemoria).toBe(1);
    // base 3 dias x (facilidade ajustada / 2.5)
    expect(r.intervaloDias).toBeGreaterThanOrEqual(3);
    expect(r.proximaRevisao).toBe(somarDias(HOJE, r.intervaloDias));
  });

  it('nota mediana mantem o nivel', () => {
    const r = proximaRevisao({ nivelMemoria: 2, facilidade: 2.5, intervaloDias: 7 }, 70, HOJE);
    expect(r.subiuDeNivel).toBe(false);
    expect(r.reiniciou).toBe(false);
    expect(r.nivelMemoria).toBe(2);
  });

  it('nota abaixo de 60 reinicia o topico para amanha', () => {
    const r = proximaRevisao({ nivelMemoria: 4, facilidade: 2.5, intervaloDias: 45 }, 40, HOJE);
    expect(r.reiniciou).toBe(true);
    expect(r.nivelMemoria).toBe(0);
    expect(r.intervaloDias).toBe(1);
    expect(r.proximaRevisao).toBe('2026-03-11');
  });

  it('nao passa do nivel maximo', () => {
    const r = proximaRevisao({ nivelMemoria: 5, facilidade: 2.8, intervaloDias: 90 }, 100, HOJE);
    expect(r.nivelMemoria).toBe(5);
    expect(r.subiuDeNivel).toBe(false);
  });

  it('segue a curva 1-3-7-21 quando a facilidade esta neutra', () => {
    // Facilidade exatamente 2.5 faz o intervalo ser o proprio valor base.
    const passos = [0, 1, 2, 3].map(
      (nivel) => proximaRevisao({ nivelMemoria: nivel, facilidade: 2.5, intervaloDias: 1 }, 70, HOJE).intervaloDias,
    );
    expect(passos).toEqual(INTERVALOS_BASE.slice(0, 4));
  });
});

describe('ajustarFacilidade', () => {
  it('sobe com acerto pleno e desce com erro', () => {
    expect(ajustarFacilidade(2.5, 100)).toBeGreaterThan(2.5);
    expect(ajustarFacilidade(2.5, 20)).toBeLessThan(2.5);
  });

  it('respeita o piso de 1.3 do SM-2', () => {
    let ef = 2.5;
    for (let i = 0; i < 20; i++) ef = ajustarFacilidade(ef, 0);
    expect(ef).toBe(1.3);
  });
});

describe('agenda', () => {
  it('joga o atrasado para hoje, nunca para o passado', () => {
    const lista = [revisao({ proximaRevisao: '2026-03-01' }), revisao({ topicoId: 'b', proximaRevisao: '2026-03-12' })];
    const agenda = montarAgenda(lista, 5, HOJE);

    expect(agenda[0].data).toBe('2026-03-10');
    expect(agenda[0].revisoes).toHaveLength(1);
    expect(agenda[0].atrasadas).toBe(1);
    expect(agenda[2].revisoes).toHaveLength(1);
  });

  it('revisoesDeHoje inclui vencidas e as do dia', () => {
    const lista = [
      revisao({ proximaRevisao: '2026-03-09' }),
      revisao({ topicoId: 'b', proximaRevisao: '2026-03-10' }),
      revisao({ topicoId: 'c', proximaRevisao: '2026-03-20' }),
    ];
    expect(revisoesDeHoje(lista, HOJE)).toHaveLength(2);
  });

  it('limita a carga do dia e adia o excedente', () => {
    const lista = Array.from({ length: 12 }, (_, i) =>
      revisao({ topicoId: `t${i}`, proximaRevisao: '2026-03-09' }),
    );
    const { hoje, adiadas } = limitarCargaDiaria(lista, 8, HOJE);
    expect(hoje).toHaveLength(8);
    expect(adiadas).toHaveLength(4);
  });
});

describe('forcaDaMemoria', () => {
  it('cai conforme os dias passam desde a ultima revisao', () => {
    const recente = forcaDaMemoria(revisao({ ultimaRevisao: '2026-03-10', intervaloDias: 7 }), HOJE);
    const antiga = forcaDaMemoria(revisao({ ultimaRevisao: '2026-02-20', intervaloDias: 7 }), HOJE);
    expect(recente).toBeGreaterThan(antiga);
    expect(antiga).toBeLessThan(20);
  });

  it('topico nunca revisado tem forca zero', () => {
    expect(forcaDaMemoria(revisao({ ultimaRevisao: null }), HOJE)).toBe(0);
  });
});
