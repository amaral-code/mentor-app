/**
 * Mensagem de risco: quando o aluno escreve que pensa em se machucar.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO NÃO PASSA PELA IA
 * ------------------------------------------------------------------
 * Antes, "não aguento mais, quero me matar" seguia o caminho de qualquer
 * dúvida de matéria. Com a IA no ar, a resposta dependia do modelo; com
 * a IA fora do ar, o aluno lia "não encontrei informações sobre aguento,
 * quero, matar na minha base local". Nos dois casos o CVV não aparecia.
 *
 * Para esta mensagem a resposta é FIXA e sai do próprio app: não depende
 * de rede, de chave, de cota nem do humor de um modelo. É o único ponto
 * do Mentor em que previsibilidade vale mais que personalização.
 *
 * A detecção é por expressão, de propósito conservadora para o lado do
 * acolhimento: um falso positivo mostra um telefone de apoio a quem não
 * precisava; um falso negativo deixa sem resposta quem precisava.
 * Hipérbole comum de estudante ("essa prova vai me matar", "vou me matar
 * de estudar") fica de fora, senão o aviso vira ruído e perde o peso.
 */

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quem fala de si: "quero", "vou", "penso em", "tenho vontade de". */
const INTENCAO = '(?:quero|queria|vou|penso em|pensando em|pensei em|pensado em|vontade de|preciso|tentei|vou tentar|planejo|planejando)';
const ATO =
  '(?:me matar|morrer|sumir|desaparecer|acabar com tudo|acabar com a minha vida|acabar com minha vida|tirar a minha vida|tirar minha vida|me machucar|me cortar|me ferir|nao existir|deixar de existir|dar um fim)';

const PADROES: RegExp[] = [
  // `(?! com)`: "quero sumir com essa dúvida" fala da dúvida, não de si.
  new RegExp(`\\b${INTENCAO}\\b(?: \\w+){0,3} ${ATO}\\b(?! com\\b)`),
  /\bsuicid/,
  /\bme mato\b/,
  /\bautomutila/,
  /\bautolesa/,
  /\bnao quero (?:mais )?viver\b/,
  /\bnao aguento mais viver\b/,
  /\bcansei de viver\b/,
  /\bnao vale (?:mais )?a pena viver\b/,
  /\b(?:todos|todo mundo|eles|voces) (?:ficariam|ficaria|estariam|vao ficar) melhor sem mim\b/,
  /\bmelhor (?:se eu|eu) (?:nao existisse|morresse|sumisse)\b/,
  /\bninguem (?:ia|iria|vai) sentir (?:a )?(?:minha )?falta\b/,
  /\bnao vejo (?:mais )?saida\b/,
  /\bquero (?:me )?(?:sumir|desaparecer) (?:pra|para) sempre\b/,
];

/** Hipérbole de estudo: o "ato" seguido de "de estudar", "de rir", "de tanto". */
const HIPERBOLE = /\b(?:me matar|morrer|me mato) de (?:estudar|rir|trabalhar|tanto|vergonha|sono|fome|calor|frio|saudade|tedio|cansaco)\b/;

export function detectarRiscoDeCrise(texto: string): boolean {
  const limpo = normalizar(texto || '');
  if (!limpo) return false;
  const semHiperbole = limpo.replace(new RegExp(HIPERBOLE.source, 'g'), ' ');
  return PADROES.some((p) => p.test(semHiperbole));
}

/**
 * Resposta fixa. Curta, sem diagnóstico e sem promessa: reconhece, dá o
 * telefone que atende agora e aponta um adulto e a Rede de Apoio.
 */
export const MENSAGEM_ACOLHIMENTO = [
  'Sinto muito que você esteja passando por isso. O que você sente importa, e você não precisa enfrentar isso sem ajuda.',
  'Se estiver pensando em se machucar, ligue agora para o CVV, no número 188. A ligação é gratuita e funciona 24 horas. Também dá para conversar por chat em cvv.org.br. Em emergência, ligue 192 (SAMU).',
  'Se puder, fale também com um adulto em quem você confia. Aqui no app, a aba Agenda leva à Rede de Apoio, onde você pode marcar uma conversa com um psicólogo.',
].join('\n\n');

/**
 * Aviso que acompanha a resposta da base local quando a IA não respondeu.
 * Sem ele o aluno lia um trecho pronto (às vezes de outro assunto) como
 * se fosse o Mentor respondendo à pergunta dele.
 */
export const AVISO_IA_FORA_DO_AR =
  'A inteligência artificial não respondeu agora, então esta resposta veio da base local do app, que é limitada e pode não tratar exatamente da sua pergunta. Tente de novo em instantes para a resposta completa.';
