import { describe, expect, it } from 'vitest';
import {
  CONSCIOUS_PAUSE_SECONDS,
  FOCUS_TRIGGER_COUNT,
  FOCUS_TRIGGER_WINDOW_MS,
  buildSessionMetrics,
  distractionStage,
  distractionsInWindow,
  formatFocusTime,
  shouldTriggerConsciousPause,
  toFocusedMinutes,
} from '../focusLogic';

const MIN = 60_000;

describe('shouldTriggerConsciousPause (regra 3-em-15min)', () => {
  it('nao dispara com menos de 3 perdas na janela', () => {
    const agora = 1_000_000;
    expect(shouldTriggerConsciousPause([agora - MIN, agora - 2 * MIN], agora)).toBe(false);
  });

  it('dispara com 3 perdas dentro de 15 minutos', () => {
    const agora = 1_000_000;
    expect(
      shouldTriggerConsciousPause([agora - 14 * MIN, agora - 5 * MIN, agora - MIN], agora),
    ).toBe(true);
  });

  it('ignora perdas fora da janela (mais de 15 min atras)', () => {
    const agora = 1_000_000;
    expect(
      shouldTriggerConsciousPause(
        [agora - 60 * MIN, agora - 40 * MIN, agora - MIN],
        agora,
      ),
    ).toBe(false);
  });

  it('a borda da janela (exatos 15 min) ainda conta', () => {
    const agora = 1_000_000;
    expect(
      shouldTriggerConsciousPause(
        [agora - FOCUS_TRIGGER_WINDOW_MS, agora - MIN, agora],
        agora,
      ),
    ).toBe(true);
  });

  it('aceita timestamps fora de ordem', () => {
    const agora = 1_000_000;
    expect(
      shouldTriggerConsciousPause([agora, agora - 5 * MIN, agora - 10 * MIN], agora),
    ).toBe(true);
  });

  it('constantes seguem a spec (3 mudancas, 15 min, pausa de 2 min)', () => {
    expect(FOCUS_TRIGGER_COUNT).toBe(3);
    expect(FOCUS_TRIGGER_WINDOW_MS).toBe(15 * 60_000);
    expect(CONSCIOUS_PAUSE_SECONDS).toBe(120);
  });
});

describe('distractionsInWindow', () => {
  it('conta so as perdas dentro da janela', () => {
    const agora = 1_000_000;
    expect(
      distractionsInWindow(
        [agora - 60 * MIN, agora - 10 * MIN, agora - MIN, agora],
        agora,
      ),
    ).toBe(3);
  });
});

describe('distractionStage (alerta progressivo)', () => {
  it('escala sem pular etapas', () => {
    expect(distractionStage(0)).toBe('calmo');
    expect(distractionStage(1)).toBe('aviso-leve');
    expect(distractionStage(2)).toBe('aviso-final');
    expect(distractionStage(3)).toBe('pausa');
    expect(distractionStage(9)).toBe('pausa');
  });
});

describe('formatFocusTime', () => {
  it('formata mm:ss com zero a esquerda', () => {
    expect(formatFocusTime(0)).toBe('00:00');
    expect(formatFocusTime(65)).toBe('01:05');
    expect(formatFocusTime(1500)).toBe('25:00');
  });

  it('trava negativos em zero', () => {
    expect(formatFocusTime(-10)).toBe('00:00');
  });
});

describe('toFocusedMinutes / buildSessionMetrics', () => {
  it('converte segundos em minutos inteiros (piso)', () => {
    expect(toFocusedMinutes(1500)).toBe(25);
    expect(toFocusedMinutes(1540)).toBe(25);
    expect(toFocusedMinutes(59)).toBe(0);
  });

  it('monta o payload de encerramento para focus_metrics', () => {
    const m = buildSessionMetrics(1500, 3, new Date('2026-09-10T22:00:00Z').getTime());
    expect(m).toEqual({ sessionDate: '2026-09-10', focusedMinutes: 25, distractionCount: 3 });
  });

  it('normaliza contagem negativa', () => {
    expect(buildSessionMetrics(600, -2).distractionCount).toBe(0);
  });
});
