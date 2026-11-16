import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * A REGRA DO TRAVESSÃO, travada por teste.
 *
 * O dono do produto pediu: nem travessão, nem meia-risca, nem hífen
 * solto no texto que o usuário lê. Regra escrita em documento depende de
 * alguém lembrar; esta falha o build.
 *
 * POR QUE ÁRVORE SINTÁTICA, E NÃO REGEX
 * A primeira versão deste teste era uma regex, e deixou passar dois
 * tipos de caso: o hífen com espaços (" - ") e o texto JSX sozinho numa
 * linha. Regex não sabe a diferença entre `partes.length - 1` (código) e
 * `Excelente - nota dos sonhos` (tela). O compilador do TypeScript sabe:
 * o primeiro é uma expressão binária, o segundo é uma string. Então o
 * teste percorre a árvore e olha só o que vira texto:
 *
 *   - JsxText             o texto solto entre tags
 *   - StringLiteral       'texto' e "texto"
 *   - template literal    só a parte literal; o que está dentro de ${ }
 *                         é código e continua livre
 *
 * Comentário não é nó da árvore, então fica de fora sozinho: ele é para
 * quem mantém o repositório.
 */

const RAIZ = path.resolve(__dirname, '..', '..', '..');

/** Travessão e meia-risca: proibidos em qualquer texto. */
const TRACOS = /[—–]/;
/** Hífen solto: com espaço dos dois lados, ou sozinho no texto. */
const HIFEN_SOLTO = /(^|\s)-(\s|$)/;

/**
 * Exceções, todas sobre o CARACTERE e nenhuma sobre texto de tela.
 * Cada uma diz por que existe; acrescentar uma aqui exige o mesmo.
 */
const PERMITIDAS: { trecho: string; motivo: string }[] = [
  { trecho: 'PONTUAÇÃO (obrigatório)', motivo: 'a linha que ensina a regra à IA precisa citar o caractere' },
  { trecho: '[:\\-–]', motivo: 'classe de caractere do parser de gabarito: aceita o que a IA mandar' },
  { trecho: '(1 - taxa)', motivo: 'sinal de menos numa fórmula de desconto' },
  { trecho: 'calc(', motivo: 'subtração em CSS' },
];

/** Conta aritmética em conteúdo de questão ("22 - 7 = 15") é sinal de menos. */
const ARITMETICA = /\d\s-\s\d/;

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const c = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') arquivos(c, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      acc.push(c);
    }
  }
  return acc;
}

function textosDeTela(arquivo: string): { linha: number; texto: string }[] {
  const fonte = fs.readFileSync(arquivo, 'utf8');
  const sf = ts.createSourceFile(
    arquivo,
    fonte,
    ts.ScriptTarget.Latest,
    true,
    arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const achados: { linha: number; texto: string }[] = [];

  const registrar = (no: ts.Node, texto: string) => {
    achados.push({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, texto });
  };

  /*
   * Onde uma string é CÓDIGO e não tela:
   *   - argumento de chamada: `data.split('-')`, `nome.replace(' - ', x)`;
   *   - chave de acesso: `obj['a-b']`.
   * Já `valor || '-'` e `cond ? x : '-'` NÃO entram aqui: é o traço que
   * aparece no lugar de um valor vazio, e esse é texto de tela.
   */
  const ehCodigo = (no: ts.Node): boolean => {
    const pai = no.parent;
    if (!pai) return false;
    if (ts.isCallExpression(pai) && pai.arguments.includes(no as ts.Expression)) return true;
    if (ts.isElementAccessExpression(pai) && pai.argumentExpression === no) return true;
    return false;
  };

  const visitar = (no: ts.Node): void => {
    // Import, export e chave de objeto não são texto de tela.
    if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) return;

    if (ts.isJsxText(no)) {
      const t = no.getText(sf).replace(/\s+/g, ' ').trim();
      if (t) registrar(no, t);
    } else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      if (!ehCodigo(no)) registrar(no, no.text);
    } else if (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) {
      // Só a parte literal do template; o `${ a - b }` é outro nó, de
      // código. Um "-" COLADO entre duas expressões é chave ou data
      // (`${ano}-${mes}`), nunca prosa: só conta com espaço dos lados.
      if (/\s-\s|[—–]/.test(no.text)) registrar(no, no.text);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
  return achados;
}

describe('regra de escrita: sem travessão nem hífen solto no texto do usuário', () => {
  it('nenhum texto de src/ usa travessão, meia-risca ou hífen solto', () => {
    const infratores: string[] = [];

    for (const arquivo of arquivos(RAIZ)) {
      for (const { linha, texto } of textosDeTela(arquivo)) {
        if (!TRACOS.test(texto) && !HIFEN_SOLTO.test(texto)) continue;
        if (PERMITIDAS.some((p) => texto.includes(p.trecho))) continue;
        if (!TRACOS.test(texto) && ARITMETICA.test(texto)) continue;
        infratores.push(`${path.relative(RAIZ, arquivo)}:${linha}: ${texto.slice(0, 90)}`);
      }
    }

    expect(infratores).toEqual([]);
  });

  /* O detector precisa continuar distinguindo codigo de texto. Se um dia
     alguem trocar a arvore por regex de novo, estes casos quebram. */
  it('o detector separa código de texto', () => {
    const tmp = path.join(RAIZ, '..', 'node_modules', '.regra-pontuacao-amostra.tsx');
    fs.writeFileSync(
      tmp,
      [
        'const n = lista.length - 1;',
        'const t = `faltam ${150 - x} palavras`;',
        'const d = `${ano}-${mes}-${dia}`;',
        "const p = texto.split('-');",
        "const v = nome || '-';",
        "const a = 'Excelente - nota';",
        'const j = <p>',
        '  Nenhuma janela - por enquanto',
        '</p>;',
      ].join('\n'),
    );
    try {
      const textos = textosDeTela(tmp).map((t) => t.texto);
      const ruins = textos.filter((t) => HIFEN_SOLTO.test(t));
      // Data e split sao codigo; o `|| '-'` e o traco no lugar de valor
      // vazio, e esse aparece na tela.
      expect(ruins).toEqual(['-', 'Excelente - nota', 'Nenhuma janela - por enquanto']);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
