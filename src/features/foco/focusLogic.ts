/**
 * MODO FOCO CONSCIENTE — lógica pura (testável sem navegador).
 *
 * Regra de intervenção: 3 ou mais perdas de foco (mudanças de aba /
 * `visibilitychange` para `hidden`) dentro de uma janela deslizante de
 * 15 minutos disparam a micro-pausa consciente.
 *
 * Separada do hook de propósito: o hook cuida de DOM/timer, aqui fica a
 * decisão — igual ao padrão de `idleTracker.avaliarOciosidade`.
 */

/** Quantas perdas de foco disparam a pausa. */
export const FOCUS_TRIGGER_COUNT = 3;

/** Janela deslizante da regra (15 minutos em ms). */
export const FOCUS_TRIGGER_WINDOW_MS = 15 * 60_000;

/** Duração da micro-pausa de respiração (2 minutos em segundos). */
export const CONSCIOUS_PAUSE_SECONDS = 120;

/**
 * Decide se a micro-pausa deve aparecer.
 *
 * @param distractions timestamps (ms) das perdas de foco, em qualquer ordem.
 * @param agora referência temporal (default: Date.now()).
 */
export function shouldTriggerConsciousPause(
  distractions: readonly number[],
  agora: number = Date.now(),
): boolean {
  const inicioJanela = agora - FOCUS_TRIGGER_WINDOW_MS;
  let dentro = 0;
  for (const t of distractions) {
    if (t >= inicioJanela && t <= agora) {
      dentro += 1;
      if (dentro >= FOCUS_TRIGGER_COUNT) return true;
    }
  }
  return false;
}

/** Quantas perdas de foco estão dentro da janela atual (para a UI). */
export function distractionsInWindow(
  distractions: readonly number[],
  agora: number = Date.now(),
): number {
  const inicioJanela = agora - FOCUS_TRIGGER_WINDOW_MS;
  return distractions.filter((t) => t >= inicioJanela && t <= agora).length;
}

/**
 * Estágio do alerta progressivo a partir da contagem na janela.
 *
 * A intervenção escala em vez de ir de 0 a 100 de uma vez:
 *  - `calmo`: nenhuma perda recente, nada a dizer;
 *  - `aviso-leve`: 1ª perda — toast sutil, sem culpa;
 *  - `aviso-final`: 2ª perda — avisa que a pausa vem na próxima;
 *  - `pausa`: 3ª perda — abre o `ConsciousPauseOverlay`.
 */
export type DistractionStage = 'calmo' | 'aviso-leve' | 'aviso-final' | 'pausa';

export function distractionStage(inWindow: number): DistractionStage {
  if (inWindow >= FOCUS_TRIGGER_COUNT) return 'pausa';
  if (inWindow === 2) return 'aviso-final';
  if (inWindow === 1) return 'aviso-leve';
  return 'calmo';
}

/** Formata segundos como `mm:ss` para o cronômetro. */
export function formatFocusTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Converte segundos de foco em minutos inteiros para `focus_metrics`. */
export function toFocusedMinutes(totalSeconds: number): number {
  return Math.max(0, Math.floor(Math.max(0, totalSeconds) / 60));
}

export interface FocusSessionMetrics {
  /** Data da sessão (YYYY-MM-DD). */
  sessionDate: string;
  /** Minutos de foco contínuo acumulados. */
  focusedMinutes: number;
  /** Total de perdas de foco da sessão. */
  distractionCount: number;
}

/** Monta o payload de encerramento de sessão a partir do estado do hook. */
export function buildSessionMetrics(
  focusSeconds: number,
  distractionCount: number,
  agora: number = Date.now(),
): FocusSessionMetrics {
  return {
    sessionDate: new Date(agora).toISOString().slice(0, 10),
    focusedMinutes: toFocusedMinutes(focusSeconds),
    distractionCount: Math.max(0, Math.floor(distractionCount)),
  };
}
