/**
 * Marcos de XP: a comemoração de "chegou a 1.000 XP".
 *
 * O nível sobe cada vez mais devagar (100, 200, 300... por nível), e
 * depois do nível 6 o aluno pode passar uma semana sem ver festa nenhuma.
 * O marco redondo de XP é a recompensa que continua aparecendo.
 */
export const PASSO_MARCO_XP = 1000;

/** O marco cruzado entre dois saldos de XP (o maior, se cruzou vários), ou null. */
export function marcoCruzado(antes: number, depois: number, passo = PASSO_MARCO_XP): number | null {
  if (!(depois > antes) || passo <= 0) return null;
  const marcoAntes = Math.floor(Math.max(0, antes) / passo);
  const marcoDepois = Math.floor(depois / passo);
  return marcoDepois > marcoAntes ? marcoDepois * passo : null;
}

/** 1000 -> "1.000": o separador de milhar brasileiro, sem depender do Intl do aparelho. */
export function formatarXp(xp: number): string {
  return String(Math.round(xp)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
