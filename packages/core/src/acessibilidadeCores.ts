/**
 * Cores de SINAL (acerto, erro, aviso) por tipo de daltonismo.
 *
 * O web aplica um filtro de cor na página inteira; o React Native não
 * tem filtro de tela. Aqui a troca é onde importa: verde e vermelho de
 * acerto e erro são justamente o par que protanopia e deuteranopia (8%
 * dos meninos) não separam. Paletas da família Okabe-Ito, e o ícone
 * (certo, xis) continua junto da cor: cor nunca é o único sinal.
 *
 * Os nomes são os do painel de acessibilidade do web (`TipoDaltonismo`),
 * guardados na mesma chave do aparelho (`mm_acessibilidade`).
 */
export type ModoDaltonismo =
  | 'normal'
  | 'protanopia' | 'protanomaly' | 'deuteranopia' | 'deuteranomaly'
  | 'tritanopia' | 'tritanomaly' | 'achromatopsia' | 'achromatomaly';

export interface CoresSinal {
  acerto: string;
  acertoFundo: string;
  erro: string;
  erroFundo: string;
  aviso: string;
}

const PADRAO: CoresSinal = { acerto: '#047857', acertoFundo: '#ECFDF5', erro: '#B91C1C', erroFundo: '#FEF2F2', aviso: '#B45309' };

/* Azul contra laranja: o par que protan e deutan separam bem. */
const AZUL_LARANJA: CoresSinal = { acerto: '#005A8C', acertoFundo: '#E6F2FA', erro: '#A33B00', erroFundo: '#FDEEE6', aviso: '#6B4E00' };

/* Tritan confunde azul com verde e amarelo com violeta: vermelho contra azul-esverdeado escuro. */
const TRITAN: CoresSinal = { acerto: '#00665A', acertoFundo: '#E6F4F1', erro: '#B4003C', erroFundo: '#FCE8EE', aviso: '#8A3B00' };

export function coresDeSinal(modo: ModoDaltonismo | string | null | undefined): CoresSinal {
  const m = String(modo ?? '');
  if (m.startsWith('prot') || m.startsWith('deut')) return AZUL_LARANJA;
  if (m.startsWith('trit')) return TRITAN;
  // Sem cor nenhuma, o que separa é a claridade e o ícone: azul escuro contra laranja.
  if (m.startsWith('achroma')) return AZUL_LARANJA;
  return PADRAO;
}

export const MODOS_DALTONISMO: { id: ModoDaltonismo; rotulo: string; texto: string }[] = [
  { id: 'normal', rotulo: 'Cores padrão', texto: 'Verde para acerto, vermelho para erro' },
  { id: 'protanopia', rotulo: 'Protanopia ou protanomalia', texto: 'Vermelho fraco ou ausente' },
  { id: 'deuteranopia', rotulo: 'Deuteranopia ou deuteranomalia', texto: 'Verde fraco ou ausente' },
  { id: 'tritanopia', rotulo: 'Tritanopia ou tritanomalia', texto: 'Azul e amarelo trocados' },
  { id: 'achromatopsia', rotulo: 'Acromatopsia', texto: 'Pouca ou nenhuma cor' },
];
