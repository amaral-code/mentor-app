import { EssayCorrection } from '../types';
import { correctEssayWithAI as aiCorrect } from './aiService';

const GIRIAS = ['tipo', 'tlgd', 'mano', 'parceiro', 'meu', 'brother', 'fml', 'tranquilo', 'suave', 'tô', 'tava', 'pra caramba', 'muito louco', 'da hora', 'legalzinho'];

const CONECTIVOS = ['portanto', 'assim', 'logo', 'contudo', 'entretanto', 'no entanto', 'todavia', 'ademais', 'além disso', 'outrossim', 'por conseguinte', 'consequentemente', 'dessa forma', 'desse modo', 'nesse sentido', 'primeiramente', 'em primeiro lugar', 'por outro lado', 'em contrapartida', 'do mesmo modo', 'analogamente', 'por fim', 'finalmente', 'diante disso', 'frente a isso', 'dado que', 'visto que', 'já que', 'porque', 'pois', 'uma vez que'];

const REPERTORIO_MARKERS = ['segundo', 'de acordo com', 'pesquisa', 'dados do ibge', 'dados da', 'conforme', 'estudo', 'pesquisador', 'cientista', 'filósofo', 'sociólogo', 'historiador', 'segundo a constituição', 'de acordo com a lei', 'como diz', 'nas palavras de'];

const AGENTES = ['governo', 'estado', 'escola', 'mídia', 'ong', 'sociedade', 'ministério', 'prefeitura', 'família', 'comunidade', 'instituição', 'poder público', 'secretaria', 'município', 'empresa', 'universidade'];

const ACAO_VERBOS = ['criar', 'promover', 'investir', 'fiscalizar', 'implementar', 'desenvolver', 'estabelecer', 'garantir', 'propor', 'elaborar', 'incentivar', 'viabilizar', 'ampliar', 'formular', 'executar', 'instituir', 'oferecer', 'capacitar', 'conscientizar', 'disponibilizar'];

const MEIO_VERBOS = ['por meio de', 'através de', 'por meio', 'por intermédio', 'mediante', 'por meio da', 'por meio dos', 'via'];

const FINALIDADE_MARKERS = ['para', 'com o objetivo de', 'a fim de', 'visando', 'de modo a', 'objetivando', 'com a finalidade de', 'para que'];

const ARGUMENTATIVE_MARKERS = ['é necessário', 'é fundamental', 'é preciso', 'é imprescindível', 'é essencial', 'é urgente', 'é inegável', 'é importante', 'é possível afirmar', 'faz-se necessário', 'cabe destacar', 'vale ressaltar', 'é válido destacar', 'percebe-se', 'observa-se', 'nota-se'];

const TITULO_DISCOURSE = ['título', 'titulo'];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
}

function wordFrequency(text: string): Record<string, number> {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  return freq;
}

function containsAny(text: string, list: string[]): string[] {
  const lower = text.toLowerCase();
  return list.filter(item => lower.includes(item));
}

export function correctEssay(text: string, tema?: string): EssayCorrection {
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);
  const paragraphCount = countParagraphs(text);
  const freq = wordFrequency(text);
  const maxFreq = Math.max(...Object.values(freq), 0);
  const foundGirias = containsAny(text, GIRIAS);
  const foundConectivos = containsAny(text, CONECTIVOS);
  const foundRepertorio = containsAny(text, REPERTORIO_MARKERS);
  const foundAgentes = containsAny(text, AGENTES);
  const foundAcao = containsAny(text, ACAO_VERBOS);
  const foundMeio = containsAny(text, MEIO_VERBOS);
  const foundFinalidade = containsAny(text, FINALIDADE_MARKERS);
  const foundArgumentativos = containsAny(text, ARGUMENTATIVE_MARKERS);
  const foundTitulo = containsAny(text, TITULO_DISCOURSE);

  // Competência 1: Domínio da norma culta (0-200)
  let c1 = 200;
  if (maxFreq > 6) c1 -= (maxFreq - 6) * 20;
  if (foundGirias.length > 0) c1 -= foundGirias.length * 30;
  if (wordCount < 150) c1 -= (150 - wordCount) * 2;
  // frases muito longas comprometem a clareza
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  if (avgWordsPerSentence > 40) c1 -= (avgWordsPerSentence - 40) * 2;
  c1 = Math.max(0, Math.min(200, c1));

  // Competência 2: Compreensão do tema (0-200)
  let c2 = 0;
  const temaPalavras = tema ? tema.toLowerCase().split(/\s+/).filter(w => w.length > 3) : [];
  const temaHits = temaPalavras.filter(w => text.toLowerCase().includes(w)).length;
  const temaCoverage = temaPalavras.length > 0 ? temaHits / temaPalavras.length : 0;
  if (wordCount >= 200) c2 += 80;
  if (wordCount >= 280) c2 += 40;
  if (paragraphCount >= 4) c2 += 40;
  if (paragraphCount >= 5) c2 += 20;
  if (temaPalavras.length > 0) c2 += Math.round(temaCoverage * 60);
  c2 += Math.min(20, wordCount * 0.05);
  c2 = Math.max(0, Math.min(200, c2));

  // Competência 3: Seleção e organização de argumentos (0-200)
  let c3 = 0;
  if (paragraphCount >= 4) c3 += 40;
  if (foundRepertorio.length > 0) c3 += Math.min(80, foundRepertorio.length * 20);
  if (foundArgumentativos.length > 0) c3 += Math.min(40, foundArgumentativos.length * 10);
  if (sentenceCount >= 8) c3 += 30;
  if (wordCount >= 200) c3 += 30;
  c3 = Math.max(0, Math.min(200, c3));

  // Competência 4: Coesão e coerência (0-200)
  let c4 = 0;
  const conectivoBonus = foundConectivos.length * 25;
  if (conectivoBonus >= 75) c4 = 150;
  else c4 = conectivoBonus;
  // progressão entre parágrafos e variedade
  if (foundConectivos.length >= 4) c4 += 30;
  if (paragraphCount >= 4) c4 += 20;
  c4 = Math.max(0, Math.min(200, c4));

  // Competência 5: Proposta de intervenção - agente, ação, meio e finalidade (0-200)
  let c5 = 0;
  const hasAgente = foundAgentes.length > 0;
  const hasAcao = foundAcao.length > 0;
  const hasMeio = foundMeio.length > 0;
  const hasFinalidade = foundFinalidade.length > 0;

  if (paragraphCount >= 4) c5 += 20;
  if (hasAgente) c5 += 60;
  if (hasAcao) c5 += 50;
  if (hasMeio) c5 += 40;
  if (hasFinalidade) c5 += 40;
  if (foundTitulo.length > 0 && wordCount >= 200) c5 += 10;
  c5 = Math.max(0, Math.min(200, c5));

  const notaFinal = Math.min(1000, c1 + c2 + c3 + c4 + c5);

  // Generate feedback
  const pontosFortes: string[] = [];
  const pontosMelhorar: string[] = [];

  if (c1 >= 160) pontosFortes.push('Bom domínio da norma culta');
  else if (c1 < 100) pontosMelhorar.push('Revisar concordância e evitar repetições excessivas');
  if (foundGirias.length > 0) pontosMelhorar.push('Evitar linguagem informal e gírias');

  if (c2 >= 160) pontosFortes.push('Boa estruturação do tema');
  else if (c2 < 100) pontosMelhorar.push('Desenvolver melhor o tema proposto');

  if (c3 >= 140) pontosFortes.push('Boa capacidade argumentativa com repertório');
  else if (c3 < 80) pontosMelhorar.push('Utilizar mais repertórios socioculturais (citações, dados, referências)');

  if (c4 >= 140) pontosFortes.push('Boa coesão textual com conectivos variados');
  else if (c4 < 80) pontosMelhorar.push('Utilizar mais conectivos para articular as ideias');

  if (c5 >= 140) pontosFortes.push('Proposta de intervenção completa (agente, ação, meio e finalidade)');
  else if (c5 < 80) {
    if (!hasAgente) pontosMelhorar.push('Detalhar o agente responsável na proposta de intervenção');
    if (!hasAcao) pontosMelhorar.push('Especificar a ação concreta na proposta de intervenção');
    if (!hasMeio) pontosMelhorar.push('Indicar o meio pelo qual a intervenção será executada');
    if (!hasFinalidade) pontosMelhorar.push('Apontar a finalidade/efeito da proposta de intervenção');
  }

  if (wordCount < 150) pontosMelhorar.push('Texto muito curto. Mínimo recomendado: 150 palavras');

  return {
    competencia1: Math.round(c1),
    competencia2: Math.round(c2),
    competencia3: Math.round(c3),
    competencia4: Math.round(c4),
    competencia5: Math.round(c5),
    notaFinal: Math.round(notaFinal),
    pontosFortes,
    pontosMelhorar,
    originalText: text,
  };
}

export async function correctEssayAI(text: string, apiKey: string, tema?: string): Promise<EssayCorrection> {
  const raw = await aiCorrect(text, apiKey, tema);
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      competencia1: Math.min(200, Math.max(0, Math.round(parsed.competencia1 ?? 0))),
      competencia2: Math.min(200, Math.max(0, Math.round(parsed.competencia2 ?? 0))),
      competencia3: Math.min(200, Math.max(0, Math.round(parsed.competencia3 ?? 0))),
      competencia4: Math.min(200, Math.max(0, Math.round(parsed.competencia4 ?? 0))),
      competencia5: Math.min(200, Math.max(0, Math.round(parsed.competencia5 ?? 0))),
      notaFinal: Math.min(1000, Math.max(0, Math.round(parsed.notaFinal ?? 0))),
      pontosFortes: Array.isArray(parsed.pontosFortes) ? parsed.pontosFortes.slice(0, 5) : [],
      pontosMelhorar: Array.isArray(parsed.pontosMelhorar) ? parsed.pontosMelhorar.slice(0, 5) : [],
      originalText: text,
    };
  } catch {
    const fallback = correctEssay(text, tema);
    return { ...fallback, pontosFortes: ['Correção por IA indisponível. Usamos a correção offline', ...fallback.pontosFortes] };
  }
}
