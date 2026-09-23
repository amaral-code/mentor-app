import { KBEntry, QuizQuestion } from '../types';

/**
 * Mecanismo de busca em base de conhecimento local.
 * 100% rule-based, sem LLM. Substituir por API (ex: Claude) quando disponível.
 */

const STOPWORDS_PT = [
  'a',
  'o',
  'e',
  'é',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'por',
  'com',
  'sem',
  'como',
  'que',
  'se',
  'mas',
  'mais',
  'menos',
  'ao',
  'aos',
  'às',
  'um',
  'uma',
  'uns',
  'umas',
  'ele',
  'ela',
  'eles',
  'elas',
  'meu',
  'minha',
  'seu',
  'sua',
  'nosso',
  'nossa',
  'eu',
  'tu',
  'você',
  'nós',
  'vós',
  'lá',
  'cá',
  'ali',
  'aqui',
  'sim',
  'não',
  'nao',
  'também',
  'tambem',
  'já',
  'ja',
  'ainda',
  'muito',
  'pouco',
  'todo',
  'toda',
  'todos',
  'todas',
  'algum',
  'alguma',
  'uns',
  'umas',
  'isso',
  'isto',
  'aquilo',
  'esse',
  'essa',
  'este',
  'esta',
  'aquele',
  'aquela',
  'em',
  'entre',
  'sobre',
  'após',
  'apos',
  'antes',
  'depois',
  'durante',
  'até',
  'ate',
  'desde',
  'contra',
];

const FAQS: KBEntry[] = [
  {
    id: 'faq_1',
    keywords: ['enem', 'o que', 'como funciona'],
    content:
      'O ENEM é o Exame Nacional do Ensino Médio, composto por 4 provas objetivas (Linguagens, Matemática, Ciências Humanas, Ciências da Natureza) e uma Redação.',
    source: 'faq',
  },
  {
    id: 'faq_2',
    keywords: ['tri', 'nota', 'como calcula'],
    content:
      'A TRI (Teoria de Resposta ao Item) é o método usado pelo ENEM para calcular sua nota. Diferente de provas comuns, cada questão tem um peso diferente: questões fáceis valem menos que difíceis. Um padrão coerente de acertos (acertar fáceis e médias) vale mais que acertar aleatoriamente uma difícil e errar fáceis.',
    source: 'faq',
  },
  {
    id: 'faq_3',
    keywords: ['redacao', 'nota', 'enem', 'como fazer'],
    content:
      'A redação do ENEM é avaliada em 5 competências (0-200 cada, total 0-1000): 1) Domínio da norma culta, 2) Compreensão do tema, 3) Seleção e organização de informações (repertório), 4) Coesão textual (conectivos), 5) Proposta de intervenção (agente + ação). Mínimo de 150 palavras.',
    source: 'faq',
  },
  {
    id: 'faq_4',
    keywords: ['estudar', 'como', 'dica', 'rotina'],
    content:
      'Para uma rotina eficiente: 1) Defina um horário fixo de estudos, 2) Use a técnica Pomodoro (25/5) ou Rota Ultra (10 min de foco total), 3) Alterne matérias para não cansar, 4) Revise o conteúdo em até 24h, 5) Faça exercícios regularmente. O segredo é consistência, não intensidade.',
    source: 'faq',
  },
  {
    id: 'faq_5',
    keywords: ['sono', 'estudar', 'impacto'],
    content:
      'Dormir bem é essencial para a memorização. Durante o sono, o cérebro consolida o que aprendeu. Ideal: 7-9h por noite. Evite estudar até tarde: o rendimento cai drasticamente após as 22h.',
    source: 'faq',
  },
  {
    id: 'faq_6',
    keywords: ['ansiedade', 'prova', 'calma', 'nervoso'],
    content:
      'Ansiedade antes de prova é normal! Técnicas que ajudam: 1) Respiração 4-7-8 (inspira 4s, segura 7s, expira 8s), 2) Estudo simulado (resolver provas antigas no mesmo horário), 3) Chegar cedo ao local, 4) Evitar conversas sobre conteúdo na hora da prova.',
    source: 'faq',
  },
  {
    id: 'faq_7',
    keywords: ['concurso', 'enem', 'sisu', 'nota corte'],
    content:
      'Com a nota do ENEM você pode entrar em universidades pelo SISU (públicas), PROUNI (bolsas em particulares) e FIES (financiamento). Cada curso tem uma nota de corte que varia ano a ano. Quanto mais concorrido, maior a nota necessária.',
    source: 'faq',
  },
  {
    id: 'faq_8',
    keywords: ['habito', 'estudo', 'como criar'],
    content:
      'Criar hábito de estudo leva em média 21 dias. Comece pequeno: 5-10 minutos por dia no mesmo horário. Use gatilhos (ex: após o café, estudar 10 min). Registre seu progresso: ver a sequência de dias motiva a continuar.',
    source: 'faq',
  },
  {
    id: 'faq_9',
    keywords: ['motivacao', 'motivação', 'sem vontade'],
    content:
      'Motivação vem depois da ação, não antes. Quando estiver sem vontade: 1) Comece com apenas 2 minutos, 2) Lembre-se do seu objetivo maior (por que você está estudando?), 3) Crie um ambiente agradável de estudo. Ação gera motivação.',
    source: 'faq',
  },
  {
    id: 'faq_10',
    keywords: ['relaxar', 'descanso', 'pausa'],
    content:
      'Pausas são parte do estudo! O cérebro precisa de descanso para processar informações. A cada 50 min de estudo, faça 10 min de pausa ativa (esticar, caminhar, olhar para longe). Nos fins de semana, reserve um dia para descanso total.',
    source: 'faq',
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS_PT.includes(w));
}

export function buildKBFromQuiz(questions: QuizQuestion[]): KBEntry[] {
  return questions.map((q) => ({
    id: `kb_quiz_${q.id}`,
    keywords: tokenize(q.enunciado),
    content: `Pergunta: ${q.enunciado}\nResposta: ${q.alternativas[q.correta]}\nExplicação: ${q.explicacao}`,
    source: 'quiz' as const,
  }));
}

export function searchKB(message: string, kb: KBEntry[]): { entry: KBEntry; score: number } | null {
  const tokens = tokenize(message);
  if (tokens.length === 0) return null;

  const minScore = tokens.length <= 2 ? 1 : 2;
  let bestMatch: { entry: KBEntry; score: number } | null = null;

  for (const entry of kb) {
    let score = 0;
    for (const token of tokens) {
      for (const kw of entry.keywords) {
        if (kw.includes(token) || token.includes(kw)) {
          score++;
        }
      }
    }
    if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { entry, score };
    }
  }

  return bestMatch;
}

export function matchSubject(message: string): string | null {
  const subjects: Record<string, string[]> = {
    Matemática: [
      'matemática',
      'matematica',
      'conta',
      'calculo',
      'calcular',
      'fórmula',
      'formula',
      'equação',
      'equacao',
      'geometria',
      'algebra',
      'álgebra',
      'trigonometria',
    ],
    Português: [
      'português',
      'portugues',
      'gramática',
      'gramatica',
      'ortografia',
      'sintaxe',
      'concordância',
      'concordancia',
      'regência',
      'regencia',
      'crase',
    ],
    História: [
      'história',
      'historia',
      'histórico',
      'historico',
      'guerra',
      'revolução',
      'revolucao',
      'império',
      'imperio',
      'colonização',
      'colonizacao',
      'brasil colônia',
      'republica',
      'república',
    ],
    Geografia: [
      'geografia',
      'mapa',
      'clima',
      'relevo',
      'população',
      'populacao',
      'urbano',
      'rural',
      'globalização',
      'globalizacao',
      'meio ambiente',
    ],
    Biologia: [
      'biologia',
      'célula',
      'celula',
      'dna',
      'genética',
      'genetica',
      'evolução',
      'evolucao',
      'ecologia',
      'corpo humano',
      'fotossíntese',
      'fotossintese',
    ],
    Física: [
      'física',
      'fisica',
      'movimento',
      'força',
      'forca',
      'energia',
      'ondas',
      'eletricidade',
      'termologia',
      'óptica',
      'optica',
    ],
    Química: [
      'química',
      'quimica',
      'átomo',
      'atomo',
      'reação',
      'reacao',
      'molécula',
      'molecula',
      'ligação',
      'ligacao',
      'tabela periódica',
      'tabela periodica',
    ],
    Filosofia: [
      'filosofia',
      'filósofo',
      'filosofo',
      'sócrates',
      'socrates',
      'platão',
      'platao',
      'aristóteles',
      'aristoteles',
      'ética',
      'etica',
      'moral',
    ],
    Inglês: [
      'inglês',
      'ingles',
      'english',
      'vocabulary',
      'grammar',
      'reading',
      'interpretação',
      'interpretacao',
    ],
    Sociologia: ['sociologia', 'sociedade', 'classe social', 'cultura', 'movimento social', 'trabalho'],
  };

  const lower = message.toLowerCase();
  for (const [subject, keywords] of Object.entries(subjects)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return subject;
    }
  }
  return null;
}

export function extractKeywords(text: string): string[] {
  return tokenize(text).slice(0, 5);
}

export const SPECIAL_RESPONSES: Record<string, string> = {
  ola: 'Olá! Sou seu Mentor ENEM offline. Estou aqui para ajudar com dicas de estudo, correção de redação, quizzes e muito mais. Como posso ajudar?',
  oi: 'Olá! Sou seu Mentor ENEM offline. Estou aqui para ajudar com dicas de estudo, correção de redação, quizzes e muito mais. Como posso ajudar?',
  'bom dia': 'Bom dia! Como posso ajudar nos seus estudos hoje?',
  'boa tarde': 'Boa tarde! Preparado para estudar?',
  'boa noite': 'Boa noite! Que tal revisar o que aprendeu hoje?',
  obrigado: 'Por nada! Continue estudando que o resultado vem!',
  obrigada: 'Por nada! Continue estudando que o resultado vem!',
  valeu: 'Disponha! Bora continuar!',
  'quem é você':
    'Sou o Mentor ENEM, um assistente de estudos offline! Diferente de IAs generativas como ChatGPT, eu não tenho uma rede neural: funciono com base em um banco de conhecimento local com regras e buscas por palavras-chave. Não gero conteúdo novo, apenas busco na base de conhecimento preparada por educadores.',
  'quem e voce':
    'Sou o Mentor ENEM, um assistente de estudos offline! Diferente de IAs generativas, funciono com base em um banco de conhecimento local com regras e buscas por palavras-chave.',
  'quem criou você':
    'Fui criado como um assistente de estudos para o ENEM, 100% offline e gratuito! Meu objetivo é ajudar estudantes a se prepararem para o exame sem depender de internet ou APIs pagas.',
  'quem criou voce': 'Fui criado como um assistente de estudos para o ENEM, 100% offline e gratuito!',
};

export { FAQS };
