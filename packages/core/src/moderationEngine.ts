/*
 * Termos bloqueados. Comparados por PALAVRA INTEIRA no texto sem acento:
 * a versão anterior usava `includes`, e "cu" bloqueava "cálculo",
 * "circunferência", "cubo", "curso", "cultura" e "escuta" (o aluno não
 * conseguia perguntar de matemática no chat da liga).
 *
 * "crente" saiu da lista: é identidade religiosa, não palavrão. Bloquear
 * "sou crente" é discriminar quem escreve, não proteger quem lê.
 */
const PALAVROES = [
  'caralho', 'porra', 'merda', 'foda', 'fodase', 'foda se', 'buceta', 'cu',
  'puta', 'putaria', 'babaca', 'arrombado', 'arrombada', 'desgraca', 'vsf',
  'vai tomar no cu', 'seu merda', 'cacete', 'pqp', 'puta que pariu',
  'filho da puta', 'fdp', 'vagabundo', 'vagabunda', 'viado', 'bixa', 'bicha',
  'otario', 'idiota', 'imbecil', 'retardado', 'boquete', 'bosta', 'cusao',
  'pau no cu', 'pau no seu cu', 'tnc', 'vai se fuder', 'vsfd',
  'escroto', 'escrota', 'pilantra', 'trouxa',
];

/*
 * Agressão dirigida a alguém. Cada padrão exige o alvo ("você é",
 * "seu/sua", "cala a boca"): solto, "vai estudar" e "some os valores"
 * (soma, em matemática) eram lidos como bullying.
 */
const PADROES_BULLYING = [
  /\b(voce|vc|tu)\s+(e|eh|es)\s+(um\s+|uma\s+|muito\s+)?(merda|idiota|burr[oa]|inutil|horrivel|lixo|pessim[oa]|fracasso|feio|feia|gord[oa]|ridicul[oa])\b/,
  /\bcala\s+(a\s+)?boca\b/,
  /\b(ninguem|nao)\s+(gosta|aguenta|suporta)\s+de\s+(voce|vc|ti)\b/,
  /\bvai\s+(morrer|se\s+matar|tomar\s+no)\b/,
  /\b(some|desaparece|vaza)\s+(daqui|desse\s+chat|da\s+liga)\b/,
  /\b(odeio|detesto|tenho\s+nojo\s+de|tenho\s+asco\s+de)\s+(voce|vc|ti)\b/,
  /\bsua\s+(puta|vadia|galinha|vagabunda)\b/,
];

const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+/i;

export interface ModerationResult {
  aprovado: boolean;
  razao?: string;
  textoLimpio: string;
}

/** Minúsculas, sem acento, pontuação vira espaço: "Cálculo!" -> "calculo". */
export function normalizarParaModeracao(texto: string): string {
  return ` ${texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

function contemPalavrao(texto: string): string | null {
  const normal = normalizarParaModeracao(texto);
  // Espaço dos dois lados: casa só palavra (ou expressão) inteira.
  return PALAVROES.some((p) => normal.includes(` ${p} `)) ? 'Palavra imprópria detectada' : null;
}

function contemBullying(texto: string): string | null {
  const normal = normalizarParaModeracao(texto);
  return PADROES_BULLYING.some((padrao) => padrao.test(normal)) ? 'Conteúdo ofensivo ou bullying detectado' : null;
}

function contemLink(texto: string): boolean {
  return URL_REGEX.test(texto);
}

function limparTexto(texto: string): string {
  return texto
    .split(/(\s+)/)
    .map((parte) => (PALAVROES.includes(normalizarParaModeracao(parte).trim()) ? '***' : parte))
    .join('');
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
