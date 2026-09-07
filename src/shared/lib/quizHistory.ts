/**
 * ANTIRREPETICAO DO QUIZ - hash, filtro e bloco de prompt.
 *
 * A regra: nenhuma questao exibida volta em quiz futuro da mesma
 * materia para a mesma conta. Tres camadas, da barata a cara:
 *
 *   1. BANCO (`quiz_questoes_exibidas`, unique por usuario+hash): o
 *      registro sobrevive a troca de aparelho e o upsert resolve
 *      duplo-clique/retry sem erro.
 *   2. PROMPT: o historico recente da materia entra no pedido ao
 *      DeepSeek ("nao repita nem reformule") - evita gastar geracao.
 *   3. FILTRO CLIENTE: o que voltar repetido e descartado antes de
 *      renderizar, pelo mesmo hash do banco.
 *
 * Tudo aqui e funcao pura (sem I/O): o banco mora no
 * SupabaseRepository e os testes nao precisam de rede.
 */

/** Normaliza para comparacao: minusculas, sem pontuacao, espacos colapsados. */
export function normalizarEnunciado(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fnv1a32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hash estavel do enunciado (16 hex). Duas sementes FNV-1a: caixa,
 * pontuacao e espacos nao mudam o hash - "Qual a capital??" e
 * "QUAL A CAPITAL" caem no mesmo balde de proposito.
 */
export function hashEnunciado(texto: string): string {
  const n = normalizarEnunciado(texto);
  return (
    fnv1a32(n, 0x811c9dc5).toString(16).padStart(8, '0') +
    fnv1a32(n, 0x01000193).toString(16).padStart(8, '0')
  );
}

/** Remove da lista o que ja foi exibido (mesmo hash do banco). */
export function filtrarIneditas<T extends { enunciado: string }>(
  questoes: T[],
  hashesVistos: Set<string>,
): T[] {
  return questoes.filter((q) => !hashesVistos.has(hashEnunciado(q.enunciado)));
}

/* ============================================================
 * SIMULADO CRONOMETRADO - rascunho com salvamento automatico
 * ------------------------------------------------------------
 * O rascunho mora no localStorage (chave abaixo) e guarda o
 * DEADLINE absoluto (fimEm), nao o tempo restante: fechar a aba,
 * recarregar ou trocar de pagina nao pausa nem zera o cronometro -
 * ao voltar, o tempo exibido e fimEm - agora. Rascunho expirado e
 * tratado como inexistente e limpo na leitura.
 * ============================================================ */

/** Minutos por questao no simulado (ritmo de prova). */
export const MINUTOS_POR_QUESTAO_SIMULADO = 3;

export const SIMULADO_DRAFT_KEY = 'mm_simulado_draft';

export interface RascunhoSimulado {
  versao: 1;
  questions: {
    id: string;
    materia: string;
    topico?: string;
    enunciado: string;
    alternativas: string[];
    correta: number;
    explicacao: string;
    dica?: string;
    fonte?: string;
    dificuldade?: string;
  }[];
  respostas: Record<number, number>;
  currentIndex: number;
  acertos: number;
  /** Deadline absoluto em ms: sobrevive a fechar a pagina. */
  fimEm: number;
  totalMin: number;
  dificuldade: string;
  materia: string;
}

/** Valida forma e prazo. Funcao pura - o relogio entra por parametro. */
export function validarRascunhoSimulado(obj: unknown, agoraMs: number): RascunhoSimulado | null {
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  if (r.versao !== 1) return null;
  if (!Array.isArray(r.questions) || r.questions.length === 0) return null;
  if (typeof r.fimEm !== 'number' || r.fimEm <= agoraMs) return null;
  if (typeof r.currentIndex !== 'number') return null;
  const questions = (r.questions as Record<string, unknown>[])
    .filter(
      (q) =>
        q &&
        typeof q.enunciado === 'string' &&
        Array.isArray(q.alternativas) &&
        q.alternativas.length === 4 &&
        Number.isInteger(q.correta),
    )
    .map((q) => ({
      id: String(q.id ?? `sim_${Math.random()}`),
      materia: String(q.materia ?? 'Simulado'),
      topico: typeof q.topico === 'string' ? q.topico : undefined,
      enunciado: String(q.enunciado),
      alternativas: (q.alternativas as unknown[]).map((a) => String(a)),
      correta: q.correta as number,
      explicacao: String(q.explicacao ?? ''),
      dica: typeof q.dica === 'string' ? q.dica : undefined,
      fonte: typeof q.fonte === 'string' ? q.fonte : undefined,
      dificuldade: typeof q.dificuldade === 'string' ? q.dificuldade : undefined,
    }));
  if (questions.length === 0) return null;
  const respostas: Record<number, number> = {};
  if (r.respostas && typeof r.respostas === 'object') {
    for (const [k, v] of Object.entries(r.respostas as Record<string, unknown>)) {
      const qi = Number(k);
      if (Number.isInteger(qi) && Number.isInteger(v) && qi >= 0 && qi < questions.length) {
        respostas[qi] = v as number;
      }
    }
  }
  return {
    versao: 1,
    questions,
    respostas,
    currentIndex: Math.min(Math.max(0, r.currentIndex as number), questions.length - 1),
    acertos: typeof r.acertos === 'number' ? r.acertos : 0,
    fimEm: r.fimEm as number,
    totalMin: typeof r.totalMin === 'number' ? (r.totalMin as number) : 0,
    dificuldade: typeof r.dificuldade === 'string' ? (r.dificuldade as string) : 'media',
    materia: typeof r.materia === 'string' ? (r.materia as string) : 'Simulado',
  };
}

function armazenamentoLocal(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function salvarRascunhoSimulado(r: RascunhoSimulado): void {
  try {
    armazenamentoLocal()?.setItem(SIMULADO_DRAFT_KEY, JSON.stringify(r));
  } catch {
    /* armazenamento cheio ou privado: o simulado segue sem autosave */
  }
}

export function carregarRascunhoSimulado(agoraMs = Date.now()): RascunhoSimulado | null {
  try {
    const raw = armazenamentoLocal()?.getItem(SIMULADO_DRAFT_KEY);
    if (!raw) return null;
    const valido = validarRascunhoSimulado(JSON.parse(raw), agoraMs);
    if (!valido) limparRascunhoSimulado();
    return valido;
  } catch {
    return null;
  }
}

export function limparRascunhoSimulado(): void {
  try {
    armazenamentoLocal()?.removeItem(SIMULADO_DRAFT_KEY);
  } catch {
    /* sem armazenamento: nada a limpar */
  }
}

/** mm:ss para o cronometro regressivo. */
export function formatarTempoSimulado(segundosTotais: number): string {
  const s = Math.max(0, Math.floor(segundosTotais));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Bloco injetado no prompt do modelo com o historico recente.
 * Vazio quando nao ha historico: o prompt nao carrega peso morto.
 */
export function montarBlocoAntirrepeticao(previews: string[]): string {
  const lista = (previews ?? []).map((p) => String(p || '').trim()).filter(Boolean).slice(0, 20);
  if (lista.length === 0) return '';
  return [
    `QUESTÕES JÁ APLICADAS A ESTE ALUNO (${lista.length} abaixo): não repita nenhuma e não reformule nenhuma com outros números ou palavras - cada questão nova precisa de cenário e cobrança diferentes.`,
    ...lista.map((p, i) => `${i + 1}. ${p.slice(0, 160)}`),
  ].join('\n');
}
