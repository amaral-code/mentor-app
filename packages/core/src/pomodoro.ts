/**
 * Pomodoro calculado a partir do instante de início.
 *
 * Nada de "decrementar um contador a cada segundo": com a tela apagada o
 * JavaScript do celular para, e o contador voltaria atrasado. Aqui a fase
 * e o tempo restante saem de (agora - início), então o timer volta certo
 * depois de qualquer suspensão, inclusive com o app fechado no meio.
 */
export interface ConfigPomodoro {
  focoMin: number;
  pausaMin: number;
  pausaLongaMin: number;
  /** A cada quantos focos vem a pausa longa. */
  ciclosAteLonga: number;
}

export const POMODORO_PADRAO: ConfigPomodoro = { focoMin: 25, pausaMin: 5, pausaLongaMin: 15, ciclosAteLonga: 4 };

export type FasePomodoro = 'foco' | 'pausa' | 'pausaLonga';

export interface EstadoPomodoro {
  fase: FasePomodoro;
  /** Número do bloco de foco atual (ou do que acabou de terminar, na pausa). Começa em 1. */
  ciclo: number;
  restanteSeg: number;
  duracaoSeg: number;
  /** Minutos de foco já concluídos (blocos inteiros). */
  focoConcluidoMin: number;
}

export function estadoDoPomodoro(inicioMs: number, agoraMs: number, cfg: ConfigPomodoro = POMODORO_PADRAO): EstadoPomodoro {
  let decorrido = Math.max(0, Math.floor((agoraMs - inicioMs) / 1000));
  const foco = cfg.focoMin * 60;
  let ciclo = 1;
  let focoConcluido = 0;
  // Uma volta = foco + a pausa que vem depois dele.
  for (;;) {
    if (decorrido < foco) {
      return { fase: 'foco', ciclo, restanteSeg: foco - decorrido, duracaoSeg: foco, focoConcluidoMin: focoConcluido };
    }
    decorrido -= foco;
    focoConcluido += cfg.focoMin;
    const longa = ciclo % cfg.ciclosAteLonga === 0;
    const pausa = (longa ? cfg.pausaLongaMin : cfg.pausaMin) * 60;
    if (decorrido < pausa) {
      return { fase: longa ? 'pausaLonga' : 'pausa', ciclo, restanteSeg: pausa - decorrido, duracaoSeg: pausa, focoConcluidoMin: focoConcluido };
    }
    decorrido -= pausa;
    ciclo += 1;
  }
}
