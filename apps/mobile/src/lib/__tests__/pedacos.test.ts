import { describe, expect, it } from 'vitest';
import { emPedacos, type ArmazenamentoAssincrono } from '../pedacos';

function memoria(): ArmazenamentoAssincrono & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: async (k) => dados.get(k) ?? null,
    setItem: async (k, v) => void dados.set(k, v),
    removeItem: async (k) => void dados.delete(k),
  };
}

describe('emPedacos', () => {
  it('guarda e devolve um valor maior que o pedaço', async () => {
    const base = memoria();
    const cofre = emPedacos(base, 10);
    const valor = 'x'.repeat(25) + 'çã';
    await cofre.setItem('sb-auth', valor);
    expect(base.dados.get('sb-auth__n')).toBe('3');
    expect(await cofre.getItem('sb-auth')).toBe(valor);
  });

  it('regravar menor apaga os pedaços que sobraram', async () => {
    const base = memoria();
    const cofre = emPedacos(base, 10);
    await cofre.setItem('k', 'a'.repeat(35));
    await cofre.setItem('k', 'curto');
    expect(await cofre.getItem('k')).toBe('curto');
    expect([...base.dados.keys()].sort()).toEqual(['k__0', 'k__n']);
  });

  it('pedaço faltando vira "sem sessão", nunca JSON remendado', async () => {
    const base = memoria();
    const cofre = emPedacos(base, 10);
    await cofre.setItem('k', 'a'.repeat(25));
    base.dados.delete('k__1');
    expect(await cofre.getItem('k')).toBeNull();
  });

  it('remover limpa tudo', async () => {
    const base = memoria();
    const cofre = emPedacos(base, 10);
    await cofre.setItem('k', 'a'.repeat(25));
    await cofre.removeItem('k');
    expect(base.dados.size).toBe(0);
    expect(await cofre.getItem('k')).toBeNull();
  });
});
