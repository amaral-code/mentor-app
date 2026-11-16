/**
 * Regras de uma rodada de quiz que não dependem de tela.
 *
 * Moravam espalhadas no QuizPage do web (XP, nota, quais tópicos voltam
 * na revisão espaçada). O app nativo faz a mesma rodada, e o XP do quiz
 * no celular não pode ser diferente do XP no notebook.
 */
import type { QuizQuestion } from './types';
import { QUIZ_BANK } from './quizBank';
import { hashEnunciado } from './quizHistory';

export const MATERIAS_QUIZ = ['Matemática', 'Português', 'Biologia', 'Física', 'Química', 'História', 'Geografia', 'Filosofia', 'Inglês', 'Redação'];

export const TOPICOS_POR_MATERIA: Record<string, string[]> = {
  Matemática: ['Trigonometria', 'Funções', 'Geometria Plana', 'Geometria Espacial', 'Probabilidade', 'Estatística', 'Análise Combinatória', 'Matrizes', 'Logaritmos', 'Progressões'],
  Português: ['Crase', 'Concordância', 'Regência', 'Figuras de Linguagem', 'Interpretação Textual', 'Literatura Brasileira', 'Funções da Linguagem', 'Ortografia', 'Morfologia', 'Colocação Pronominal'],
  Biologia: ['Citologia', 'Genética', 'Ecologia', 'Fisiologia Humana', 'Botânica', 'Zoologia', 'Evolução', 'Microbiologia', 'Bioquímica', 'Imunologia'],
  Física: ['Mecânica', 'Termodinâmica', 'Óptica', 'Eletromagnetismo', 'Ondulatória', 'Hidrostática', 'Física Moderna', 'Cinemática', 'Dinâmica', 'Eletrodinâmica'],
  Química: ['Química Orgânica', 'Estequiometria', 'Soluções', 'Termoquímica', 'Eletroquímica', 'Cinética Química', 'Equilíbrio Químico', 'Atomística', 'Ligações Químicas', 'Funções Inorgânicas'],
  História: ['Brasil Colônia', 'Brasil Império', 'Era Vargas', 'Ditadura Militar', 'Revolução Francesa', 'Guerras Mundiais', 'Grécia Antiga', 'Roma Antiga', 'Independência do Brasil', 'República Velha'],
  Geografia: ['Geopolítica', 'Climatologia', 'Geomorfologia', 'Urbanização', 'População', 'Cartografia', 'Meio Ambiente', 'Hidrografia', 'Agricultura', 'Globalização'],
  Filosofia: ['Filosofia Antiga', 'Filosofia Medieval', 'Racionalismo', 'Empirismo', 'Ética', 'Política', 'Filosofia Contemporânea', 'Lógica', 'Estética', 'Existencialismo'],
  Inglês: ['Interpretação Textual', 'Verbos Irregulares', 'Tempos Verbais', 'Conjunções', 'Preposições', 'Voz Passiva', 'Condicionais', 'Pronomes', 'Cognatos', 'Vocabulário ENEM'],
  Redação: ['Estrutura Dissertativa', 'Repertório Sociocultural', 'Argumentação', 'Coesão Textual', 'Proposta de Intervenção', 'Introdução', 'Desenvolvimento', 'Conclusão', 'Temas ENEM', 'Citação'],
};

/** 30 XP por acerto, como no web. */
export const XP_POR_ACERTO = 30;

export function xpDoQuiz(acertos: number): number {
  return Math.max(0, Math.floor(acertos)) * XP_POR_ACERTO;
}

/** Nota de 0 a 100 que o SM-2 do calendário usa para marcar a próxima revisão. */
export function notaDoQuiz(acertos: number, total: number): number {
  return total > 0 ? Math.round((Math.min(acertos, total) / total) * 100) : 0;
}

export interface AlvoRevisao {
  topicoId: string;
  topicoNome: string;
  materia: string;
}

/**
 * Quais tópicos voltam no calendário depois deste quiz.
 *
 * Veio de uma revisão agendada: reagenda AQUELE tópico (mesmo id, para o
 * intervalo crescer 1, 3, 7, 21 dias). Senão, cada tópico escolhido vira
 * um item; sem tópico ("Geral"), a matéria inteira.
 */
export function alvosDeRevisao(materia: string, topicos: string[], revisao?: AlvoRevisao | null): AlvoRevisao[] {
  if (revisao) return [revisao];
  const escolhidos = topicos.filter((t) => t && t !== 'Geral');
  const alvos = escolhidos.length > 0 ? escolhidos : [materia];
  return alvos.map((t) => ({ topicoId: `${materia}:${t}`.toLowerCase(), topicoNome: t, materia }));
}

/**
 * Questões do banco embutido, sem repetir as já vistas (pelo mesmo hash
 * do histórico antirrepetição). É o plano B quando a IA não responde:
 * poucas questões, mas o aluno não fica sem quiz no ônibus sem sinal.
 */
export function questoesDoBancoLocal(
  materia: string,
  quantidade: number,
  vistas: Set<string> = new Set(),
  sortear: () => number = Math.random,
): QuizQuestion[] {
  const daMateria = QUIZ_BANK.filter((q) => q.materia === materia);
  const ineditas = daMateria.filter((q) => !vistas.has(hashEnunciado(q.enunciado)));
  // Todas já vistas: melhor repetir do que não ter quiz nenhum.
  const fonte = ineditas.length > 0 ? ineditas : daMateria;
  const embaralhadas = fonte
    .map((q) => ({ q, peso: sortear() }))
    .sort((a, b) => a.peso - b.peso)
    .map((x) => x.q);
  return embaralhadas.slice(0, Math.max(0, quantidade));
}
