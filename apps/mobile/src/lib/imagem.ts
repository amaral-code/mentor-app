/**
 * Contas de imagem antes do envio (puras, testáveis sem aparelho).
 *
 * Foto de celular sai com 12 MP e 4 a 6 MB. O servidor recusa acima do
 * teto da redação, e a rede 4G do aluno leva dezenas de segundos para
 * subir isso: o "foto até correção em menos de 30 s" (#39) depende de a
 * foto sair daqui com algumas centenas de KB.
 */

/** Lado maior da foto enviada. 1600px ainda deixa a letra cursiva legível para o OCR. */
export const LADO_MAXIMO = 1600;

export function dimensoesParaEnvio(largura: number, altura: number, ladoMaximo = LADO_MAXIMO): { largura: number; altura: number } {
  if (!(largura > 0) || !(altura > 0)) return { largura: ladoMaximo, altura: ladoMaximo };
  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo) return { largura: Math.round(largura), altura: Math.round(altura) };
  const fator = ladoMaximo / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

/** Proporção da folha A4 (largura / altura), a da guia de enquadramento. */
export const PROPORCAO_A4 = 210 / 297;

/**
 * Retângulo da foto que corresponde à guia desenhada na câmera: o maior
 * retângulo na proporção da folha, centralizado, com uma margem de
 * folga. Cortar fora a mesa e o fundo tira do OCR o que não é redação.
 */
export function recorteDaGuia(
  largura: number,
  altura: number,
  proporcao = PROPORCAO_A4,
  margem = 0.04,
): { originX: number; originY: number; width: number; height: number } {
  let w = largura;
  let h = w / proporcao;
  if (h > altura) {
    h = altura;
    w = h * proporcao;
  }
  // Folga: a folha raramente fica perfeita dentro da guia.
  w = Math.min(largura, w * (1 + margem));
  h = Math.min(altura, h * (1 + margem));
  return {
    originX: Math.round((largura - w) / 2),
    originY: Math.round((altura - h) / 2),
    width: Math.round(w),
    height: Math.round(h),
  };
}

/** Tamanho aproximado, em bytes, de um conteúdo em base64. */
export function bytesDoBase64(base64: string): number {
  const limpo = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const preenchimento = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0;
  return Math.floor((limpo.length * 3) / 4) - preenchimento;
}
