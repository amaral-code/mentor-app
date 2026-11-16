/**
 * Mapa mental desenhado sem Mermaid.
 *
 * No web o mapa é Mermaid, que precisa de DOM. No celular a conta de
 * posição sai daqui e cada app desenha com o que tem (react-native-svg).
 * Layout radial: tema no centro, ramos em volta, pontos de cada ramo
 * mais para fora na mesma direção. Função pura: testada sem tela.
 */
import type { DadosMapaMental } from './aiService';

export interface NoMapa {
  id: string;
  linhas: string[];
  x: number;
  y: number;
  largura: number;
  altura: number;
  nivel: 0 | 1 | 2;
  /** Índice do ramo (para a cor); -1 no centro. */
  ramo: number;
}

export interface LayoutMapa {
  nos: NoMapa[];
  arestas: { de: string; para: string }[];
  largura: number;
  altura: number;
}

const LETRAS_POR_LINHA = 16;
const PX_POR_LETRA = 7.2;
const ALTURA_LINHA = 17;
const MARGEM = 24;

/** Quebra o rótulo em linhas curtas, sem cortar palavra. */
export function quebrarRotulo(texto: string, maximo = LETRAS_POR_LINHA): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of String(texto ?? '').split(/\s+/).filter(Boolean)) {
    if (!atual) atual = palavra;
    else if ((atual + ' ' + palavra).length <= maximo) atual += ' ' + palavra;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas.slice(0, 3) : [''];
}

function caixa(linhas: string[], nivel: number): { largura: number; altura: number } {
  const maior = Math.max(...linhas.map((l) => l.length), 4);
  const fonte = nivel === 0 ? 1.15 : 1;
  return { largura: Math.round(maior * PX_POR_LETRA * fonte + 24), altura: linhas.length * ALTURA_LINHA + 16 };
}

export function layoutMapaMental(dados: DadosMapaMental): LayoutMapa {
  const ramos = dados.ramos.slice(0, 6);
  const nos: NoMapa[] = [];
  const arestas: { de: string; para: string }[] = [];

  const linhasCentro = quebrarRotulo(dados.titulo || 'Meus estudos', 14);
  nos.push({ id: 'c', linhas: linhasCentro, x: 0, y: 0, nivel: 0, ramo: -1, ...caixa(linhasCentro, 0) });

  // Raio cresce com a quantidade de ramos: 5 ramos num círculo pequeno se sobrepõem.
  const raioRamo = 150 + ramos.length * 12;
  ramos.forEach((ramo, i) => {
    const angulo = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, ramos.length);
    const linhas = quebrarRotulo(ramo.rotulo);
    const idRamo = `r${i}`;
    nos.push({ id: idRamo, linhas, x: Math.cos(angulo) * raioRamo, y: Math.sin(angulo) * raioRamo, nivel: 1, ramo: i, ...caixa(linhas, 1) });
    arestas.push({ de: 'c', para: idRamo });

    const filhos = ramo.filhos.slice(0, 4);
    const abertura = Math.min(Math.PI / 2.2, (2 * Math.PI) / Math.max(1, ramos.length) * 0.8);
    filhos.forEach((f, j) => {
      const desvio = filhos.length === 1 ? 0 : -abertura / 2 + (abertura * j) / (filhos.length - 1);
      const a = angulo + desvio;
      const r = raioRamo + 130 + (j % 2) * 26;
      const lf = quebrarRotulo(f);
      const idFilho = `r${i}f${j}`;
      nos.push({ id: idFilho, linhas: lf, x: Math.cos(a) * r, y: Math.sin(a) * r, nivel: 2, ramo: i, ...caixa(lf, 2) });
      arestas.push({ de: idRamo, para: idFilho });
    });
  });

  // Desloca tudo para coordenadas positivas, com margem.
  const minX = Math.min(...nos.map((n) => n.x - n.largura / 2)) - MARGEM;
  const minY = Math.min(...nos.map((n) => n.y - n.altura / 2)) - MARGEM;
  const maxX = Math.max(...nos.map((n) => n.x + n.largura / 2)) + MARGEM;
  const maxY = Math.max(...nos.map((n) => n.y + n.altura / 2)) + MARGEM;
  for (const n of nos) {
    n.x = Math.round(n.x - minX);
    n.y = Math.round(n.y - minY);
  }
  return { nos, arestas, largura: Math.round(maxX - minX), altura: Math.round(maxY - minY) };
}

const PALAVRAS_VAZIAS = new Set(
  'para pela pelo como mais menos entre sobre quando onde porque sendo isso essa esse esta este aquela aquele muito pouco cada todo toda todos todas tambem também ainda depois antes outra outro outras outros seus suas dele dela eles elas nossa nosso quais qual fazer feito pode podem deve devem'.split(' '),
);

/**
 * Mapa sem IA: as palavras que mais aparecem nas anotações viram ramos,
 * e as frases curtas onde cada uma aparece viram os pontos.
 */
export function mapaMentalLocal(notas: string[], titulo = 'Meus estudos'): DadosMapaMental | null {
  const contagem = new Map<string, number>();
  for (const n of notas) {
    for (const p of n.toLowerCase().match(/[a-zà-ÿ]{5,}/g) ?? []) {
      if (!PALAVRAS_VAZIAS.has(p)) contagem.set(p, (contagem.get(p) ?? 0) + 1);
    }
  }
  const top = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);
  if (top.length === 0) return null;
  const frases = notas.flatMap((n) => n.split(/(?<=[.!?])\s+|\n+/)).map((f) => f.trim()).filter(Boolean);
  return {
    titulo,
    ramos: top.map((p) => ({
      rotulo: p.charAt(0).toUpperCase() + p.slice(1),
      filhos: frases
        .filter((f) => f.toLowerCase().includes(p))
        .slice(0, 2)
        .map((f) => (f.length > 40 ? `${f.slice(0, 38).trim()}…` : f)),
    })),
  };
}
