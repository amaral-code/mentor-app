#!/usr/bin/env node
/**
 * Orçamento do que o navegador baixa para ABRIR o app (issue #67).
 *
 * Lê `apps/web/dist/index.html` e soma, comprimido em gzip, o que ele
 * carrega antes da primeira tela: o script de entrada, os
 * `modulepreload` e o CSS. Telas pesadas (Mermaid, gráficos, KaTeX)
 * entram por `import()` e ficam de fora de propósito: só baixam quando o
 * aluno abre a aba. Se alguém importar uma delas no topo de um arquivo
 * da abertura, este script falha no CI.
 *
 * Os tetos têm folga de uns 15% sobre o tamanho de 2026-11-16. Subir um
 * teto é decisão consciente: escreva no PR o que entrou e por quê.
 *
 * Uso: npm run build && node scripts/orcamento-bundle.mjs [--json]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'apps/web/dist');

export const TETOS_KB = {
  js: 270, // JavaScript da abertura, gzip (235 KB em 2026-11-16)
  css: 27, // CSS, gzip (23 KB)
  imagemPublica: 80, // cada imagem de /assets (WebP)
};

function tamanhos(arquivo) {
  const bruto = readFileSync(join(DIST, arquivo));
  return { arquivo, bytes: bruto.length, gzip: gzipSync(bruto, { level: 9 }).length };
}

export function arquivosDaAbertura(html) {
  const js = new Set();
  const css = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc="\/([^"]+\.js)"/g)) js.add(m[1]);
  for (const m of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="\/([^"]+\.js)"/g)) js.add(m[1]);
  for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\/([^"]+\.css)"/g)) css.add(m[1]);
  return { js: [...js], css: [...css] };
}

async function principal() {
  const indice = join(DIST, 'index.html');
  if (!existsSync(indice)) {
    console.error('Sem build. Rode `npm run build` antes.');
    process.exit(2);
  }
  const { js, css } = arquivosDaAbertura(readFileSync(indice, 'utf8'));
  const linhasJs = js.map(tamanhos);
  const linhasCss = css.map(tamanhos);
  const kb = (n) => Math.round(n / 102.4) / 10;
  const somaJs = linhasJs.reduce((n, l) => n + l.gzip, 0);
  const somaCss = linhasCss.reduce((n, l) => n + l.gzip, 0);

  const imagens = [];
  const pastaAssets = join(RAIZ, 'apps/web/public/assets');
  if (existsSync(pastaAssets)) {
    for (const nome of readdirSync(pastaAssets)) {
      const bytes = readFileSync(join(pastaAssets, nome)).length;
      imagens.push({ arquivo: `assets/${nome}`, bytes });
    }
  }

  const falhas = [];
  if (kb(somaJs) > TETOS_KB.js) falhas.push(`JavaScript da abertura: ${kb(somaJs)} KB (teto ${TETOS_KB.js} KB)`);
  if (kb(somaCss) > TETOS_KB.css) falhas.push(`CSS: ${kb(somaCss)} KB (teto ${TETOS_KB.css} KB)`);
  for (const i of imagens) {
    if (kb(i.bytes) > TETOS_KB.imagemPublica) falhas.push(`${i.arquivo}: ${kb(i.bytes)} KB (teto ${TETOS_KB.imagemPublica} KB por imagem)`);
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ js: linhasJs, css: linhasCss, imagens, somaJs, somaCss, falhas }, null, 2));
  } else {
    console.log('Abertura do app (gzip):');
    for (const l of [...linhasJs, ...linhasCss].sort((a, b) => b.gzip - a.gzip)) {
      console.log(`  ${String(kb(l.gzip)).padStart(7)} KB  ${l.arquivo}`);
    }
    console.log(`  JS ${kb(somaJs)} KB de ${TETOS_KB.js} · CSS ${kb(somaCss)} KB de ${TETOS_KB.css}`);
  }
  if (falhas.length) {
    console.error('\nPassou do orçamento:\n  ' + falhas.join('\n  '));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
