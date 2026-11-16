import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetarPlataforma,
  configurarPlataforma,
  criarArmazenamentoEmMemoria,
  plataforma,
} from '../plataforma';
import { safeGet, safeRemove, safeSet } from '../safeStorage';
import { aiModel, supabaseUrl } from '../runtimeConfig';

afterEach(() => _resetarPlataforma());

describe('plataforma', () => {
  it('sem instalação: sem armazenamento, sem env, online desconhecido', () => {
    const p = plataforma();
    expect(p.armazenamento()).toBeNull();
    expect(p.envBuild('VITE_QUALQUER')).toBe('');
    expect(p.online()).toBeNull();
    expect(p.dev()).toBe(false);
  });

  it('configurar completa sem apagar o que já estava instalado', () => {
    configurarPlataforma({ dev: () => true });
    configurarPlataforma({ online: () => false });
    expect(plataforma().dev()).toBe(true);
    expect(plataforma().online()).toBe(false);
  });

  it('sobrevive a vi.resetModules (fica em globalThis)', async () => {
    configurarPlataforma({ envBuild: () => 'valor' });
    vi.resetModules();
    const recarregado = await import('../plataforma');
    expect(recarregado.plataforma().envBuild('X')).toBe('valor');
  });
});

describe('safeStorage sobre a plataforma', () => {
  it('sem armazenamento devolve o fallback e não joga', () => {
    expect(safeGet('k', 'padrao')).toBe('padrao');
    expect(safeSet('k', 'v')).toBe(false);
    expect(() => safeRemove('k')).not.toThrow();
  });

  it('usa o armazenamento instalado', () => {
    // A mesma instância a cada chamada, como localStorage/MMKV.
    const mem = criarArmazenamentoEmMemoria();
    configurarPlataforma({ armazenamento: () => mem });
    expect(safeSet('k', 'v')).toBe(true);
    expect(safeGet('k')).toBe('v');
    safeRemove('k');
    expect(safeGet('k', 'sumiu')).toBe('sumiu');
  });

  it('armazenamento que joga (modo privado, cota cheia) não derruba quem chamou', () => {
    configurarPlataforma({
      armazenamento: () => ({
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {
          throw new Error('SecurityError');
        },
      }),
    });
    expect(safeGet('k', 'f')).toBe('f');
    expect(safeSet('k', 'v')).toBe(false);
    expect(() => safeRemove('k')).not.toThrow();
  });
});

describe('runtimeConfig lê o build pela plataforma', () => {
  it('env do build vale enquanto o servidor não respondeu', () => {
    configurarPlataforma({
      envBuild: (nome) => ({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_AI_MODEL: ' m1 ' })[nome] ?? '',
    });
    expect(supabaseUrl()).toBe('https://x.supabase.co');
    expect(aiModel()).toBe('m1');
  });
});
