/**
 * Medição do escudo SEM módulo nativo (web e Expo Go): o tempo com o app
 * em segundo plano.
 *
 * É uma aproximação, e mais generosa do que o certo: trocar de aba ou de
 * app também conta como "longe". Por isso a tela avisa quando a medição
 * não é nativa, e o servidor limita o pagamento ao tempo que ele viu
 * passar (031). Ainda assim é mais justo que o web antigo, que pagava a
 * sessão inteira, com o aluno olhando a tela ou não.
 *
 * Máquina de estado pura: recebe os instantes, não lê relógio.
 */
export interface Medidor {
  /** O app foi para segundo plano em `t` (ms). */
  saiu(t: number): void;
  /** O app voltou em `t`: fecha o período e conta uma interrupção. */
  voltou(t: number): void;
  minutosOffline(t: number): number;
  interrupcoes(): number;
  noFundo(): boolean;
}

export function criarMedidor(): Medidor {
  let desde: number | null = null;
  let acumulado = 0;
  let voltas = 0;
  return {
    saiu(t) {
      if (desde === null) desde = t;
    },
    voltou(t) {
      if (desde === null) return;
      acumulado += Math.max(0, t - desde);
      desde = null;
      voltas += 1;
    },
    minutosOffline(t) {
      return (acumulado + (desde !== null ? Math.max(0, t - desde) : 0)) / 60_000;
    },
    interrupcoes: () => voltas,
    noFundo: () => desde !== null,
  };
}
