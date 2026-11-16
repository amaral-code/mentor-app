import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  aplicarAcessibilidade,
  lerAcessibilidade,
  salvarAcessibilidade,
} from '../acessibilidade';

// Vitest roda em node (sem DOM/storage): fakes mínimos de persistência e
// do <html> (classList toggle/contains + style) para validar a aplicação.
const memoria = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (memoria.has(k) ? memoria.get(k)! : null),
  setItem: (k: string, v: string) => { memoria.set(k, String(v)); },
  removeItem: (k: string) => { memoria.delete(k); },
  clear: () => { memoria.clear(); },
});

const classes = new Set<string>();
const estilo: Record<string, string> = {};
vi.stubGlobal('document', {
  documentElement: {
    classList: {
      toggle: (c: string, force?: boolean) => {
        if (force) classes.add(c);
        else classes.delete(c);
      },
      contains: (c: string) => classes.has(c),
    },
    style: estilo,
  },
});

beforeEach(() => {
  memoria.clear();
  classes.clear();
  estilo.fontSize = '';
  estilo.filter = '';
});

describe('acessibilidade', () => {
  it('padrão é tudo desligado', () => {
    expect(lerAcessibilidade()).toEqual({
      tamanhoFonte: 'normal',
      altoContraste: false,
      reduzirMovimento: false,
      daltonismo: 'normal',
    });
  });

  it('aplica fonte grande, contraste, sem-movimento e daltonismo no <html>', () => {
    aplicarAcessibilidade({
      tamanhoFonte: 'extra',
      altoContraste: true,
      reduzirMovimento: true,
      daltonismo: 'deuteranopia',
    });
    const html = document.documentElement;
    expect(html.style.fontSize).toBe('125%');
    expect(html.classList.contains('a11y-contraste')).toBe(true);
    expect(html.classList.contains('a11y-sem-movimento')).toBe(true);
    expect(html.style.filter).toBe('url(#cb-deuteranopia)');
  });

  it('salvar persiste e reaplica; normal limpa tudo', () => {
    salvarAcessibilidade({
      tamanhoFonte: 'grande',
      altoContraste: true,
      reduzirMovimento: false,
      daltonismo: 'normal',
    });
    expect(lerAcessibilidade().tamanhoFonte).toBe('grande');
    expect(document.documentElement.style.fontSize).toBe('112.5%');

    salvarAcessibilidade({
      tamanhoFonte: 'normal',
      altoContraste: false,
      reduzirMovimento: false,
      daltonismo: 'normal',
    });
    expect(document.documentElement.style.fontSize).toBe('');
    expect(document.documentElement.classList.contains('a11y-contraste')).toBe(false);
    expect(document.documentElement.style.filter).toBe('');
  });

  it('ignora JSON inválido ou fora do contrato', () => {
    localStorage.setItem('mm_acessibilidade', '{"tamanhoFonte":"gigante"}');
    expect(lerAcessibilidade().tamanhoFonte).toBe('normal');
    localStorage.setItem('mm_acessibilidade', 'nao-json{{{');
    expect(lerAcessibilidade().altoContraste).toBe(false);
  });

  it('migra o filtro antigo de daltonismo sem perder', () => {
    localStorage.setItem('mm_color_blindness', 'protanopia');
    expect(lerAcessibilidade().daltonismo).toBe('protanopia');
  });
});
