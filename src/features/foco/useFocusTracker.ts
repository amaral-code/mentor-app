import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FOCUS_TRIGGER_WINDOW_MS,
  buildSessionMetrics,
  distractionsInWindow,
  shouldTriggerConsciousPause,
  type FocusSessionMetrics,
} from './focusLogic';

export interface UseFocusTrackerOptions {
  /** Inicia o cronômetro ao montar. Default: true. */
  autoStart?: boolean;
  /** Chamado uma vez quando a regra 3-em-15min dispara. */
  onTriggerPause?: () => void;
  /**
   * Chamado a cada nova perda de foco com a contagem dentro da janela.
   * Base do alerta progressivo (toast sutil na 1ª, aviso na 2ª).
   */
  onDistraction?: (inWindow: number) => void;
}

export interface UseFocusTrackerReturn {
  /** Segundos de foco acumulados (só contam com a aba visível). */
  focusSeconds: number;
  /** Alias de `focusSeconds` — tempo de foco contínuo da sessão. */
  continuousFocusSeconds: number;
  /** Total de perdas de foco (mudanças de aba) na sessão. */
  distractionCount: number;
  /** Timestamps (ms) das perdas de foco — base da janela de 15 min. */
  distractions: number[];
  /** Se a sessão está cronometrando. */
  isTracking: boolean;
  /** Verdadeiro quando a regra 3-em-15min disparou e ainda não foi resolvida. */
  shouldPause: boolean;
  start: () => void;
  stop: () => FocusSessionMetrics;
  reset: () => void;
  /** Fecha a micro-pausa e recomeça a janela (evita loop imediato). */
  dismissPause: () => void;
  /** Métricas prontas para salvar no Supabase ao encerrar. */
  sessionMetrics: FocusSessionMetrics;
}

/**
 * MODO FOCO CONSCIENTE — monitoramento de atenção.
 *
 * Usa `visibilitychange`: quando o documento vai para `hidden` (troca de
 * aba, outra aplicação, minimizar), registra uma perda de foco. O
 * cronômetro só avança com a aba visível, então "foco contínuo" é tempo
 * real de atenção — não tempo de parede.
 *
 * Quando 3 perdas acontecem em menos de 15 minutos, `shouldPause` vira
 * `true` (e `onTriggerPause` dispara uma vez) para a tela exibir o
 * `ConsciousPauseOverlay`.
 */
export function useFocusTracker(options: UseFocusTrackerOptions = {}): UseFocusTrackerReturn {
  const { autoStart = true, onTriggerPause, onDistraction } = options;

  const [focusSeconds, setFocusSeconds] = useState(0);
  const [distractions, setDistractions] = useState<number[]>([]);
  const [isTracking, setIsTracking] = useState(autoStart);
  const [shouldPause, setShouldPause] = useState(false);

  // Espelhos síncronos: `stop()` precisa devolver as métricas na hora,
  // mas setState é assíncrono — os refs carregam o valor corrente.
  const focusRef = useRef(0);
  const distractionsRef = useRef<number[]>([]);
  const pausedRef = useRef(false);
  const onTriggerRef = useRef(onTriggerPause);
  onTriggerRef.current = onTriggerPause;
  const onDistractionRef = useRef(onDistraction);
  onDistractionRef.current = onDistraction;

  const registrarPerdaDeFoco = useCallback(() => {
    const agora = Date.now();
    // Cálculo síncrono fora de updater: o ref é a fonte da verdade para
    // `stop()` (sem stale closure) e o updater continua puro — seguro no
    // StrictMode, que pode reinvocar updaters.
    const recentes = [...distractionsRef.current, agora].filter(
      (t) => t >= agora - FOCUS_TRIGGER_WINDOW_MS * 2,
    );
    distractionsRef.current = recentes;
    setDistractions(recentes);
    onDistractionRef.current?.(distractionsInWindow(recentes, agora));
  }, []);

  // Avalia o gatilho 3-em-15min a cada mudança (efeito, nunca no updater).
  useEffect(() => {
    if (!pausedRef.current && shouldTriggerConsciousPause(distractions, Date.now())) {
      pausedRef.current = true;
      setShouldPause(true);
      onTriggerRef.current?.();
    }
  }, [distractions]);

  // Detector de troca de aba / minimizar / outra aplicação.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') registrarPerdaDeFoco();
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, [registrarPerdaDeFoco]);

  // Cronômetro: avança 1s por vez, só com aba visível e rastreio ativo.
  useEffect(() => {
    if (!isTracking) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      focusRef.current += 1;
      setFocusSeconds(focusRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTracking]);

  const start = useCallback(() => setIsTracking(true), []);

  const stop = useCallback((): FocusSessionMetrics => {
    setIsTracking(false);
    return buildSessionMetrics(focusRef.current, distractionsRef.current.length);
  }, []);

  const reset = useCallback(() => {
    focusRef.current = 0;
    distractionsRef.current = [];
    setFocusSeconds(0);
    setDistractions([]);
    setShouldPause(false);
    pausedRef.current = false;
    setIsTracking(true);
  }, []);

  const dismissPause = useCallback(() => {
    // Recomeça a janela do zero: sem isso, as mesmas 3 marcas
    // redisparariam a pausa no segundo seguinte ao fechar o modal.
    distractionsRef.current = [];
    setDistractions([]);
    setShouldPause(false);
    pausedRef.current = false;
  }, []);

  return {
    focusSeconds,
    continuousFocusSeconds: focusSeconds,
    distractionCount: distractions.length,
    distractions,
    isTracking,
    shouldPause,
    start,
    stop,
    reset,
    dismissPause,
    sessionMetrics: buildSessionMetrics(focusSeconds, distractions.length),
  };
}
