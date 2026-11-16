/**
 * Contas da Central de Comando, sem tela.
 *
 * Moravam dentro do `DashboardPage` do web (useMemo sobre os logs e o
 * histórico de quiz). Saíram para cá quando o app nativo ganhou a mesma
 * Central: duas cópias da conta de "acerto por matéria" divergiriam na
 * primeira correção.
 */
import type { LogEntry, QuizResult } from './types';
import { calcLevel } from './utils';

export interface AcertoMateria {
  materia: string;
  acertos: number;
  total: number;
  /** 0 a 100, arredondado. */
  pct: number;
}

/**
 * Acerto agregado por matéria, do melhor para o pior.
 *
 * Quiz com `total` zero (lote que falhou na geração) fica de fora: no web
 * ele virava NaN% e a barra sumia sem explicação.
 */
export function acertoPorMateria(resultados: QuizResult[]): AcertoMateria[] {
  const mapa = new Map<string, { acertos: number; total: number }>();
  for (const r of resultados) {
    if (!r || !(r.total > 0)) continue;
    const atual = mapa.get(r.materia) ?? { acertos: 0, total: 0 };
    atual.acertos += r.acertos;
    atual.total += r.total;
    mapa.set(r.materia, atual);
  }
  return [...mapa.entries()]
    .map(([materia, d]) => ({ materia, ...d, pct: Math.round((d.acertos / d.total) * 100) }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
}

/** Média simples das matérias (cada matéria pesa igual). `null` sem dados. */
export function mediaDeAcerto(materias: AcertoMateria[]): number | null {
  if (materias.length === 0) return null;
  return Math.round(materias.reduce((s, m) => s + m.pct, 0) / materias.length);
}

/* Fixo, e não toLocaleDateString: o Hermes do Android sem dados de
   localidade devolve o nome em inglês ("Mon") e a tela mistura idiomas. */
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export interface DiaAtividade {
  /** AAAA-MM-DD no fuso do aparelho. */
  chave: string;
  rotulo: string;
  total: number;
  hoje: boolean;
}

function chaveLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Atividades por dia nos últimos 7 dias, do mais antigo para hoje.
 * O dia é o do APARELHO: estudar às 23h conta para hoje, não para o
 * amanhã do UTC.
 */
export function atividadeDaSemana(logs: Pick<LogEntry, 'timestamp'>[], agora: Date = new Date()): DiaAtividade[] {
  const contagem = new Map<string, number>();
  for (const l of logs) {
    const k = chaveLocal(new Date(l.timestamp));
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const dias: DiaAtividade[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
    const chave = chaveLocal(d);
    dias.push({ chave, rotulo: DIAS[d.getDay()], total: contagem.get(chave) ?? 0, hoje: i === 0 });
  }
  return dias;
}

export interface ProgressoNivel {
  nivel: number;
  xpNoNivel: number;
  xpParaProximo: number;
  /** 0 a 100. */
  pct: number;
}

/**
 * Nível e progresso SEMPRE por `calcLevel` (fonte única): o campo `level`
 * do servidor pode vir da fórmula antiga de quem não rodou a migration 008.
 */
export function progressoDeNivel(xp: number): ProgressoNivel {
  const { level, remainder } = calcLevel(Math.max(0, xp || 0));
  const xpParaProximo = 100 * level;
  return { nivel: level, xpNoNivel: remainder, xpParaProximo, pct: (remainder / xpParaProximo) * 100 };
}

/** Mínimo de letras do parágrafo que comprova uma tarefa do plano. */
export const MIN_PARAGRAFO_COMPROVACAO = 30;

/**
 * Guarda no aparelho o que valeu o XP de uma tarefa (últimas 60).
 *
 * A foto não sobe ao servidor (exigiria bucket e migration): fica só o
 * registro de que houve foto. O texto fica, para o aluno poder rever.
 */
export function registrarComprovacao(
  taskId: string,
  prova: { texto: string; temFoto: boolean },
  ler: (k: string) => string | null,
  gravar: (k: string, v: string) => void,
  agora: number = Date.now(),
): void {
  let lista: unknown[] = [];
  try {
    const bruto = ler('mm_comprovacoes');
    const lido = bruto ? JSON.parse(bruto) : [];
    if (Array.isArray(lido)) lista = lido;
  } catch {
    /* JSON corrompido: recomeça a lista em vez de perder o XP. */
  }
  const d = new Date(agora);
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  lista.push({ taskId, data, ...prova, em: agora });
  gravar('mm_comprovacoes', JSON.stringify(lista.slice(-60)));
}
