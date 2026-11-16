import { MoodType, EmotionWord } from '../types';

// Dicionário de palavras-chave em português com radicais
const EMOTION_DICTIONARY: EmotionWord[] = [
  // Estresse
  { word: 'estress', mood: 'stress', valence: -0.8, sscDelta: 10 },
  { word: 'irritad', mood: 'stress', valence: -0.7, sscDelta: 8 },
  { word: 'nervos', mood: 'stress', valence: -0.7, sscDelta: 8 },
  { word: 'pressa', mood: 'stress', valence: -0.4, sscDelta: 5 },
  { word: 'sobrecarreg', mood: 'stress', valence: -0.8, sscDelta: 12 },
  { word: 'praz', mood: 'stress', valence: -0.5, sscDelta: 6 },
  // Ansiedade
  { word: 'ansios', mood: 'anxiety', valence: -0.7, sscDelta: 8 },
  { word: 'preocup', mood: 'anxiety', valence: -0.5, sscDelta: 5 },
  { word: 'medo', mood: 'anxiety', valence: -0.8, sscDelta: 7 },
  { word: 'apreens', mood: 'anxiety', valence: -0.6, sscDelta: 6 },
  { word: 'insegur', mood: 'anxiety', valence: -0.5, sscDelta: 5 },
  { word: 'desesper', mood: 'anxiety', valence: -0.9, sscDelta: 12 },
  // Tristeza
  { word: 'triste', mood: 'sadness', valence: -0.8, sscDelta: 5 },
  { word: 'deprimid', mood: 'sadness', valence: -0.9, sscDelta: 6 },
  { word: 'desanim', mood: 'sadness', valence: -0.7, sscDelta: 4 },
  { word: 'sozinh', mood: 'sadness', valence: -0.6, sscDelta: 3 },
  { word: 'nostalg', mood: 'sadness', valence: -0.3, sscDelta: 2 },
  // Cansaço
  { word: 'cansad', mood: 'tired', valence: -0.5, sscDelta: 6 },
  { word: 'exaust', mood: 'tired', valence: -0.8, sscDelta: 10 },
  { word: 'sono', mood: 'tired', valence: -0.4, sscDelta: 5 },
  { word: 'fatig', mood: 'tired', valence: -0.7, sscDelta: 8 },
  { word: 'esgot', mood: 'tired', valence: -0.9, sscDelta: 12 },
  { word: 'dormir', mood: 'tired', valence: -0.2, sscDelta: 3 },
  // Desmotivação
  { word: 'desmotivad', mood: 'demotivated', valence: -0.7, sscDelta: 4 },
  { word: 'pregui', mood: 'demotivated', valence: -0.5, sscDelta: 3 },
  { word: 'procrastin', mood: 'demotivated', valence: -0.6, sscDelta: 4 },
  { word: 'sem vontade', mood: 'demotivated', valence: -0.7, sscDelta: 5 },
  { word: 'nao quero', mood: 'demotivated', valence: -0.5, sscDelta: 3 },
  // Foco
  { word: 'focad', mood: 'focused', valence: 0.7, sscDelta: -5 },
  { word: 'concentr', mood: 'focused', valence: 0.6, sscDelta: -4 },
  { word: 'produtiv', mood: 'focused', valence: 0.8, sscDelta: -6 },
  { word: 'rendend', mood: 'focused', valence: 0.7, sscDelta: -5 },
  { word: 'fluindo', mood: 'focused', valence: 0.8, sscDelta: -5 },
  // Motivação
  { word: 'motivad', mood: 'motivated', valence: 0.8, sscDelta: -6 },
  { word: 'determin', mood: 'motivated', valence: 0.7, sscDelta: -5 },
  { word: 'dedicad', mood: 'motivated', valence: 0.6, sscDelta: -4 },
  { word: 'dispost', mood: 'motivated', valence: 0.6, sscDelta: -4 },
  { word: 'vontade', mood: 'motivated', valence: 0.5, sscDelta: -3 },
  // Alegria
  { word: 'feliz', mood: 'happy', valence: 1.0, sscDelta: -8 },
  { word: 'alegre', mood: 'happy', valence: 0.9, sscDelta: -7 },
  { word: 'contente', mood: 'happy', valence: 0.7, sscDelta: -5 },
  { word: 'otimist', mood: 'happy', valence: 0.8, sscDelta: -6 },
  { word: 'bem', mood: 'happy', valence: 0.4, sscDelta: -3 },
  // Energia
  { word: 'energ', mood: 'energetic', valence: 0.8, sscDelta: -7 },
  { word: 'dispos', mood: 'energetic', valence: 0.6, sscDelta: -5 },
  { word: 'ativo', mood: 'energetic', valence: 0.5, sscDelta: -4 },
  { word: 'acordad', mood: 'energetic', valence: 0.3, sscDelta: -2 },
];

const NEGATION_WORDS = ['nao', 'nunca', 'jamais', 'nem'];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '');
}

function hasNegation(words: string[], index: number): boolean {
  for (let i = Math.max(0, index - 3); i < index; i++) {
    if (NEGATION_WORDS.includes(words[i])) return true;
  }
  return false;
}

export interface EmotionResult {
  mood: MoodType;
  valence: number;
  sscDelta: number;
  matchCount: number;
}

/**
 * Engine de emoção local baseada em regras.
 * Substituir por API de NLP se precisar de análise mais profunda.
 */
export function detectEmotion(text: string): EmotionResult {
  const normalized = normalize(text);
  const words = normalized.split(/\s+/);

  let totalValence = 0;
  let totalSscDelta = 0;
  let matchCount = 0;
  const moodCounts: Record<string, number> = {};

  for (const word of words) {
    for (const entry of EMOTION_DICTIONARY) {
      if (word.includes(entry.word)) {
        const wordIndex = words.indexOf(word);
        if (hasNegation(words, wordIndex)) continue;

        totalValence += entry.valence;
        totalSscDelta += entry.sscDelta;
        matchCount++;
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
        break;
      }
    }
  }

  if (matchCount === 0) {
    return { mood: 'neutral', valence: 0, sscDelta: 0, matchCount: 0 };
  }

  // Find dominant mood
  let dominantMood: MoodType = 'neutral';
  let maxCount = 0;
  for (const [mood, count] of Object.entries(moodCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantMood = mood as MoodType;
    }
  }

  return {
    mood: dominantMood,
    valence: totalValence / matchCount,
    sscDelta: Math.round(totalSscDelta / matchCount),
    matchCount,
  };
}

export function getMoodColor(mood: MoodType): string {
  const colors: Record<MoodType, string> = {
    stress: '#ef4444',
    anxiety: '#f59e0b',
    sadness: '#a855f7',
    tired: '#a855f7',
    demotivated: '#a855f7',
    focused: '#10b981',
    motivated: '#10b981',
    happy: '#10b981',
    energetic: '#10b981',
    neutral: '#10b981',
  };
  return colors[mood];
}

export function getMoodBodyClass(mood: MoodType): string {
  const classes: Record<MoodType, string> = {
    stress: 'mood-stress',
    anxiety: 'mood-anxiety',
    sadness: 'mood-sad',
    tired: 'mood-sad',
    demotivated: 'mood-sad',
    focused: 'mood-focus',
    motivated: 'mood-focus',
    happy: 'mood-focus',
    energetic: 'mood-focus',
    neutral: 'mood-focus',
  };
  return classes[mood];
}

export function getEmpathicPrefix(mood: MoodType): string {
  const phrases: Record<MoodType, string[]> = {
    stress: ['Percebo que você está sob pressão. Vamos com calma.', 'Entendo que está se sentindo sobrecarregado.'],
    anxiety: ['Sinto que você está ansioso. Respire fundo comigo.', 'Sei que é um momento de preocupação.'],
    sadness: ['Percebo uma tristeza no ar. Estou aqui para ajudar.', 'Nem todo dia é fácil, e tudo bem.'],
    tired: ['Você parece cansado. Que tal fazermos algo mais leve?', 'Seu corpo e mente precisam de descanso.'],
    demotivated: ['Sei que está sem motivação. Vamos tentar algo pequeno?', 'Cada passo conta, mesmo os pequenos.'],
    focused: ['Que bom que você está focado! Vamos aproveitar isso.', 'Ótimo momento para produzir!'],
    motivated: ['Adoro ver essa motivação! Vamos nessa!', 'Energia no auge! Vamos transformar em resultado.'],
    happy: ['Que bom ver você feliz! Vamos manter essa energia.', 'Alegria contagia! Vamos estudar com esse ânimo.'],
    energetic: ['Energia total! Vamos canalizar isso para os estudos.', 'Disposição no máximo! Bora estudar!'],
    // Humor neutro nao leva prefixo: a resposta vai direto ao ponto.
    // Nao e um campo esvaziado por engano, e o comportamento documentado
    // pelo teste "returns empty string for neutral".
    neutral: ['', ''],
  };
  const options = phrases[mood] || [''];
  return options[Math.floor(Math.random() * options.length)];
}
