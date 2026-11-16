import { plataforma } from './plataforma';

/**
 * Fila offline (issue #56).
 *
 * O que o aluno faz sem internet (resultado do quiz, XP, placar por
 * tópico) fica guardado no aparelho e sai quando a conexão volta. O
 * banco aplica cada operação UMA vez pela chave (`aplicar_operacao`,
 * migration 033), então reenviar é sempre seguro.
 *
 * Regras:
 *   • Ordem de chegada: a fila sai na ordem em que foi feita.
 *   • Falha de rede: espera crescente (5 s, 10 s, 20 s... até 10 min).
 *   • Recusa definitiva do servidor (dado inválido, operação antiga):
 *     a operação sai da fila. Tentar de novo não muda a resposta.
 *   • Mais de 7 dias na fila: sai. O servidor recusaria de qualquer jeito.
 */

export type TipoOperacao = 'xp' | 'quiz_resultado' | 'desempenho_topico';

export interface OperacaoOffline {
  chave: string;
  tipo: TipoOperacao;
  dados: Record<string, unknown>;
  /** ISO. Hora em que o aluno fez, para o histórico. */
  feitaEm: string;
  tentativas: number;
  /** Epoch ms. Antes disso a operação não é tentada. */
  proximaTentativa: number;
}

/** O que o executor (quem fala com o banco) devolve. */
export type ResultadoEnvio =
  | { status: 'aplicada'; resposta?: unknown }
  | { status: 'rede' }
  | { status: 'recusada'; motivo: string };

export type Executor = (op: OperacaoOffline) => Promise<ResultadoEnvio>;

const CHAVE_ARMAZENAMENTO = 'mm_fila_offline';
const SETE_DIAS = 7 * 24 * 3600 * 1000;

export function esperaParaTentativa(tentativas: number): number {
  return Math.min(5000 * 2 ** Math.max(0, tentativas - 1), 10 * 60 * 1000);
}

export function gerarChave(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function ler(): OperacaoOffline[] {
  try {
    const bruto = plataforma().armazenamento()?.getItem(CHAVE_ARMAZENAMENTO);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravar(lista: OperacaoOffline[]): void {
  try {
    plataforma().armazenamento()?.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(lista));
  } catch {
    /* armazenamento cheio ou bloqueado: a operação fica só na memória desta sessão */
  }
}

export function operacoesPendentes(): OperacaoOffline[] {
  return ler();
}

export function enfileirarOperacao(tipo: TipoOperacao, dados: Record<string, unknown>, agora = Date.now()): OperacaoOffline {
  const op: OperacaoOffline = {
    chave: gerarChave(),
    tipo,
    dados,
    feitaEm: new Date(agora).toISOString(),
    tentativas: 0,
    proximaTentativa: agora,
  };
  gravar([...ler(), op]);
  return op;
}

export interface ResumoSincronizacao {
  aplicadas: { op: OperacaoOffline; resposta?: unknown }[];
  recusadas: { op: OperacaoOffline; motivo: string }[];
  pendentes: number;
}

/**
 * Envia o que está pronto. Para na primeira falha de rede: se a rede
 * caiu para uma, cai para as próximas, e insistir só gasta bateria.
 *
 * `ignorarEspera`: a conexão acabou de voltar. A espera crescente existe
 * para não martelar uma rede ruim; com a rede de volta, esperar só atrasa.
 */
export async function sincronizarFila(
  executar: Executor,
  agora = Date.now(),
  opcoes: { ignorarEspera?: boolean } = {},
): Promise<ResumoSincronizacao> {
  const resumo: ResumoSincronizacao = { aplicadas: [], recusadas: [], pendentes: 0 };
  const removidas = new Set<string>();
  const atualizadas = new Map<string, OperacaoOffline>();
  const valida = (op: OperacaoOffline) => agora - new Date(op.feitaEm).getTime() <= SETE_DIAS;

  for (const op of ler().filter(valida)) {
    if (!opcoes.ignorarEspera && op.proximaTentativa > agora) continue;
    let r: ResultadoEnvio;
    try {
      r = await executar(op);
    } catch {
      r = { status: 'rede' };
    }
    if (r.status === 'aplicada') {
      removidas.add(op.chave);
      resumo.aplicadas.push({ op, resposta: r.resposta });
    } else if (r.status === 'recusada') {
      removidas.add(op.chave);
      resumo.recusadas.push({ op, motivo: r.motivo });
    } else {
      const tentativas = op.tentativas + 1;
      atualizadas.set(op.chave, { ...op, tentativas, proximaTentativa: agora + esperaParaTentativa(tentativas) });
      break;
    }
  }

  /*
   * Relê a fila ANTES de gravar. Enquanto o envio esperava a rede, o
   * aluno pode ter terminado outra atividade e ela entrou na fila. Gravar
   * a lista lida no começo apagava essa operação nova: era assim que o
   * XP e o placar de um quiz feito offline sumiam.
   */
  const final = ler()
    .filter((op) => valida(op) && !removidas.has(op.chave))
    .map((op) => atualizadas.get(op.chave) ?? op);
  gravar(final);
  resumo.pendentes = final.length;
  return resumo;
}
