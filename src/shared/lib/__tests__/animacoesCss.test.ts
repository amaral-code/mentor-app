import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Toda animacao usada por CSS puro precisa chegar ao navegador.
 *
 * ------------------------------------------------------------------
 * O BUG QUE ESTE TESTE IMPEDE DE VOLTAR
 * ------------------------------------------------------------------
 * Nove animacoes do app estavam mortas em producao. Os keyframes
 * existiam - mas no `tailwind.config.js`, e eram usados por classes de
 * CSS puro (`.skeleton`, `.shimmer-sweep`, `.twinkle-star-fast`...).
 *
 * O Tailwind so emite um keyframe quando a classe `animate-<nome>`
 * correspondente aparece na marcacao. Nenhuma aparecia, entao os
 * keyframes eram removidos do CSS final e cada `animation: <nome>`
 * apontava para o vazio.
 *
 * E em CSS isso NAO e erro: o navegador ignora em silencio. Nada
 * quebrava, nada avisava no console, nenhum teste falhava - a interface
 * so ficava parada. O relato foi "as animacoes de espera estao
 * estaticas"; o shimmer do skeleton era uma das nove.
 *
 * ------------------------------------------------------------------
 * O QUE ESTE TESTE AFIRMA
 * ------------------------------------------------------------------
 * Para cada `animation: <nome>` em CSS puro, o keyframe precisa vir de
 * uma das duas fontes:
 *
 *   a) declarado em `index.css` - viaja sempre, nada remove; ou
 *   b) declarado no tailwind.config E com alguma classe `animate-*`
 *      correspondente realmente usada em `src/`, que e o que faz o
 *      Tailwind emitir aquele keyframe.
 *
 * O caso (b) e fragil de proposito no teste: ele passa hoje, mas se
 * alguem remover o ultimo uso daquela classe, este teste aponta a
 * animacao que acabou de morrer - em vez de a interface ficar parada
 * sem ninguem notar.
 */

const css = readFileSync('src/styles/index.css', 'utf8');
const tw = readFileSync('tailwind.config.js', 'utf8');

/** Nomes citados em `animation:` / `animation-name:`, fora de comentario. */
function animacoesUsadasNoCss(texto: string): string[] {
  const semComentario = texto.replace(/\/\*[\s\S]*?\*\//g, '');
  const nomes = new Set<string>();
  for (const m of semComentario.matchAll(/animation(?:-name)?:\s*([a-zA-Z][\w-]*)/g)) {
    if (m[1] !== 'none') nomes.add(m[1]);
  }
  return [...nomes].sort();
}

const keyframesNoCss = new Set<string>(
  [...css.matchAll(/@keyframes\s+([a-zA-Z][\w-]*)/g)].map((m) => m[1]),
);

/** Mapa `animate-<utilitario>` -> nome do keyframe, lido do tailwind.config. */
function mapaUtilitarios(texto: string): Map<string, string> {
  const mapa = new Map<string, string>();
  const bloco = texto.match(/animation:\s*\{([\s\S]*?)\n\s{6}\}/);
  if (!bloco) return mapa;
  for (const m of bloco[1].matchAll(/['"]?([\w-]+)['"]?:\s*['"]([a-zA-Z][\w-]*)/g)) {
    mapa.set(m[1], m[2]);
  }
  return mapa;
}

/** Classes `animate-*` que aparecem de fato no codigo. */
function utilitariosUsados(): Set<string> {
  const arquivos = (function varrer(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) return varrer(p);
      return /\.(ts|tsx)$/.test(p) && !p.includes('__tests__') ? [p] : [];
    });
  })('src');

  const usados = new Set<string>();
  for (const arquivo of arquivos) {
    for (const m of readFileSync(arquivo, 'utf8').matchAll(/animate-([\w-]+)/g)) usados.add(m[1]);
  }
  return usados;
}

const mapa = mapaUtilitarios(tw);
const usados = utilitariosUsados();

/** Keyframes que o Tailwind vai emitir, por haver classe em uso. */
const emitidosPeloTailwind = new Set<string>(
  [...usados].map((u) => mapa.get(u)).filter((k): k is string => !!k),
);

describe('animacoes do CSS', () => {
  const usadasNoCss = animacoesUsadasNoCss(css);

  it('as varreduras funcionam (senao o resto passaria vazio)', () => {
    expect(usadasNoCss.length).toBeGreaterThan(10);
    expect(mapa.size).toBeGreaterThan(10);
    expect(usados.size).toBeGreaterThan(5);
  });

  it.each(animacoesUsadasNoCss(css))('%s chega ao navegador', (nome) => {
    const temNoCss = keyframesNoCss.has(nome);
    const viaTailwind = emitidosPeloTailwind.has(nome);
    expect(
      temNoCss || viaTailwind,
      `\`animation: ${nome}\` nao tem keyframe que chegue ao CSS final.\n` +
        'Declarar no tailwind.config.js NAO basta quando quem usa e CSS puro: ' +
        'sem uma classe animate-* correspondente na marcacao, o Tailwind remove ' +
        `o keyframe e a animacao morre em silencio. Declare @keyframes ${nome} em src/styles/index.css.`,
    ).toBe(true);
  });

  /* As nove que estavam mortas ficam nomeadas: elas sao usadas SO por CSS
     puro, entao precisam estar no index.css - Tailwind nunca as emitiria. */
  it('as nove animacoes que estavam quebradas estao no index.css', () => {
    for (const nome of [
      'shimmer',
      'xpLiquidShimmer',
      'pulseEmeraldDot',
      'starTwinkleFast',
      'starTwinkleSlow',
      'mascotBreatheAG',
      'fadeDown',
      'flashGlow',
      'cyberBorderGlowEffect',
    ]) {
      expect(keyframesNoCss.has(nome), `${nome} precisa de @keyframes no index.css`).toBe(true);
    }
  });

  it('o skeleton de carregamento anima, em vez de ser um bloco parado', () => {
    // Era o sintoma relatado: tela de espera sem movimento nenhum.
    expect(css).toMatch(/\.skeleton\s*\{[^}]*animation:\s*shimmer/);
    expect(keyframesNoCss.has('shimmer')).toBe(true);
  });

  /* ============================================================
   * INDICADOR DE CARREGAMENTO x MOVIMENTO REDUZIDO
   * ------------------------------------------------------------
   * A regra geral de `prefers-reduced-motion` zera animacao em TUDO
   * (`animation-duration: 0.01ms`, `iteration-count: 1`). Isso e certo
   * para enfeite e ERRADO para indicador de espera: o spinner de
   * "Gerando questoes..." congelava, e spinner parado nao comunica
   * "respeitei sua preferencia" - comunica "travou".
   *
   * A preferencia continua respeitada: o que muda e o TIPO de
   * movimento. Sai rotacao, entra pulsacao de opacidade, que nao
   * desloca nada e por isso nao dispara desconforto vestibular.
   * ============================================================ */
  it('o spinner continua animando com movimento reduzido', () => {
    const blocos = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)]
      .map((m) => m[1])
      .join('\n');
    expect(blocos).toMatch(/\.animate-spin/);
    expect(blocos).toMatch(/pulsarCarregando/);
  });

  it('o skeleton tambem continua animando com movimento reduzido', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.skeleton[\s\S]*?pulsarCarregando/);
  });

  it('a chave de acessibilidade do app poupa os indicadores de carregamento', () => {
    // A classe .a11y-sem-movimento tambem zerava tudo com !important.
    expect(css).toMatch(/html\.a11y-sem-movimento\s+\.animate-spin[\s\S]*?pulsarCarregando/);
  });

  it('a pulsacao de carregamento nao desloca nada (so opacidade)', () => {
    // Se alguem trocar por transform/translate, volta o risco vestibular
    // que a preferencia existe para evitar.
    const kf = css.match(/@keyframes pulsarCarregando \{([\s\S]*?)\n\}/);
    expect(kf, 'keyframes pulsarCarregando nao encontrado').toBeTruthy();
    expect(kf![1]).toMatch(/opacity/);
    expect(kf![1]).not.toMatch(/transform|translate|rotate|scale/);
  });

  it('o movimento continua desligavel por acessibilidade', () => {
    // O respeito a quem pediu menos movimento nao pode ter sido perdido
    // no meio do conserto.
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/a11y-sem-movimento/);
  });
});
