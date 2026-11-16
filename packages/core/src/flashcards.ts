/**
 * Flashcards do Caderno: geração, armazenamento e o baralho.
 *
 * No web os cartões nasciam no Notebook Studio e passavam ao quiz por
 * uma variável global (`window.__flashcardQuiz`), sumindo no recarregar.
 * Aqui eles ficam guardados no aparelho e o baralho (o que sai, o que
 * volta para o fim da fila) é uma função pura, testada sem tela.
 */
import { askGemini } from './aiService';
import { safeGet, safeSet } from './safeStorage';

export interface Flashcard {
  id: string;
  pergunta: string;
  resposta: string;
  /** Nota de onde o cartão saiu, para "ver a anotação". */
  notaId?: string;
}

export function promptFlashcards(textos: string[], quantos = 5): string {
  return [
    `Com base nas anotações abaixo, gere ${quantos} flashcards de pergunta e resposta para revisão.`,
    'Cada pergunta deve ser clara e caber numa tela de celular; cada resposta, direta, em até duas frases.',
    'Responda APENAS com um array JSON, sem markdown: [{"pergunta": "...", "resposta": "..."}]',
    '',
    'Anotações:',
    ...textos.map((t) => `• ${t}`),
  ].join('\n');
}

/**
 * Lê o array de cartões da resposta da IA. Valida campo a campo: no web,
 * objeto sem `pergunta` virava cartão com enunciado `undefined`.
 */
export function lerFlashcards(bruto: string): { pergunta: string; resposta: string }[] {
  const trecho = /\[[\s\S]*\]/.exec(String(bruto ?? ''));
  if (!trecho) return [];
  let lido: unknown;
  try {
    lido = JSON.parse(trecho[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(lido)) return [];
  return lido
    .filter((c): c is { pergunta: string; resposta: string } => {
      const o = c as { pergunta?: unknown; resposta?: unknown };
      return !!c && typeof o.pergunta === 'string' && o.pergunta.trim().length > 0 && typeof o.resposta === 'string' && o.resposta.trim().length > 0;
    })
    .map((c) => ({ pergunta: c.pergunta.trim().slice(0, 300), resposta: c.resposta.trim().slice(0, 500) }));
}

/**
 * Cartões sem IA: cada frase com conteúdo vira "complete a lacuna" com a
 * palavra mais longa escondida. Pobre, mas funciona sem rede.
 */
export function flashcardsLocais(notas: { id: string; text: string }[], maximo = 6): Flashcard[] {
  const cartoes: Flashcard[] = [];
  for (const n of notas) {
    const frases = n.text.split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter((f) => f.split(/\s+/).length >= 5);
    for (const frase of frases) {
      const palavras = frase.match(/[A-Za-zÀ-ÿ]{5,}/g) ?? [];
      const chave = [...palavras].sort((a, b) => b.length - a.length)[0];
      if (!chave) continue;
      cartoes.push({
        id: `local_${n.id}_${cartoes.length}`,
        pergunta: frase.replace(chave, '______'),
        resposta: chave,
        notaId: n.id,
      });
      if (cartoes.length >= maximo) return cartoes;
    }
  }
  return cartoes;
}

/** Gera pela IA; sem IA, ou se ela devolver lixo, cai nos cartões locais. */
export async function gerarFlashcards(
  notas: { id: string; text: string }[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ cartoes: Flashcard[]; viaIA: boolean }> {
  const comConteudo = notas.filter((n) => n.text.trim().split(/\s+/).length > 3);
  if (comConteudo.length === 0) return { cartoes: [], viaIA: false };
  try {
    const bruto = await askGemini(promptFlashcards(comConteudo.slice(-8).map((n) => n.text)), null, apiKey, undefined, signal);
    const lidos = lerFlashcards(bruto);
    if (lidos.length > 0) {
      const base = Date.now();
      return {
        cartoes: lidos.map((c, i) => ({ id: `ia_${base}_${i}`, ...c, notaId: comConteudo.length === 1 ? comConteudo[0].id : undefined })),
        viaIA: true,
      };
    }
  } catch {
    /* sem IA: segue para os cartões locais */
  }
  return { cartoes: flashcardsLocais(comConteudo), viaIA: false };
}

const CHAVE = 'mm_flashcards';
const MAXIMO_GUARDADO = 80;

export function carregarFlashcards(): Flashcard[] {
  try {
    const lido = JSON.parse(safeGet(CHAVE) ?? '[]');
    return Array.isArray(lido) ? lido.filter((c) => c && typeof c.pergunta === 'string') : [];
  } catch {
    return [];
  }
}

/** Junta os novos aos guardados (os mais recentes primeiro, sem repetir pergunta). */
export function guardarFlashcards(novos: Flashcard[]): Flashcard[] {
  const vistos = new Set<string>();
  const todos = [...novos, ...carregarFlashcards()].filter((c) => {
    const k = c.pergunta.toLowerCase();
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const cortados = todos.slice(0, MAXIMO_GUARDADO);
  safeSet(CHAVE, JSON.stringify(cortados));
  return cortados;
}

/* ------------------------------------------------------------------ */

export interface Baralho {
  /** Ids na ordem em que aparecem. O primeiro é o cartão da vez. */
  fila: string[];
  sabia: string[];
  /** Quantas vezes cada cartão voltou para o fim. */
  voltas: Record<string, number>;
}

/** Um cartão volta no máximo duas vezes: depois disso, fica para o próximo dia. */
export const VOLTAS_MAXIMAS = 2;

export function novoBaralho(ids: string[]): Baralho {
  return { fila: [...ids], sabia: [], voltas: {} };
}

/**
 * Deslizou para a direita ("sabia"): sai do baralho. Para a esquerda
 * ("revisar"): vai para o fim da fila, até duas vezes.
 */
export function responderCartao(b: Baralho, sabia: boolean): Baralho {
  const [atual, ...resto] = b.fila;
  if (atual === undefined) return b;
  if (sabia) return { ...b, fila: resto, sabia: [...b.sabia, atual] };
  const voltas = (b.voltas[atual] ?? 0) + 1;
  return {
    ...b,
    fila: voltas <= VOLTAS_MAXIMAS ? [...resto, atual] : resto,
    voltas: { ...b.voltas, [atual]: voltas },
  };
}

/** Cartões que o aluno marcou como "revisar" pelo menos uma vez. */
export function paraRevisar(b: Baralho): string[] {
  return Object.keys(b.voltas);
}
