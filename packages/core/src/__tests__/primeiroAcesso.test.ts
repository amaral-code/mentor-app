import { beforeEach, describe, expect, it } from 'vitest';
import { configurarPlataforma, criarArmazenamentoEmMemoria, _resetarPlataforma } from '../plataforma';
import { carregarRascunho, diasAteAProva, erroDataProva, podeAvancar, RASCUNHO_VAZIO, salvarRascunho } from '../primeiroAcesso';

const HOJE = new Date(2026, 10, 16, 15);

beforeEach(() => {
  _resetarPlataforma();
  const mem = criarArmazenamentoEmMemoria();
  configurarPlataforma({ armazenamento: () => mem });
});

describe('primeiro acesso', () => {
  it('cada passo pede o que precisa; objetivo e nascimento são opcionais', () => {
    expect(podeAvancar({ ...RASCUNHO_VAZIO, passo: 1 }, HOJE)).toBe(false);
    expect(podeAvancar({ ...RASCUNHO_VAZIO, passo: 1, metas: ['Passar no ENEM'] }, HOJE)).toBe(true);
    expect(podeAvancar({ ...RASCUNHO_VAZIO, passo: 2 }, HOJE)).toBe(true);
    expect(podeAvancar({ ...RASCUNHO_VAZIO, passo: 3, tempo: '1 hora' }, HOJE)).toBe(false);
    expect(podeAvancar({ ...RASCUNHO_VAZIO, passo: 4, nascimento: '31/02/2008' }, HOJE)).toBe(false);
  });

  it('data da prova: formato, data inexistente, passado e ano longe', () => {
    expect(erroDataProva('08/11/2027', HOJE)).toBe('');
    expect(erroDataProva('2027-11-08', HOJE)).toMatch(/dia, mês e ano/);
    expect(erroDataProva('31/02/2027', HOJE)).toBe('Essa data não existe.');
    expect(erroDataProva('01/01/2026', HOJE)).toBe('A data já passou.');
    expect(erroDataProva('08/11/2077', HOJE)).toMatch(/longe/);
  });

  it('rascunho sobrevive a fechar o app', () => {
    salvarRascunho('u1', { ...RASCUNHO_VAZIO, passo: 3, metas: ['Passar no ENEM'], curso: 'Direito' });
    expect(carregarRascunho('u1')).toMatchObject({ passo: 3, curso: 'Direito' });
    expect(carregarRascunho('outro')).toEqual(RASCUNHO_VAZIO);
  });

  it('dias até a prova no calendário do aparelho', () => {
    expect(diasAteAProva('2026-11-16', HOJE)).toBe(0);
    expect(diasAteAProva('2026-11-26', HOJE)).toBe(10);
    expect(diasAteAProva(null, HOJE)).toBeNull();
  });
});
