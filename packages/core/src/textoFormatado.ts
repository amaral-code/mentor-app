/**
 * Marcação leve das respostas da IA, analisada sem tela.
 *
 * O web transforma `**negrito**`, `*itálico*` e `` `código` `` em nós
 * React (TextoFormatado.tsx), nunca em HTML: resposta de IA em
 * `innerHTML` é caminho de XSS. O app nativo segue a mesma regra, e por
 * isso a análise mora aqui: devolve blocos e trechos tipados que cada
 * plataforma desenha com os próprios componentes.
 *
 * O celular ganhou, além do web, listas, títulos e fórmulas (`$...$` e
 * `$$...$$`), que o modelo usa em matemática e física e que, sem
 * tratamento, chegavam ao aluno como `\frac{y_2 - y_1}{x_2 - x_1}`.
 */

export type Trecho =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito'; texto: string }
  | { tipo: 'italico'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'formula'; tex: string };

export type Bloco =
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'titulo'; trechos: Trecho[] }
  | { tipo: 'item'; trechos: Trecho[]; marcador: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'formula'; tex: string };

/* Ordem importa: `**` antes de `*`, e fórmula antes de tudo (um `*`
   dentro de `$a*b$` não é itálico). */
const INLINE = /(\$[^$\n]+\$|\\\([^\n]+?\\\)|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`)/g;

export function analisarTrechos(linha: string): Trecho[] {
  const trechos: Trecho[] = [];
  for (const parte of linha.split(INLINE)) {
    if (!parte) continue;
    if (parte.length > 2 && parte.startsWith('$') && parte.endsWith('$')) trechos.push({ tipo: 'formula', tex: parte.slice(1, -1).trim() });
    else if (parte.startsWith('\\(') && parte.endsWith('\\)')) trechos.push({ tipo: 'formula', tex: parte.slice(2, -2).trim() });
    else if (parte.length > 4 && parte.startsWith('**') && parte.endsWith('**')) trechos.push({ tipo: 'negrito', texto: parte.slice(2, -2) });
    else if (parte.length > 2 && parte.startsWith('*') && parte.endsWith('*')) trechos.push({ tipo: 'italico', texto: parte.slice(1, -1) });
    else if (parte.length > 2 && parte.startsWith('`') && parte.endsWith('`')) trechos.push({ tipo: 'codigo', texto: parte.slice(1, -1) });
    else trechos.push({ tipo: 'texto', texto: parte });
  }
  return trechos;
}

/**
 * Texto da IA em blocos. Tolerante de propósito: durante o streaming o
 * texto chega cortado (um `$$` aberto sem o fechamento, um `**` pela
 * metade) e nada pode quebrar; o que não fecha fica como texto comum
 * até o próximo pedaço chegar.
 */
export function analisarMarkdown(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  const linhas = String(texto ?? '').replace(/\r\n/g, '\n').split('\n');
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return;
    blocos.push({ tipo: 'paragrafo', trechos: analisarTrechos(paragrafo.join('\n')) });
    paragrafo = [];
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const aparada = linha.trim();

    // Bloco de código ```
    if (aparada.startsWith('```')) {
      const fim = linhas.findIndex((l, j) => j > i && l.trim().startsWith('```'));
      if (fim > i) {
        fecharParagrafo();
        blocos.push({ tipo: 'codigo', texto: linhas.slice(i + 1, fim).join('\n') });
        i = fim;
        continue;
      }
    }

    // Fórmula em bloco: $$...$$ ou \[...\], na mesma linha ou em várias.
    const abre = aparada.startsWith('$$') ? '$$' : aparada.startsWith('\\[') ? '\\[' : null;
    if (abre) {
      const fecha = abre === '$$' ? '$$' : '\\]';
      const resto = aparada.slice(2);
      if (resto.trimEnd().endsWith(fecha) && resto.trim().length > fecha.length) {
        fecharParagrafo();
        blocos.push({ tipo: 'formula', tex: resto.trimEnd().slice(0, -fecha.length).trim() });
        continue;
      }
      const fim = linhas.findIndex((l, j) => j > i && l.trim().endsWith(fecha));
      if (fim > i) {
        fecharParagrafo();
        const corpo = [resto, ...linhas.slice(i + 1, fim), linhas[fim].trim().slice(0, -fecha.length)];
        blocos.push({ tipo: 'formula', tex: corpo.join('\n').trim() });
        i = fim;
        continue;
      }
    }

    if (!aparada) {
      fecharParagrafo();
      continue;
    }

    const titulo = /^#{1,4}\s+(.*)$/.exec(aparada);
    if (titulo) {
      fecharParagrafo();
      blocos.push({ tipo: 'titulo', trechos: analisarTrechos(titulo[1]) });
      continue;
    }

    const item = /^([-*•]|\d{1,2}[.)])\s+(.*)$/.exec(aparada);
    if (item) {
      fecharParagrafo();
      const marcador = /^\d/.test(item[1]) ? item[1].replace(')', '.') : '•';
      blocos.push({ tipo: 'item', marcador, trechos: analisarTrechos(item[2]) });
      continue;
    }

    paragrafo.push(linha);
  }
  fecharParagrafo();
  return blocos;
}

/* ------------------------------------------------------------------ */

const SIMBOLOS: Record<string, string> = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
  approx: '≈', equiv: '≡', infty: '∞', degree: '°', circ: '°', to: '→', rightarrow: '→', Rightarrow: '⇒',
  leftarrow: '←', Leftrightarrow: '⇔', implies: '⇒', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', sum: 'Σ', prod: 'Π', int: '∫', partial: '∂', nabla: '∇', angle: '∠', perp: '⊥',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω',
  Pi: 'Π', Gamma: 'Γ', Theta: 'Θ', Lambda: 'Λ', Phi: 'Φ', ldots: '…', cdots: '⋯', dots: '…', quad: ' ', qquad: '  ',
};

/* Relações e operações ganham espaço dos dois lados: `a\geq 0` vira
   `a ≥ 0`, e não `a≥0`, que no celular parece uma palavra só. */
const OPERADORES = new Set([
  'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'le', 'geq', 'ge', 'neq', 'ne', 'approx', 'equiv',
  'to', 'rightarrow', 'Rightarrow', 'leftarrow', 'Leftrightarrow', 'implies', 'in', 'notin', 'subset', 'cup', 'cap',
]);

/* Montados de duas strings paralelas, e não como `{ '-': '⁻' }`: a trava
   da regra de escrita lê string solta "-" como hífen de tela. */
function mapear(de: string, para: string): Record<string, string> {
  const a = [...de];
  const b = [...para];
  return Object.fromEntries(a.map((c, i) => [c, b[i]]));
}
const SOBRESCRITO = mapear('0123456789+-=()nix', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣ');
const SUBSCRITO = mapear('0123456789+-=()aeinx', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑᵢₙₓ');

/** Hífen do teclado vira o sinal de menos tipográfico (U+2212) na fórmula. */
const HIFEN = 45;

function converter(mapa: Record<string, string>, texto: string, marca: string): string {
  const tudo = [...texto].every((c) => c in mapa);
  if (tudo) return [...texto].map((c) => mapa[c]).join('');
  return `${marca}(${texto})`;
}

/** Conteúdo do grupo `{...}` que começa em `i` (que aponta para a `{`). */
function grupo(tex: string, i: number): { conteudo: string; fim: number } {
  if (tex[i] !== '{') return { conteudo: tex[i] ?? '', fim: i + 1 };
  let nivel = 0;
  for (let j = i; j < tex.length; j++) {
    if (tex[j] === '{') nivel++;
    else if (tex[j] === '}') {
      nivel--;
      if (nivel === 0) return { conteudo: tex.slice(i + 1, j), fim: j + 1 };
    }
  }
  return { conteudo: tex.slice(i + 1), fim: tex.length };
}

/** Coloca parênteses só quando a fração ficaria ambígua sem eles. */
function talvezParenteses(t: string): string {
  return /^[\w.,·²³¹⁰⁴⁵⁶⁷⁸⁹√π]+$/u.test(t) ? t : `(${t})`;
}

/**
 * TeX legível sem renderizador: `\frac{y_2 - y_1}{x_2 - x_1}` vira
 * `(y₂ − y₁)/(x₂ − x₁)`, `x^2` vira `x²`. É a "alternativa nativa" para
 * fórmula no meio da frase, onde uma WebView por fórmula não cabe. A
 * fórmula em bloco usa KaTeX; esta função também é o plano B dela.
 */
export function texParaTexto(tex: string): string {
  let saida = '';
  let i = 0;
  const s = String(tex ?? '');
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      const nome = m ? m[1] : '';
      i += 1 + nome.length;
      // Como no TeX: o espaço depois de um comando com nome (\Delta t) some.
      if (/^[A-Za-z]/.test(nome)) while (s[i] === ' ') i++;
      if (nome === 'frac' || nome === 'dfrac' || nome === 'tfrac') {
        while (s[i] === ' ') i++;
        const num = grupo(s, i);
        i = num.fim;
        while (s[i] === ' ') i++;
        const den = grupo(s, i);
        i = den.fim;
        saida += `${talvezParenteses(texParaTexto(num.conteudo))}/${talvezParenteses(texParaTexto(den.conteudo))}`;
      } else if (nome === 'sqrt') {
        const g = grupo(s, i);
        i = g.fim;
        saida += `√${talvezParenteses(texParaTexto(g.conteudo))}`;
      } else if (['text', 'mathrm', 'textbf', 'mathbf', 'operatorname', 'mbox'].includes(nome)) {
        const g = grupo(s, i);
        i = g.fim;
        saida += g.conteudo;
      } else if (nome === 'left' || nome === 'right' || nome === 'displaystyle') {
        /* só somem: o parêntese que vem depois fica */
      } else if (nome === ',' || nome === ';' || nome === ' ' || nome === ':') {
        saida += ' ';
      } else if (nome === '{' || nome === '}' || nome === '%' || nome === '$') {
        saida += nome;
      } else if (OPERADORES.has(nome)) {
        saida += ` ${SIMBOLOS[nome]} `;
      } else {
        saida += SIMBOLOS[nome] ?? nome;
      }
      continue;
    }
    if (c === '^' || c === '_') {
      const g = grupo(s, i + 1);
      i = g.fim;
      const interno = texParaTexto(g.conteudo);
      saida += c === '^' ? converter(SOBRESCRITO, interno, '^') : converter(SUBSCRITO, interno, '_');
      continue;
    }
    if (c === '{' || c === '}') {
      i++;
      continue;
    }
    saida += c.charCodeAt(0) === HIFEN ? '−' : c === '*' ? '·' : c;
    i++;
  }
  return saida
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}
