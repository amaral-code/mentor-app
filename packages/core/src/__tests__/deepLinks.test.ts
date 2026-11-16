import { describe, expect, it } from 'vitest';
import { interpretarLink, montarLink } from '../deepLinks';

const ID = '0f8c1e2a-1234-4abc-9def-0123456789ab';

describe('deep links', () => {
  it('convite de liga abre a liga certa', () => {
    expect(interpretarLink(`https://mentor.app/liga/${ID}`)).toEqual({ tipo: 'liga', id: ID });
  });

  it('código de turma e de vínculo saem normalizados', () => {
    expect(interpretarLink('/turma/abc-123')).toEqual({ tipo: 'turma', codigo: 'ABC123' });
    expect(interpretarLink('/vinculo/a1b2c3d4')).toEqual({ tipo: 'vinculo', codigo: 'A1B2C3D4' });
  });

  it('abre só telas conhecidas', () => {
    expect(interpretarLink('/?aba=calendario')).toEqual({ tipo: 'aba', aba: 'calendario' });
    expect(interpretarLink('/?aba=admin')).toBeNull();
  });

  it('recusa o que não é link do app', () => {
    expect(interpretarLink('/liga/nao-e-uuid')).toBeNull();
    expect(interpretarLink('/turma/<script>')).toBeNull();
    expect(interpretarLink('/')).toBeNull();
    expect(interpretarLink(`https://outro.site/liga/${ID}`, 'https://mentor.app')).toBeNull();
  });

  it('ida e volta: o link montado é interpretado igual', () => {
    for (const d of [{ tipo: 'liga', id: ID }, { tipo: 'turma', codigo: 'ABC123' }, { tipo: 'aba', aba: 'quiz' }] as const) {
      expect(interpretarLink(montarLink('https://mentor.app/', d))).toEqual(d);
    }
  });
});
