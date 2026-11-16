import { afterEach, describe, expect, it } from 'vitest';
import { _resetarPlataforma, configurarPlataforma, criarArmazenamentoEmMemoria } from '@mentor/core/plataforma';
import { configurarSupabase, getSupabase, isSupabaseConfigured } from '../supabase';

const comCredenciais = () =>
  configurarPlataforma({
    envBuild: (nome) =>
      ({ VITE_SUPABASE_URL: 'https://teste.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-de-teste' })[nome] ?? '',
  });

afterEach(() => {
  _resetarPlataforma();
  configurarSupabase({});
});

describe('cliente Supabase', () => {
  it('sem credencial não cria cliente (e não guarda o null para sempre)', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabase()).toBeNull();

    comCredenciais();
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabase()).not.toBeNull();
  });

  it('reaproveita o mesmo cliente entre chamadas', () => {
    comCredenciais();
    expect(getSupabase()).toBe(getSupabase());
  });

  it('configurarSupabase descarta o cliente antigo para valerem as novas opções', () => {
    comCredenciais();
    const antes = getSupabase();
    const mem = criarArmazenamentoEmMemoria();
    configurarSupabase({ storage: mem, detectSessionInUrl: false });
    const depois = getSupabase();
    expect(depois).not.toBeNull();
    expect(depois).not.toBe(antes);
  });
});
