import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guarda contra a perda silenciosa do glassmorphism no build.
 *
 * O que aconteceu: no fonte, `.glass` declarava a propriedade padrao
 * ANTES da prefixada:
 *
 *     backdrop-filter: blur(24px) saturate(1.2);
 *     -webkit-backdrop-filter: blur(24px) saturate(1.2);
 *
 * Nessa ordem o minificador do build consolidava as duas e publicava
 * apenas a `-webkit-`. O Chrome ignora a versao prefixada quando a padrao
 * nao esta presente, entao o desfoque simplesmente nao acontecia no site
 * publicado. Medido com listras de alto contraste atras do painel, pelo
 * desvio padrao da luminancia dentro dele (menor = mais borrado):
 *
 *     so -webkit-  : 19.2   (igual a nao ter filtro nenhum)
 *     so padrao    :  0.3   (borrado)
 *     sem os dois  : 19.2
 *
 * O perverso e que `npm run dev` nao minifica: o efeito aparecia
 * normalmente durante todo o desenvolvimento e sumia so em producao.
 *
 * Desde a direção de arte de 2026-10 o app não usa mais vidro fosco (ver
 * direcaoDeArte.test.ts). Estas duas guardas ficam porque a armadilha
 * continua valendo para qualquer `backdrop-filter` que alguém traga de
 * volta por um bom motivo, como uma folha sobre vídeo.
 *
 * Estes testes olham o FONTE, para poderem rodar sem depender de um build
 * previo. A regra e simples: onde houver a versao prefixada e a padrao no
 * mesmo bloco, a padrao vem por ultimo.
 */

const CSS = readFileSync(resolve(__dirname, '../../../styles/index.css'), 'utf-8');

/** Blocos `seletor { ... }` do arquivo, sem tentar entender aninhamento. */
function blocos(css: string): { corpo: string; inicio: number }[] {
  const achados: { corpo: string; inicio: number }[] = [];
  const re = /\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) achados.push({ corpo: m[1], inicio: m.index });
  return achados;
}

describe('backdrop-filter sobrevive a minificacao', () => {
  it('declara a propriedade padrao depois da prefixada em todo bloco que usa as duas', () => {
    const errados: string[] = [];

    for (const { corpo, inicio } of blocos(CSS)) {
      // Ignora comentarios: eles citam os nomes das propriedades.
      const limpo = corpo.replace(/\/\*[\s\S]*?\*\//g, '');
      const iPrefixada = limpo.indexOf('-webkit-backdrop-filter');
      const iPadrao = limpo.search(/(^|[\s;])backdrop-filter/);
      if (iPrefixada === -1 || iPadrao === -1) continue;

      if (iPadrao < iPrefixada) {
        const linha = CSS.slice(0, inicio).split('\n').length;
        errados.push(`linha ~${linha}`);
      }
    }

    expect(
      errados,
      `Blocos com backdrop-filter antes de -webkit-backdrop-filter: ${errados.join(', ')}. ` +
        'Nessa ordem o minificador descarta a propriedade padrao e o Chrome perde o desfoque em producao.',
    ).toEqual([]);
  });

  it('nao deixa nenhum bloco so com a versao prefixada', () => {
    const soPrefixada: string[] = [];

    for (const { corpo, inicio } of blocos(CSS)) {
      const limpo = corpo.replace(/\/\*[\s\S]*?\*\//g, '');
      if (!limpo.includes('-webkit-backdrop-filter')) continue;
      if (limpo.search(/(^|[\s;])backdrop-filter/) === -1) {
        soPrefixada.push(`linha ~${CSS.slice(0, inicio).split('\n').length}`);
      }
    }

    expect(
      soPrefixada,
      `Blocos apenas com -webkit-backdrop-filter: ${soPrefixada.join(', ')}. ` +
        'O Chrome nao aplica a versao prefixada sozinha.',
    ).toEqual([]);
  });
});
