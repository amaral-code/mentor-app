/**
 * Atalhos de teclado do quiz no notebook (#35).
 *
 * 1 a 5 ou A a E respondem; Enter, espaço ou seta para a direita passam
 * para a próxima depois de responder. Antes de responder, Enter não faz
 * nada: um Enter apertado por engano marcaria uma alternativa que a
 * pessoa nem leu.
 */
export type AcaoQuiz = { tipo: 'responder'; indice: number } | { tipo: 'proxima' } | null;

export function acaoDaTecla(
  tecla: string,
  estado: { respondida: boolean; alternativas: number },
  modificadores: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {},
): AcaoQuiz {
  // Ctrl+1 troca de aba no navegador; não é do app.
  if (modificadores.ctrl || modificadores.meta || modificadores.alt) return null;
  if (estado.respondida) {
    return tecla === 'Enter' || tecla === ' ' || tecla === 'ArrowRight' ? { tipo: 'proxima' } : null;
  }
  let indice = -1;
  if (/^[1-9]$/.test(tecla)) indice = Number(tecla) - 1;
  else if (/^[a-z]$/i.test(tecla)) indice = tecla.toLowerCase().charCodeAt(0) - 97;
  return indice >= 0 && indice < estado.alternativas ? { tipo: 'responder', indice } : null;
}
