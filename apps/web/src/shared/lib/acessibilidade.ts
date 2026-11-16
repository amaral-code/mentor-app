/**
 * CENTRAL DE ACESSIBILIDADE.
 *
 * Um lugar só para as sensibilidades do app: tamanho da fonte, alto
 * contraste, redução de movimento e filtro de daltonismo. Tudo mora no
 * aparelho (localStorage, com try/catch) e é aplicado no <html> — então
 * vale para TODAS as telas, inclusive o login, e sobrevive ao F5.
 *
 * Como usar:
 *   aplicarAcessibilidade()  — no boot (main.tsx) e ao mudar qualquer ajuste
 *   lerAcessibilidade()      — estado atual para pintar o painel
 *   salvarAcessibilidade(p)  — persiste + aplica
 */

import { safeGet, safeSet } from './safeStorage';

export type TamanhoFonte = 'normal' | 'grande' | 'extra';

export type TipoDaltonismo =
  | 'normal'
  | 'protanopia' | 'protanomaly' | 'deuteranopia' | 'deuteranomaly'
  | 'tritanopia' | 'tritanomaly' | 'achromatopsia' | 'achromatomaly';

export interface PreferenciasAcessibilidade {
  tamanhoFonte: TamanhoFonte;
  altoContraste: boolean;
  reduzirMovimento: boolean;
  daltonismo: TipoDaltonismo;
}

const CHAVE = 'mm_acessibilidade';
const CHAVE_DALTONISMO_LEGADA = 'mm_color_blindness';

export const DALTONISMO_OPCOES: { tipo: TipoDaltonismo; rotulo: string; grupo: string }[] = [
  { tipo: 'normal', rotulo: 'Sem filtro', grupo: '' },
  { tipo: 'protanopia', rotulo: 'Protanopia (sem vermelho)', grupo: 'Vermelho-Verde' },
  { tipo: 'protanomaly', rotulo: 'Protanomalia (vermelho fraco)', grupo: 'Vermelho-Verde' },
  { tipo: 'deuteranopia', rotulo: 'Deuteranopia (sem verde)', grupo: 'Vermelho-Verde' },
  { tipo: 'deuteranomaly', rotulo: 'Deuteranomalia (verde fraco)', grupo: 'Vermelho-Verde' },
  { tipo: 'tritanopia', rotulo: 'Tritanopia (sem azul)', grupo: 'Azul-Amarelo' },
  { tipo: 'tritanomaly', rotulo: 'Tritanomalia (azul fraco)', grupo: 'Azul-Amarelo' },
  { tipo: 'achromatopsia', rotulo: 'Acromatopsia (sem cores)', grupo: 'Completo' },
  { tipo: 'achromatomaly', rotulo: 'Acromatomalia (cores fracas)', grupo: 'Completo' },
];

const PADRAO: PreferenciasAcessibilidade = {
  tamanhoFonte: 'normal',
  altoContraste: false,
  reduzirMovimento: false,
  daltonismo: 'normal',
};

function valido(p: any): p is PreferenciasAcessibilidade {
  if (!p || typeof p !== 'object') return false;
  if (!['normal', 'grande', 'extra'].includes(p.tamanhoFonte)) return false;
  if (typeof p.altoContraste !== 'boolean') return false;
  if (typeof p.reduzirMovimento !== 'boolean') return false;
  if (!DALTONISMO_OPCOES.some((o) => o.tipo === p.daltonismo)) return false;
  return true;
}

export function lerAcessibilidade(): PreferenciasAcessibilidade {
  try {
    const bruto = safeGet(CHAVE);
    if (bruto) {
      const p = JSON.parse(bruto);
      if (valido(p)) return p;
    }
    // Migra o ajuste antigo do botão de daltonismo (não perde o filtro).
    const legado = safeGet(CHAVE_DALTONISMO_LEGADA);
    if (legado && DALTONISMO_OPCOES.some((o) => o.tipo === legado)) {
      return { ...PADRAO, daltonismo: legado as TipoDaltonismo };
    }
  } catch {
    /* cai no padrão */
  }
  return { ...PADRAO };
}

export function salvarAcessibilidade(p: PreferenciasAcessibilidade): void {
  safeSet(CHAVE, JSON.stringify(p));
  // Espelha a chave legada para o botão flutuante continuar sincronizado.
  try {
    localStorage.setItem(CHAVE_DALTONISMO_LEGADA, p.daltonismo);
  } catch {
    /* indisponível */
  }
  aplicarAcessibilidade(p);
}

/** Aplica tudo no <html>. Nunca joga (boot e login passam por aqui). */
export function aplicarAcessibilidade(p?: PreferenciasAcessibilidade): void {
  const pref = p ?? lerAcessibilidade();
  try {
    const html = document.documentElement;
    html.style.fontSize =
      pref.tamanhoFonte === 'extra' ? '125%' : pref.tamanhoFonte === 'grande' ? '112.5%' : '';
    html.classList.toggle('a11y-contraste', pref.altoContraste);
    html.classList.toggle('a11y-sem-movimento', pref.reduzirMovimento);
    html.style.filter = pref.daltonismo === 'normal' ? '' : `url(#cb-${pref.daltonismo})`;
  } catch {
    /* DOM indisponível */
  }
}
