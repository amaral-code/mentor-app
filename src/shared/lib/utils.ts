export function calcLevel(xp: number): { level: number; remainder: number } {
  let level = 1;
  let remainder = xp;
  while (remainder >= 100 * level) {
    remainder -= 100 * level;
    level++;
  }
  return { level, remainder };
}

/** Data LOCAL do aparelho como `AAAA-MM-DD`. */
export function paraDiaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getToday(): string {
  return paraDiaLocal(new Date());
}

/**
 * Próximo valor do streak diário.
 *
 * ------------------------------------------------------------------
 * POR QUE A DATA É SEMPRE LOCAL
 * ------------------------------------------------------------------
 * A versão anterior comparava `getToday()` (data LOCAL do aparelho) com
 * um "ontem" calculado por `toISOString()` (data UTC). Os dois só
 * coincidem em parte do dia, e num fuso a oeste de Greenwich eles
 * divergem justamente à noite:
 *
 *   Aluno em UTC-3, 22h de terça, entrou pela última vez na segunda.
 *     getToday()                     -> terça   (local)
 *     ontem via toISOString()        -> terça   (porque 22h-3 já é
 *                                                quarta 01h em UTC)
 *     "segunda === terça"?           -> não     -> streak volta para 1
 *
 * Ou seja: quem estudava depois das 21h PERDIA a sequência todo dia,
 * exatamente o público que este app existe para atender.
 *
 * Aqui os dois lados usam o mesmo calendário local, então a comparação
 * é honesta. Função pura para poder ser testada com datas fixas.
 */
export function proximoStreak(ultimoAcesso: string, streakAtual: number, agora: Date = new Date()): number {
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  // Entrou ontem, a sequência continua; qualquer buraco maior recomeça.
  return ultimoAcesso === paraDiaLocal(ontem) ? streakAtual + 1 : 1;
}

export const MOOD_LABEL: Record<string, string> = {
  stress: 'Estressado', anxiety: 'Ansioso', sadness: 'Triste', tired: 'Cansado',
  demotivated: 'Desmotivado', focused: 'Focado', motivated: 'Motivado',
  happy: 'Feliz', energetic: 'Energético', neutral: 'Tranquilo',
};

/*
 * MOOD_EMOJI foi removido.
 *
 * Cada sistema operacional desenhava os rostos de um jeito, entao o mesmo
 * humor tinha aparencias diferentes, e o leitor de tela anunciava "rosto
 * desanimado" no meio da frase. O substituto e <MoodIcon /> em
 * shared/ui/AppIcon.tsx, que usa as cores ja definidas em MOOD_COLOR.
 */

export const MOOD_COLOR: Record<string, string> = {
  stress: '#ef4444', anxiety: '#f59e0b', sadness: '#a855f7', tired: '#a855f7',
  demotivated: '#a855f7', focused: '#10b981', motivated: '#10b981',
  happy: '#10b981', energetic: '#10b981', neutral: '#475569',
};
