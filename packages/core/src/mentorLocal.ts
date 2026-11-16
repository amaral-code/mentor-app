/**
 * Resposta do Mentor SEM IA: base local (FAQ do ENEM e banco de quiz),
 * com o prefixo empático do humor detectado.
 *
 * É o plano B quando a IA não responde (timeout, rede, cota). Morava
 * dentro do ChatPage do web; veio para cá quando o app nativo ganhou o
 * mesmo chat, para os dois responderem igual quando a IA cai.
 */
import { searchKB, matchSubject, extractKeywords, SPECIAL_RESPONSES, buildKBFromQuiz } from './kbSearch';
import { getEmpathicPrefix } from './emotionEngine';
import { QUIZ_BANK } from './quizBank';
import { ENEM_KB } from './kbEnem';
import type { ChatPersona, MoodType } from './types';

const QUIZ_KB = buildKBFromQuiz(QUIZ_BANK);
const ALL_KB = [...ENEM_KB, ...QUIZ_KB];

export function getBotReply(userMessage: string, mood: string, persona: ChatPersona | null): string {
  const lower = userMessage.trim().toLowerCase();
  const isMentor = !persona || persona.id === 'mentor_enem';
  for (const [key, response] of Object.entries(SPECIAL_RESPONSES)) {
    if (lower === key || lower.startsWith(key)) {
      const prefix = getEmpathicPrefix(mood as MoodType);
      return prefix ? `${prefix}\n\n${response}` : response;
    }
  }
  const match = searchKB(userMessage, ALL_KB);
  if (match) {
    const prefix = getEmpathicPrefix(mood as MoodType);
    return prefix ? `${prefix}\n\n${match.entry.content}` : match.entry.content;
  }
  const subject = matchSubject(userMessage);
  if (isMentor && subject) {
    const dicas: Record<string, string> = {
      Matemática: ' Pratique exercícios de lógica e revisão de fórmulas. Foco em razão, proporção e funções.',
      Português: ' Revise concordância verbal e nominal, regência e crase. Leia os enunciados com atenção.',
      História: ' Contextualize eventos em ordem cronológica. Destaque para Brasil Colônia, Império e Era Vargas.',
      Geografia: ' Questões de geografia política, ambiental e urbana são frequentes. Atente-se a mapas.',
      Biologia: ' Fisiologia humana, ecologia e genética são os temas mais cobrados.',
      Física: ' Mecânica, termologia e ondas são tópicos principais. Foco em interpretação de gráficos.',
      Química: ' Estequiometria, soluções e oxirredução são recorrentes. Pratique cálculos.',
      Filosofia: ' Conheça os principais filósofos e suas ideias centrais (Sócrates, Descartes, Nietzsche).',
      Inglês: '🇬🇧 Foco em interpretação de texto e vocabulário. Palavras cognatas ajudam muito.',
      Sociologia: ' Trabalho, cultura, cidadania e movimentos sociais são temas frequentes.',
    };
    const prefix = getEmpathicPrefix(mood as MoodType);
    return prefix ? `${prefix}\n\n${dicas[subject] || `Sobre ${subject}: revise os fundamentos e pratique questões.`}` : (dicas[subject] || `Sobre ${subject}: revise os fundamentos e pratique questões.`);
  }
  const keywords = extractKeywords(userMessage);
  const prefix = getEmpathicPrefix(mood as MoodType);
  if (persona && !isMentor) {
    const especialidade = persona.escopo ?? persona.name;
    const fallback = `Não encontrei informações específicas sobre "${keywords.join(', ') || 'isso'}" na minha base local. Minha especialidade é ${especialidade}. Que tal reformular dentro dessa área?`;
    return prefix ? `${prefix}\n\n${fallback}` : fallback;
  }
  const fallback = `Hmm, não encontrei informações sobre "${keywords.join(', ') || 'isso'}" na minha base local.  Tente reformular sua pergunta ou explore as seções Quiz, Redação e Caderno de Estudos!`;
  return prefix ? `${prefix}\n\n${fallback}` : fallback;
}
