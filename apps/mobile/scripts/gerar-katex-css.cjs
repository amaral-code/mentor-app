// Regera src/features/mentor/katexCss.ts a partir do pacote katex instalado.
const fs = require('fs');
const path = require('path');
const v = require('katex').version;
const css = fs
  .readFileSync(require.resolve('katex/dist/katex.min.css'), 'utf8')
  .replace(/url\(fonts\//g, `url(https://cdn.jsdelivr.net/npm/katex@${v}/dist/fonts/`);
const destino = path.join(__dirname, '..', 'src/features/mentor/katexCss.ts');
const atual = fs.readFileSync(destino, 'utf8');
const cabecalho = atual.slice(0, atual.indexOf('export const CSS_KATEX'));
fs.writeFileSync(destino, `${cabecalho.replace(/KaTeX [\d.]+/, `KaTeX ${v}`)}export const CSS_KATEX = ${JSON.stringify(css)};\n`);
console.log('katexCss.ts atualizado para', v);
