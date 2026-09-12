/**
 * EPICO 2: Termometro cognitivo (filtro anti-vigilancia).
 *
 * Duas fontes, mesmo efeito:
 *  1. `extrairFrustracao` - bloco `frustracao` que o modelo apende quando o
 *     system instruction (server/chatPrompt.js) detecta frustracao. O bloco
 *     e removido antes de exibir; sobra a flag.
 *  2. `heuristicaFrustracao` - fallback local sem IA: respostas curtas
 *     repetitivas ou vocabulario de desistência nas ultimas mensagens do
 *     aluno. Cobre o caminho sem worker e o modelo que nao emitiu o bloco.
 *
 * Nenhum dos dois bloqueia, pune ou registra algo punitivo: so decidem se
 * o ConsciousPauseModal (pausa de 60s, dispensavel) aparece.
 */

export interface FrustracaoExtraida {
  textoLimpo: string;
  frustrationDetected: boolean;
}

const BLOCO = /```frustracao\s*([\s\S]*?)```/gi;

/** Separa o bloco da resposta exibivel. Funcao pura. */
export function extrairFrustracao(texto: string): FrustracaoExtraida {
  const bruto = String(texto || '');
  let detectado = false;
  const m = /```frustracao\s*([\s\S]*?)```/i.exec(bruto);
  if (m) {
    try {
      detectado = (JSON.parse(m[1].trim()) as { frustration_detected?: unknown }).frustration_detected === true;
    } catch {
      detectado = /frustration_detected/i.test(m[1]) && /true/i.test(m[1]);
    }
  }
  return { textoLimpo: bruto.replace(BLOCO, '').trim(), frustrationDetected: detectado };
}

const SINAIS_FORTES =
  /(desisto|não aguento|nao aguento|odeio|burro|idiota|merda|raiva|desistir|largar tudo|quero chorar|estou chorando|nunca vou conseguir|não consigo|nao consigo|sou péssimo|sou pessimo)/i;

/**
 * Heuristica local sobre as ultimas mensagens do ALUNO.
 * Verdadeiro quando: 3+ respostas seguidas curtissimas (<=12 chars) OU
 * vocabulario de frustracao/desistencia. Funcao pura.
 */
export function heuristicaFrustracao(mensagensDoAluno: string[]): boolean {
  const recentes = mensagensDoAluno.filter((t) => t.trim()).slice(-4);
  if (recentes.length === 0) return false;
  if (recentes.some((t) => SINAIS_FORTES.test(t))) return true;
  const curtas = recentes.slice(-3);
  return curtas.length >= 3 && curtas.every((t) => t.trim().length <= 12);
}
