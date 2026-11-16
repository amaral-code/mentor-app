import { describe, expect, it } from 'vitest';
import { classificarErro } from '../SincronizacaoRepository';

describe('classificar erro da fila offline', () => {
  it('rede e sessão expirada: tenta de novo', () => {
    expect(classificarErro({ message: 'TypeError: Failed to fetch' }).status).toBe('rede');
    expect(classificarErro({ code: 'P0001', message: 'nao autenticado' }).status).toBe('rede');
  });
  it('recusa do banco: desiste', () => {
    expect(classificarErro({ code: 'P0001', message: 'operacao antiga demais' }).status).toBe('recusada');
    expect(classificarErro({ code: '23514', message: 'violates check constraint' }).status).toBe('recusada');
  });
  it('sem erro: aplicada', () => {
    expect(classificarErro(null).status).toBe('aplicada');
  });
});
