import { describe, expect, it } from 'vitest';
import { base64UrlParaBytes, emSilencio, horaDeBrasilia, normalizarPreferencias, PREFERENCIAS_PADRAO } from '../notificacoes';

describe('preferências de notificação', () => {
  it('sem linha no banco valem os padrões', () => {
    expect(normalizarPreferencias(null)).toEqual(PREFERENCIAS_PADRAO);
  });

  it('aproveita só o que é válido e prende os números na faixa', () => {
    const p = normalizarPreferencias({ tipos: { revisao: false, liga: 'nao', invasor: true }, silencio_inicio: 40, silencio_fim: -2, limite_diario: 0 });
    expect(p.tipos.revisao).toBe(false);
    expect(p.tipos.liga).toBe(true);
    expect('invasor' in p.tipos).toBe(false);
    expect([p.silencioInicio, p.silencioFim, p.limiteDiario]).toEqual([23, 0, 1]);
  });
});

describe('horário silencioso', () => {
  it('atravessando a meia-noite (22h às 7h)', () => {
    expect([21, 22, 3, 6, 7].map((h) => emSilencio(h, 22, 7))).toEqual([false, true, true, true, false]);
  });
  it('dentro do mesmo dia (13h às 15h)', () => {
    expect([12, 13, 14, 15].map((h) => emSilencio(h, 13, 15))).toEqual([false, true, true, false]);
  });
  it('início igual ao fim desliga o silêncio', () => {
    expect(emSilencio(3, 5, 5)).toBe(false);
  });
  it('a hora é a de Brasília, não a do aparelho', () => {
    expect(horaDeBrasilia(new Date('2026-11-11T01:30:00Z'))).toBe(22);
  });
});

it('converte a chave VAPID para bytes', () => {
  expect(Array.from(base64UrlParaBytes('AQID_-8'))).toEqual([1, 2, 3, 255, 239]);
});
