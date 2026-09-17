import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contrato entre o front e as funcoes publicadas.
 *
 * ------------------------------------------------------------------
 * O BUG QUE ESTE ARQUIVO EXISTE PARA IMPEDIR
 * ------------------------------------------------------------------
 * A primeira versao servia todo o back-end por uma rota coringa
 * (`api/[...rota].js`), apostando que ela capturaria qualquer caminho
 * sob /api/. Em producao capturou so UM segmento:
 *
 *   /api/health            (1 segmento)  -> respondia
 *   /api/chat/completions  (2 segmentos) -> 404 da Vercel
 *
 * O Mentor parou de responder em producao, junto com a redacao por foto
 * e a importacao de turmas. Nenhum teste pegou, porque em dev o
 * middleware do Vite atende /api/* por conta propria e nunca passa pelo
 * roteamento da Vercel - dev ficava verde com producao quebrada.
 *
 * Este teste fecha essa lacuna sem precisar publicar: ele le as rotas
 * que o codigo do front realmente chama e exige um arquivo de funcao no
 * caminho exato de cada uma.
 */

/** Varre src/ e coleta cada rota passada para urlBackendIA(). */
function rotasChamadasPeloFront() {
  const arquivos = (function varrer(dir) {
    return readdirSync(dir).flatMap((nome) => {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) return varrer(p);
      return /\.(ts|tsx)$/.test(p) && !p.includes('__tests__') ? [p] : [];
    });
  })('src');

  const rotas = new Set();
  for (const arquivo of arquivos) {
    const texto = readFileSync(arquivo, 'utf8');
    for (const m of texto.matchAll(/urlBackendIA\(\s*'([^']+)'\s*\)/g)) rotas.add(m[1]);
  }
  return [...rotas].sort();
}

/** Mesma conversao de `urlBackendIA`: rota do worker -> caminho publicado. */
const caminhoPublicado = (rota) => (rota.startsWith('/api/') ? rota : `/api${rota}`);

describe('rotas do back-end publicadas na Vercel', () => {
  const rotas = rotasChamadasPeloFront();

  it('o front realmente chama alguma rota (a varredura funciona)', () => {
    // Sem isto, um regex quebrado faria o teste abaixo passar vazio.
    expect(rotas.length).toBeGreaterThanOrEqual(5);
  });

  it.each(rotasChamadasPeloFront())('%s tem arquivo de funcao', (rota) => {
    const publicado = caminhoPublicado(rota);
    const arquivo = `.${publicado}.js`;
    expect(existsSync(arquivo), `esperado ${arquivo} para a rota ${publicado}`).toBe(true);
  });

  it('as rotas de dois segmentos existem como arquivo aninhado', () => {
    // Eram exatamente estas as que caiam no 404 da Vercel.
    for (const p of [
      'api/chat/completions.js',
      'api/essays/upload-and-grade.js',
      'api/turmas/import.js',
    ]) {
      expect(existsSync(p), `${p} nao existe`).toBe(true);
    }
  });

  it('nao volta a existir rota coringa (foi a causa do 404)', () => {
    const coringa = readdirSync('api').filter((n) => n.includes('['));
    expect(coringa, 'rota coringa captura so um segmento na Vercel').toEqual([]);
  });

  it('/api/config e servido por arquivo proprio', () => {
    expect(existsSync('api/config.js')).toBe(true);
  });
});
