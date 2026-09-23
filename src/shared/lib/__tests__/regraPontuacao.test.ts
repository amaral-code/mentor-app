import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A REGRA DO TRAVESSÃO, travada por teste.
 *
 * O dono do produto pediu: travessão nenhum no texto que o usuário lê.
 * Regra escrita em documento depende de alguém lembrar; esta aqui falha
 * o build na hora, que é o que faz a regra valer daqui a seis meses.
 *
 * Comentário de código NÃO conta: ele é para quem mantém o repositório,
 * não para quem usa o app. Por isso o varredor tira comentário antes de
 * procurar.
 */

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const PROIBIDOS = /[—–]/;

/** Duas exceções, as duas sobre o caractere em si, não sobre texto. */
const PERMITIDAS = [
  // A linha que ENSINA a IA a não usar travessão precisa citá-lo.
  'PONTUAÇÃO (obrigatório)',
  // Classe de caractere do parser de gabarito: aceita o que a IA mandar.
  '[:\\-–]',
];

/** Remove bloco /* *​/ e linha // para sobrar só o que vira tela. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === '__tests__' || entrada.name === 'node_modules') continue;
      arquivosDeCodigo(completo, acc);
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      acc.push(completo);
    }
  }
  return acc;
}

describe('regra de escrita: sem travessão no texto do usuário', () => {
  it('nenhum arquivo de src/ usa travessão fora de comentário', () => {
    const infratores: string[] = [];

    for (const arquivo of arquivosDeCodigo(RAIZ)) {
      const linhas = semComentarios(fs.readFileSync(arquivo, 'utf8')).split('\n');
      linhas.forEach((linha, i) => {
        if (!PROIBIDOS.test(linha)) return;
        if (PERMITIDAS.some((p) => linha.includes(p))) return;
        infratores.push(`${path.relative(RAIZ, arquivo)}:${i + 1}: ${linha.trim().slice(0, 100)}`);
      });
    }

    expect(infratores).toEqual([]);
  });
});
