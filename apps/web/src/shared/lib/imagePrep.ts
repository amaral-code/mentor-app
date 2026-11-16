/**
 * PREPARO DA FOTO DA REDACAO NO CLIENTE.
 *
 * Uma foto de celular de folha de caderno chega com 8 a 12 MP e 4-6 MB.
 * Subir isso em 4G, na varanda, as 23h, e o que faz o aluno desistir no
 * meio - e o modelo nao le nada melhor por causa dos pixels a mais.
 *
 * O QUE E FEITO, E POR QUE NESTA ORDEM
 * 1. REDIMENSIONA para 1600 px no lado maior. Letra cursiva de caderno
 *    ocupa uns 40 px de altura nesse tamanho, bem acima do que o OCR
 *    precisa; acima disso so se paga banda.
 * 2. TONS DE CINZA. Papel pautado tem azul da pauta e amarelo do papel:
 *    a cor atrapalha a leitura do traco em vez de ajudar.
 * 3. ALONGA OS NIVEIS (autocontraste por percentil) em vez de aplicar
 *    limiar. Binarizar parece melhor na tela e apaga lapis fraco e
 *    acento - justamente o que decide competencia 1.
 * 4. JPEG 0.82. Acima disso o arquivo cresce sem ganho visivel de OCR.
 *
 * As funcoes de calculo sao puras e ficam separadas do canvas para
 * poderem ser testadas sem navegador.
 */

export interface OpcoesPreparo {
  /** Maior dimensao permitida, em pixels. */
  ladoMaximo?: number;
  /** Qualidade do JPEG (0-1). */
  qualidade?: number;
  /** Percentual de pixels descartados em cada ponta ao alongar niveis. */
  corte?: number;
  /** Desliga o tratamento e so redimensiona (util para depurar). */
  semTratamento?: boolean;
}

export const PADROES: Required<OpcoesPreparo> = {
  ladoMaximo: 1600,
  qualidade: 0.82,
  corte: 0.005,
  semTratamento: false,
};

export interface ResultadoPreparo {
  arquivo: File;
  largura: number;
  altura: number;
  bytesAntes: number;
  bytesDepois: number;
  /** Quanto encolheu, para a interface poder dizer "5,2 MB -> 480 kB". */
  reducao: number;
}

/** Redimensionamento proporcional, sem ampliar imagem pequena. */
export function calcularDimensoes(
  largura: number,
  altura: number,
  ladoMaximo = PADROES.ladoMaximo,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo || maior === 0) {
    return { largura: Math.round(largura), altura: Math.round(altura) };
  }
  const escala = ladoMaximo / maior;
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

/**
 * Encontra os limites de preto e branco descartando as pontas do
 * histograma.
 *
 * O corte por percentil existe porque quase toda foto tem alguns pixels
 * extremos - um brilho da lampada, uma sombra na dobra da folha. Usar o
 * minimo e o maximo absolutos deixaria esses poucos pixels definirem o
 * contraste da pagina inteira, e o resultado sai lavado.
 */
export function limitesDoHistograma(
  histograma: ArrayLike<number>,
  totalPixels: number,
  corte = PADROES.corte,
): { preto: number; branco: number } {
  const alvo = Math.max(1, Math.floor(totalPixels * corte));

  let acumulado = 0;
  let preto = 0;
  for (let i = 0; i < 256; i++) {
    acumulado += histograma[i] ?? 0;
    if (acumulado >= alvo) {
      preto = i;
      break;
    }
  }

  acumulado = 0;
  let branco = 255;
  for (let i = 255; i >= 0; i--) {
    acumulado += histograma[i] ?? 0;
    if (acumulado >= alvo) {
      branco = i;
      break;
    }
  }

  // Faixa degenerada (folha quase uniforme): devolve a escala inteira em
  // vez de dividir por zero mais adiante.
  if (branco - preto < 16) return { preto: 0, branco: 255 };
  return { preto, branco };
}

/** Tabela de 256 posicoes que mapeia cinza de entrada em cinza de saida. */
export function tabelaDeNiveis(preto: number, branco: number): Uint8ClampedArray {
  const tabela = new Uint8ClampedArray(256);
  const faixa = Math.max(1, branco - preto);
  for (let i = 0; i < 256; i++) {
    tabela[i] = Math.round(((i - preto) / faixa) * 255);
  }
  return tabela;
}

/** Luminancia perceptual (Rec. 601) - o verde pesa mais para o olho. */
export function paraCinza(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function extensaoDe(tipo: string): string {
  return tipo.includes('png') ? 'png' : 'jpg';
}

/**
 * Prepara a foto para envio.
 *
 * Usa createImageBitmap com `imageOrientation: 'from-image'`: sem isso, a
 * foto tirada com o celular deitado chega girada 90 graus e o modelo
 * tenta ler o texto de lado.
 */
export async function prepararFotoRedacao(
  arquivo: File,
  opcoes: OpcoesPreparo = {},
): Promise<ResultadoPreparo> {
  const cfg = { ...PADROES, ...opcoes };
  const bytesAntes = arquivo.size;

  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const { largura, altura } = calcularDimensoes(bitmap.width, bitmap.height, cfg.ladoMaximo);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Nao foi possivel preparar a imagem neste navegador.');

  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();

  if (!cfg.semTratamento) {
    const imagem = ctx.getImageData(0, 0, largura, altura);
    const px = imagem.data;

    // Passada 1: converte para cinza e monta o histograma.
    const histograma = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const cinza = paraCinza(px[i], px[i + 1], px[i + 2]) | 0;
      px[i] = px[i + 1] = px[i + 2] = cinza;
      histograma[cinza]++;
    }

    // Cede a thread entre as passadas: em foto 1600px sao ~2,5M pixels por
    // loop na thread principal. Sem este respiro, o "Preparando a foto..."
    // nunca pinta e a UI parece congelada no celular mais fraco.
    await new Promise((r) => setTimeout(r, 0));

    // Passada 2: alonga os niveis com a tabela calculada.
    const { preto, branco } = limitesDoHistograma(histograma, largura * altura, cfg.corte);
    const tabela = tabelaDeNiveis(preto, branco);
    for (let i = 0; i < px.length; i += 4) {
      const v = tabela[px[i]];
      px[i] = px[i + 1] = px[i + 2] = v;
    }

    ctx.putImageData(imagem, 0, 0);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', cfg.qualidade),
  );
  if (!blob) throw new Error('Nao foi possivel comprimir a imagem.');

  const nome = arquivo.name.replace(/\.[^.]+$/, '') || 'redacao';
  const preparado = new File([blob], `${nome}.${extensaoDe('image/jpeg')}`, { type: 'image/jpeg' });

  return {
    arquivo: preparado,
    largura,
    altura,
    bytesAntes,
    bytesDepois: preparado.size,
    reducao: bytesAntes > 0 ? 1 - preparado.size / bytesAntes : 0,
  };
}

/** "4,8 MB", "512 kB" - para a tela mostrar o ganho da compressao. */
export function formatarBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.round(bytes / 1024)} kB`;
}
