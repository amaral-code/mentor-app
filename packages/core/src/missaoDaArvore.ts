import type { QuizQuestion } from './types';
import type { Especie } from './florestaDoDia';
import { MATERIAS_QUIZ, questoesDoBancoLocal } from './sessaoQuiz';

/**
 * O que tem dentro de cada árvore: uma missão de quiz, e o formato da
 * árvore diz qual (decisão do dono: dentro da árvore é quiz, não escrita).
 *
 *   redonda  → múltipla escolha (as 4 alternativas da questão)
 *   pinheiro → verdadeiro ou falso (uma resposta proposta: está certa?)
 *   nuvem    → uma ou outra (a certa contra uma errada)
 *
 * As três saem do mesmo banco de questões, então valem para qualquer
 * matéria sem questão escrita à mão para cada formato. A missão conclui
 * com 60% de acerto: abaixo disso o aluno tenta de novo com outras
 * questões. Clicar a esmo não passa, e é isso que segura o XP.
 */

export type TipoMissao = 'escolha' | 'verdadeiroFalso' | 'umaOuOutra';

export const TIPO_DA_ESPECIE: Record<Especie, TipoMissao> = {
  redonda: 'escolha',
  pinheiro: 'verdadeiroFalso',
  nuvem: 'umaOuOutra',
};

/**
 * `tom` é a cor do selo do tipo (céu, violeta, laranja da paleta do
 * produto): o aluno reconhece a missão pela cor antes de ler o nome.
 */
export const SOBRE_O_TIPO: Record<TipoMissao, { nome: string; explicacao: string; quantidade: number; tom: 'ceu' | 'violeta' | 'laranja' }> = {
  escolha: { nome: 'Múltipla escolha', explicacao: 'Escolha a alternativa certa entre quatro.', quantidade: 3, tom: 'ceu' },
  verdadeiroFalso: { nome: 'Verdadeiro ou falso', explicacao: 'Veja a resposta proposta e diga se está certa.', quantidade: 4, tom: 'violeta' },
  umaOuOutra: { nome: 'Uma ou outra', explicacao: 'Duas respostas, só uma é a certa.', quantidade: 4, tom: 'laranja' },
};

/** O que o sagui diz ao abrir a missão: o que vem e quanto precisa acertar. */
export function falaDeAbertura(tipo: TipoMissao, materia: string, total: number): string {
  const precisa = precisaAcertar(total);
  const oque =
    tipo === 'verdadeiroFalso'
      ? `${total} respostas de ${materia} para você julgar`
      : tipo === 'umaOuOutra'
        ? `${total} perguntas de ${materia}, cada uma com duas saídas`
        : `${total} questões de ${materia}`;
  return `Bora! São ${oque}. Acerte ${precisa} e a missão é sua.`;
}

/** O que o sagui diz no fim, conforme o resultado. */
export function falaDoFim(acertos: number, total: number): string {
  if (acertos === total) return 'Gabaritou! Nem eu faria melhor.';
  if (acertos >= precisaAcertar(total)) return 'Missão cumprida! Bora para a próxima árvore.';
  if (acertos === 0) return 'Essa foi difícil. Lê as explicações com calma e tenta de novo.';
  return 'Foi por pouco. Mais uma rodada e você pega.';
}

export const MINIMO_PARA_PASSAR = 0.6;

export interface ItemMissao {
  id: string;
  materia: string;
  /** Pergunta; no verdadeiro ou falso vem junto a resposta proposta. */
  enunciado: string;
  respostaProposta?: string;
  opcoes: string[];
  correta: number;
  explicacao: string;
}

function embaralhar<T>(lista: T[], sortear: () => number): T[] {
  return lista
    .map((x) => ({ x, p: sortear() }))
    .sort((a, b) => a.p - b.p)
    .map((y) => y.x);
}

function escolha(q: QuizQuestion, sortear: () => number): ItemMissao {
  // Embaralha as alternativas: decorar "é sempre a B" não pode funcionar.
  const ordem = embaralhar(q.alternativas.map((_, i) => i), sortear);
  return {
    id: q.id,
    materia: q.materia,
    enunciado: q.enunciado,
    opcoes: ordem.map((i) => q.alternativas[i]),
    correta: ordem.indexOf(q.correta),
    explicacao: q.explicacao,
  };
}

function erradaQualquer(q: QuizQuestion, sortear: () => number): number {
  const erradas = q.alternativas.map((_, i) => i).filter((i) => i !== q.correta);
  return erradas[Math.floor(sortear() * erradas.length) % erradas.length];
}

function verdadeiroOuFalso(q: QuizQuestion, verdade: boolean, sortear: () => number, sufixo: string): ItemMissao {
  const indice = verdade ? q.correta : erradaQualquer(q, sortear);
  return {
    id: `${q.id}:${sufixo}`,
    materia: q.materia,
    enunciado: q.enunciado,
    respostaProposta: q.alternativas[indice],
    opcoes: ['Verdadeiro', 'Falso'],
    correta: verdade ? 0 : 1,
    explicacao: verdade
      ? `Certo: a resposta é ${q.alternativas[q.correta]}. ${q.explicacao}`
      : `A resposta certa é ${q.alternativas[q.correta]}. ${q.explicacao}`,
  };
}

function umaOuOutra(q: QuizQuestion, sortear: () => number): ItemMissao {
  const errada = erradaQualquer(q, sortear);
  const certaPrimeiro = sortear() < 0.5;
  const opcoes = certaPrimeiro ? [q.alternativas[q.correta], q.alternativas[errada]] : [q.alternativas[errada], q.alternativas[q.correta]];
  return { id: q.id, materia: q.materia, enunciado: q.enunciado, opcoes, correta: certaPrimeiro ? 0 : 1, explicacao: q.explicacao };
}

/**
 * Monta a missão a partir das questões da matéria. Se a matéria tem
 * poucas questões, o verdadeiro ou falso tira duas afirmações da mesma
 * pergunta (uma certa, uma errada), e os outros tipos completam com
 * questões de outras matérias, para a missão nunca sair vazia.
 */
export function montarMissao(tipo: TipoMissao, materia: string, sortear: () => number = Math.random): ItemMissao[] {
  const quantidade = SOBRE_O_TIPO[tipo].quantidade;
  let fonte = questoesDoBancoLocal(materia, quantidade, new Set(), sortear);
  if (fonte.length < quantidade && tipo !== 'verdadeiroFalso') {
    const outras = MATERIAS_QUIZ.filter((m) => m !== materia).flatMap((m) => questoesDoBancoLocal(m, 1, new Set(), sortear));
    fonte = [...fonte, ...embaralhar(outras, sortear)].slice(0, quantidade);
  }
  if (tipo === 'escolha') return fonte.map((q) => escolha(q, sortear));
  if (tipo === 'umaOuOutra') return fonte.map((q) => umaOuOutra(q, sortear));
  // Verdadeiro ou falso: metade certa, metade errada, para "sempre
  // verdadeiro" não passar.
  const itens: ItemMissao[] = [];
  let i = 0;
  while (itens.length < quantidade && fonte.length > 0) {
    const q = fonte[i % fonte.length];
    const verdade = itens.length % 2 === 0;
    itens.push(verdadeiroOuFalso(q, verdade, sortear, `${itens.length}`));
    i++;
  }
  return embaralhar(itens, sortear);
}

/**
 * Matéria de cada árvore: começa pela que o aluno mais erra (é onde a
 * missão rende) e segue na ordem; sem histórico, vai pela lista do quiz.
 */
export function materiaDaArvore(indice: number, acertoPorMateria: { materia: string; pct: number }[]): string {
  const fracas = [...acertoPorMateria].sort((a, b) => a.pct - b.pct).map((m) => m.materia).filter((m) => MATERIAS_QUIZ.includes(m));
  const ordem = [...fracas, ...MATERIAS_QUIZ.filter((m) => !fracas.includes(m) && m !== 'Redação')];
  return ordem[indice % ordem.length];
}

/* ------------------------------------------------------------------ */

/** Andamento de uma missão: uma pergunta por vez, com a explicação depois de responder. */
export interface Rodada {
  itens: ItemMissao[];
  indice: number;
  respostas: (number | null)[];
  /** Resposta da pergunta atual (null = ainda não respondeu). */
  escolhida: number | null;
  terminou: boolean;
}

export function novaRodada(itens: ItemMissao[]): Rodada {
  return { itens, indice: 0, respostas: itens.map(() => null), escolhida: null, terminou: itens.length === 0 };
}

/** A resposta vale no primeiro toque; trocar depois de ver a explicação não conta. */
export function responder(r: Rodada, opcao: number): Rodada {
  if (r.terminou || r.escolhida !== null) return r;
  const respostas = [...r.respostas];
  respostas[r.indice] = opcao;
  return { ...r, respostas, escolhida: opcao };
}

export function avancar(r: Rodada): Rodada {
  if (r.escolhida === null) return r;
  const ultimo = r.indice >= r.itens.length - 1;
  return ultimo ? { ...r, terminou: true } : { ...r, indice: r.indice + 1, escolhida: null };
}

export function acertos(r: Rodada): number {
  return r.itens.reduce((s, it, i) => s + (r.respostas[i] === it.correta ? 1 : 0), 0);
}

export function precisaAcertar(total: number): number {
  return Math.ceil(total * MINIMO_PARA_PASSAR);
}

export function passou(r: Rodada): boolean {
  return r.terminou && r.itens.length > 0 && acertos(r) >= precisaAcertar(r.itens.length);
}
