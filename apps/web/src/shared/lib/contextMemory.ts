import type { QuizResult, LogEntry, ChatPersona } from '../types';

// =========================================================
// MEMÓRIA DE CONTEXTO DO MENTOR
//
// A versão anterior era uma constante:
//
//   export const LAST_SUBJECT = 'Matemática Financeira';
//
// O chat anunciava "retomando: Matemática Financeira" para todo mundo,
// sempre, mesmo com o professor de História selecionado. E a saudação
// ainda emendava "juros, porcentagem e análises financeiras caem bastante
// no ENEM", texto fixo que não mudava nem passando outra matéria.
//
// Agora a matéria vem do que o aluno realmente fez, nesta ordem:
//   1. último quiz respondido
//   2. último registro de atividade que cite uma matéria
//   3. persona selecionada no momento
//   4. nada: a saudação vira genérica, sem inventar histórico
// =========================================================

/** Matérias que o app conhece, para casar com o texto dos registros. */
const MATERIAS = [
  'Matemática',
  'Português',
  'História',
  'Geografia',
  'Biologia',
  'Física',
  'Química',
  'Filosofia',
  'Sociologia',
  'Inglês',
  'Redação',
] as const;

/** Assunto associado a cada persona embutida. */
const MATERIA_DA_PERSONA: Record<string, string> = {
  prof_matematica: 'Matemática',
  prof_portugues: 'Português',
  prof_ciencias: 'Ciências da Natureza',
  prof_humanas: 'Ciências Humanas',
};

export interface FontesDeContexto {
  quizResults?: QuizResult[];
  logs?: LogEntry[];
  persona?: ChatPersona | null;
}

/**
 * Última matéria estudada, ou null quando não há histórico.
 *
 * Devolver null é proposital: é melhor uma saudação genérica do que
 * afirmar que o aluno estava estudando algo que ele nunca abriu.
 */
export function ultimaMateria({ quizResults, logs, persona }: FontesDeContexto): string | null {
  // 1. quiz mais recente
  const quizzes = [...(quizResults ?? [])].sort((a, b) => b.timestamp - a.timestamp);
  if (quizzes[0]?.materia) return quizzes[0].materia;

  // 2. registro de atividade que mencione uma matéria conhecida
  const registros = [...(logs ?? [])].sort((a, b) => b.timestamp - a.timestamp);
  for (const r of registros) {
    const achada = MATERIAS.find((m) => r.description?.includes(m));
    if (achada) return achada;
  }

  // 3. persona selecionada
  if (persona && MATERIA_DA_PERSONA[persona.id]) return MATERIA_DA_PERSONA[persona.id];

  return null;
}

/**
 * Saudação inicial do mentor.
 *
 * Com matéria conhecida, retoma de onde parou. Sem matéria, convida a
 * começar em vez de fingir um histórico.
 */
export function buildContextGreeting(materia?: string | null): string {
  if (!materia) {
    return 'Olá! Sou seu mentor. O que vamos estudar hoje?';
  }

  return `Olá! Sou seu mentor. Vi que você estava em **${materia}**. Bora continuar?`;
}
