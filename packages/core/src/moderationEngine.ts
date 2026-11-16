const PALAVROES = [
  'caralho', 'porra', 'merda', 'foda', 'fodase', 'foda-se', 'buceta', 'cu',
  'puta', 'putaria', 'babaca', 'arrombado', 'desgraça', 'desgraca', 'vsf',
  'vai tomar no cu', 'seu merda', 'cacete', 'pqp', 'puta que pariu',
  'filho da puta', 'fdp', 'vagabundo', 'viado', 'bixa', 'bicha',
  'otario', 'otário', 'idiota', 'imbecil', 'retardado', 'crente',
  'chupa', 'chupinha', 'boquete', 'bosta', 'cusão', 'cusao',
  'pau no cu', 'pau no seu cu', 'tnc', 'vai se fuder', 'vsfd',
  'arrombada', 'escroto', 'escrota', 'pilantra', 'trouxa',
];

const PADROES_BULLYING = [
  /voce\s+[ée]\s+(um\s+)?(merda|idiota|burro|inutil|horrivel|lixo|pessimo|fracasso)/i,
  /(cala|calado|cala\s+a\s+boca)\s*(sua|seu)?/i,
  /(ninguem|não|nao)\s+(gosta|aguenta|suporta)\s+de\s+voce/i,
  /(feio|feia|gordo|gorda|burro|burra|ridiculo|ridicula)\s*(demais|pra\s+caralho)?/i,
  /vai\s+(estudar|trabalhar|morrer|sumir|embora|tomar)/i,
  /(some|desaparece|vaza|cai\s+fora)\s*(daqui|desse\s+chat)?/i,
  /(odeio|detesto|nojo|asco)\s+(de\s+)?voce/i,
  /sua\s+(puta|vadia|galinha|vagabunda)/i,
];

const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+/i;

export interface ModerationResult {
  aprovado: boolean;
  razao?: string;
  textoLimpio: string;
}

function contemPalavrao(texto: string): string | null {
  const lower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const p of PALAVROES) {
    const regex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(texto) || lower.includes(p)) {
      return `Palavra imprópria detectada`;
    }
  }
  return null;
}

function contemBullying(texto: string): string | null {
  for (const padrao of PADROES_BULLYING) {
    if (padrao.test(texto)) {
      return `Conteúdo ofensivo/bullying detectado`;
    }
  }
  return null;
}

function contemLink(texto: string): boolean {
  return URL_REGEX.test(texto);
}

function limparTexto(texto: string): string {
  let limpo = texto;
  for (const p of PALAVROES) {
    const regex = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    limpo = limpo.replace(regex, '***');
  }
  return limpo;
}

export function moderar(texto: string): ModerationResult {
  const trimmed = texto.trim();
  if (!trimmed) return { aprovado: false, razao: 'Mensagem vazia', textoLimpio: '' };

  const palavrao = contemPalavrao(trimmed);
  if (palavrao) {
    return { aprovado: false, razao: palavrao, textoLimpio: limparTexto(trimmed) };
  }

  const bullying = contemBullying(trimmed);
  if (bullying) {
    return { aprovado: false, razao: bullying, textoLimpio: '' };
  }

  if (contemLink(trimmed)) {
    return { aprovado: false, razao: 'Links externos não são permitidos', textoLimpio: '' };
  }

  return { aprovado: true, textoLimpio: trimmed };
}

export const MATERIAS_COMUNIDADE = [
  'Matemática', 'Português', 'Biologia', 'Física', 'Química',
  'História', 'Geografia', 'Filosofia', 'Sociologia', 'Inglês',
  'Redação', 'Geral',
];
