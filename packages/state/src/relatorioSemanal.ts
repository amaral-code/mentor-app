/**
 * Texto do relatório de descompressão da semana: existente, IA ou local.
 *
 * Morava dentro do WeeklyReportModal do web. O celular abre o mesmo
 * relatório na sexta, e as duas telas precisam da mesma ordem: o texto
 * já gerado desta semana nunca é pedido de novo à IA (seria um segundo
 * parágrafo, diferente, para a mesma semana, e uma chamada paga à toa).
 */
import { aiAvailable, gerarRelatorioDescompressao } from '@mentor/core/aiService';
import { inicioDaSemana, textoLocalDescompressao } from '@mentor/core/decompressionReport';
import type { MetricasDescompressao } from '@mentor/core/types';
import { bemEstarRepository } from '@mentor/api/BemEstarRepository';
import { useBemEstarStore } from './bemEstarStore';

export async function textoDoRelatorioDaSemana(
  metricas: MetricasDescompressao,
  apiKey: string,
  primeiroNome?: string,
): Promise<string> {
  const semana = inicioDaSemana();
  const existente = useBemEstarStore.getState().relatorios.find((r) => r.semanaInicio === semana);
  if (existente) return existente.textoGerado;

  let texto = textoLocalDescompressao(metricas, primeiroNome);
  if (aiAvailable(apiKey)) {
    try {
      texto = await gerarRelatorioDescompressao(metricas, apiKey, primeiroNome);
    } catch {
      /* fica o texto local, escrito sob as mesmas regras */
    }
  }
  try {
    const salvo = await bemEstarRepository.salvarRelatorio(semana, texto, metricas);
    if (salvo) useBemEstarStore.getState().adicionarRelatorio(salvo);
  } catch {
    /* o relatório já está na tela; não ter sido arquivado não muda a leitura */
  }
  return texto;
}
