/**
 * Lógica da Central (tela inicial do aluno), fora do componente para ter
 * teste.
 */

/** Cumprimento pela hora local. O app é de quem estuda à noite: a hora
 *  importa (e a Central fala de sono logo abaixo). */
export function saudacao(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export interface DiaDeAtividade {
  /** Rótulo curto do dia ("seg", "ter"...). */
  rotulo: string;
  /** Quantas atividades registradas naquele dia. */
  total: number;
  hoje: boolean;
}

/**
 * Os últimos 7 dias (de 6 dias atrás até hoje) com a contagem de cada um.
 *
 * O total da semana é a SOMA destes 7 dias. Antes a tela mostrava
 * "Total 7 dias" com `logs.length`, que conta tudo o que está carregado,
 * inclusive o que é mais antigo que a semana: o número crescia sem parar
 * e dizia "7 dias".
 */
export function atividadeDaSemana(
  logs: { timestamp: number }[],
  agora: Date = new Date(),
): { dias: DiaDeAtividade[]; totalSemana: number; totalHoje: number } {
  const dias: DiaDeAtividade[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
    const inicio = d.getTime();
    const fim = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    dias.push({
      rotulo: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3),
      total: logs.filter((l) => l.timestamp >= inicio && l.timestamp < fim).length,
      hoje: i === 0,
    });
  }
  const totalSemana = dias.reduce((s, d) => s + d.total, 0);
  return { dias, totalSemana, totalHoje: dias[6].total };
}

/** "1 atividade", "3 atividades". */
export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/**
 * Faixa do índice de sobrecarga declarado (sono, cansaço e humor).
 *
 * O cartão chamava isto de "Prontidão (SSC)", mas o número sobe quando a
 * pessoa está PIOR (é sobrecarga, não prontidão): "Prontidão 85%" queria
 * dizer "risco crítico". O nome agora diz o que o número mede.
 */
export function faixaSobrecarga(score: number): { rotulo: string; tom: 'ok' | 'atencao' | 'risco' } {
  if (score < 40) return { rotulo: 'tranquila', tom: 'ok' };
  if (score < 70) return { rotulo: 'pedindo atenção', tom: 'atencao' };
  return { rotulo: 'alta', tom: 'risco' };
}
