import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Direção de arte "caderno sob a luminária" (2026-10), travada em teste.
 *
 * A primeira versão do app era o visual genérico de produto feito por IA:
 * vidro fosco em 200 cartões, 110 gradientes, brilho neon em volta de
 * botão, orbes e partículas animando sem parar, roxo e ciano por todo
 * lado. Foi tirado classe por classe. Sem uma guarda, cada componente
 * novo copiado de um exemplo da internet traz tudo de volta; este teste
 * aponta o arquivo e a classe.
 *
 * O que NÃO é proibido: sombra em camada que flutua (`camada`,
 * `shadow-camada`), gradiente como máscara de rolagem, e animação que
 * comunica (carregamento, erro, entrada de modal, respiração guiada).
 */

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return nome === '__tests__' ? [] : arquivos(p);
    return /\.tsx$/.test(p) && !nome.startsWith('prova') ? [p] : [];
  });
}

const FONTES = arquivos('src').map((p) => ({ p, texto: readFileSync(p, 'utf8') }));
const CSS = readFileSync('src/styles/index.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const TW = readFileSync('tailwind.config.js', 'utf8');

function ocorrencias(re: RegExp): string[] {
  const achados: string[] = [];
  for (const { p, texto } of FONTES) {
    texto.split('\n').forEach((linha, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return; // comentário explica o que saiu
      const m = linha.match(re);
      if (m) achados.push(`${p}:${i + 1}  ${m[0]}`);
    });
  }
  return achados;
}

describe('direção de arte', () => {
  it('a varredura enxerga os componentes (senão o resto passaria vazio)', () => {
    expect(FONTES.length).toBeGreaterThan(60);
  });

  it('sem vidro fosco: nenhum backdrop-blur nem backdrop-filter', () => {
    expect(ocorrencias(/\bbackdrop-(blur|saturate)[\w-[\]]*|backdropFilter/)).toEqual([]);
    expect(CSS).not.toMatch(/backdrop-filter\s*:/);
  });

  it('sem as classes do vidro antigo (glass, glass-card, glass-light)', () => {
    expect(ocorrencias(/(?<![\w-])glass(-card|-light|-hover)?(?![\w-])(?=[^'"`]*['"`])/)).toEqual([]);
  });

  it('sem brilho neon: nenhuma sombra de halo nem drop-shadow colorido', () => {
    expect(ocorrencias(/shadow-\[0_0_[^\]]+\]|drop-shadow-\[[^\]]+\]|shadow-glow[\w-]*/)).toEqual([]);
  });

  it('sem gradiente decorativo em componente', () => {
    expect(ocorrencias(/\bbg-gradient-to-[a-z]+\b/)).toEqual([]);
  });

  it('sem roxo, violeta, índigo, fúcsia, ciano ou azul-céu: a cor secundária é a tinta', () => {
    expect(ocorrencias(/\b(?:text|bg|border|from|to|via|ring|fill|stroke)-(?:purple|violet|indigo|fuchsia|cyan|sky|teal)-\d{2,3}/)).toEqual([]);
  });

  it('sem animação decorativa em loop', () => {
    expect(
      ocorrencias(/\banimate-(?:ping|float(?:-suave)?|pulse-subtle|pulse-slow|moon-pulse|orb-\d|glow-cta|xp-shimmer|spin-orbit(?:-rev)?|particle-\d|mascot-breathe|hero-bulb|flame|aura-glow)\b/),
    ).toEqual([]);
  });

  it('o tailwind.config só declara loop infinito para carregamento e respiração guiada', () => {
    const bloco = TW.match(/animation:\s*\{([\s\S]*?)\n\s{6}\}/);
    expect(bloco, 'bloco animation do tailwind.config não encontrado').toBeTruthy();
    const infinitos = [...bloco![1].matchAll(/['"]?([\w-]+)['"]?:\s*'[^']*infinite/g)].map((m) => m[1]).sort();
    expect(infinitos).toEqual(['breathe', 'skeleton']);
  });

  it('texto secundário passa 4,5:1 sobre a mesa e sobre a folha (WCAG AA)', () => {
    const cor = (nome: string) => {
      const m = TW.match(new RegExp(`${nome}:\\s*'(#[0-9a-f]{6})'`, 'i'));
      expect(m, `cor ${nome} não encontrada`).toBeTruthy();
      return m![1];
    };
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const mesa = cor('mesa');
    const folha = TW.match(/folha:\s*\{\s*DEFAULT:\s*'(#[0-9a-f]{6})'/i)![1];
    // Os dois cinzas mais usados para texto secundário no app.
    const cinza500 = TW.match(/500:\s*'(#[0-9a-f]{6})',\s*\n\s*600:/i)![1];
    const cinza600 = TW.match(/600:\s*'(#[0-9a-f]{6})',\s*\n\s*700:\s*'#4d4840'/i)![1];
    for (const fundo of [mesa, folha]) {
      expect(contraste(cinza500, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cinza600, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('fonte servida pelo próprio app, sem Google Fonts', () => {
    const html = readFileSync('index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/@fontsource-variable\/literata/);
  });
});
