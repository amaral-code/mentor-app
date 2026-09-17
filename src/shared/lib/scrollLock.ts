/**
 * Trava de rolagem do fundo, CONTADA.
 *
 * ------------------------------------------------------------------
 * O BUG QUE ISTO RESOLVE
 * ------------------------------------------------------------------
 * Vários componentes travam a rolagem ao abrir: o drawer do menu no
 * mobile e cada `Modal` (relatório semanal, Notebook Studio, personas...).
 * Todos escreviam direto em `document.body.style.overflow`, e o último a
 * FECHAR mandava em todos:
 *
 *   1. abre o modal A            -> overflow: hidden
 *   2. abre o modal B            -> overflow: hidden
 *   3. fecha o modal A           -> overflow: ''     <- B continua aberto,
 *                                                      mas a página de trás
 *                                                      volta a rolar
 *
 * O mesmo acontecia entre o drawer e qualquer modal aberto por cima dele.
 *
 * Com um contador, destravar só acontece quando o ÚLTIMO interessado
 * solta. O valor original é guardado na primeira trava e restaurado na
 * última, em vez de ser sobrescrito por string vazia.
 */

let travas = 0;
let overflowOriginal = '';

/** Trava a rolagem do body. Devolve a função que solta esta trava. */
export function travarRolagem(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (travas === 0) {
    overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  travas += 1;

  /* Idempotente: o React 18+ pode rodar o cleanup de um efeito mais de uma
     vez (StrictMode, remontagem). Sem esta guarda, um cleanup repetido
     derrubaria o contador abaixo de zero e destravaria cedo demais. */
  let soltou = false;
  return () => {
    if (soltou) return;
    soltou = true;
    travas = Math.max(0, travas - 1);
    if (travas === 0) document.body.style.overflow = overflowOriginal;
  };
}
