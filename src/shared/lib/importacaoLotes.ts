/**
 * Importação de turma em LOTES.
 *
 * A planilha inteira ia num pedido só, e o servidor tem teto de tempo
 * por pedido. Cada aluno custa várias chamadas (conta do aluno, conta do
 * responsável, link e e-mail), então uma turma de tamanho real estourava
 * o teto no meio: a secretaria via "falha de rede" com parte das contas
 * já criadas e sem relatório nenhum.
 *
 * Em lotes pequenos cada pedido termina com folga, e o relatório parcial
 * sobrevive se um lote falhar.
 */

/** Alunos por pedido. Com o teto de 60s do servidor sobra margem larga. */
export const TAMANHO_DO_LOTE = 8;

export function dividirEmLotes<T>(itens: T[], tamanho = TAMANHO_DO_LOTE): T[][] {
  const passo = Math.max(1, Math.floor(tamanho));
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += passo) lotes.push(itens.slice(i, i + passo));
  return lotes;
}

export interface RelatorioDeLote {
  escola?: string;
  codigoInstituicao?: string;
  criados?: number;
  emailsEnviados?: number;
  emailConfigurado?: boolean;
  normalizadoPorIA?: boolean;
  resultados?: { linha: number }[];
}

/**
 * Soma os relatórios e renumera as linhas pela posição na planilha
 * inteira: cada lote numera a partir de 1, e sem isso o relatório diria
 * "linha 3" para o aluno da linha 19.
 */
export function juntarRelatorios<R extends RelatorioDeLote>(lotes: R[], tamanho = TAMANHO_DO_LOTE): R | null {
  if (lotes.length === 0) return null;
  const base = { ...lotes[0] };
  base.criados = 0;
  base.emailsEnviados = 0;
  base.normalizadoPorIA = false;
  const resultados: { linha: number }[] = [];
  lotes.forEach((lote, i) => {
    base.criados = (base.criados ?? 0) + (lote.criados ?? 0);
    base.emailsEnviados = (base.emailsEnviados ?? 0) + (lote.emailsEnviados ?? 0);
    base.normalizadoPorIA = base.normalizadoPorIA || !!lote.normalizadoPorIA;
    for (const r of lote.resultados ?? []) resultados.push({ ...r, linha: i * tamanho + r.linha });
  });
  base.resultados = resultados as R['resultados'];
  return base;
}
