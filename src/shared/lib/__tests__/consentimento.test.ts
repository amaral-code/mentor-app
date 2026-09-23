import { describe, expect, it } from 'vitest';
import {
  DIAS_MAXIMOS,
  diasRestantes,
  diasValidos,
  escopoValido,
  mensagemErroConsentimento,
  quemAutoriza,
  rotuloEscopo,
} from '../consentimento';

const hoje = new Date(2026, 8, 23);

describe('quemAutoriza', () => {
  it('16 anos completos autoriza sozinho', () => {
    expect(quemAutoriza('2010-09-23', hoje)).toBe('aluno');
  });

  it('um dia antes dos 16 depende do responsavel', () => {
    expect(quemAutoriza('2010-09-24', hoje)).toBe('responsavel');
  });

  /* Mesmo criterio do banco: sem data, conta como menor. */
  it('sem data de nascimento, o responsavel autoriza', () => {
    expect(quemAutoriza(null, hoje)).toBe('responsavel');
  });
});

describe('diasValidos', () => {
  it('nunca passa do teto do banco', () => {
    expect(diasValidos(5000)).toBe(DIAS_MAXIMOS);
  });

  it('nunca fica abaixo de 1 dia', () => {
    expect(diasValidos(0)).toBe(1);
    expect(diasValidos(-10)).toBe(1);
  });

  it('valor nao numerico cai no padrao', () => {
    expect(diasValidos(Number.NaN)).toBe(90);
  });
});

describe('escopoValido', () => {
  it('aceita os escopos que o banco conhece', () => {
    expect(escopoValido(['bem_estar'])).toBe(true);
    expect(escopoValido(['bem_estar', 'estudo'])).toBe(true);
  });

  it('recusa vazio: seria consentimento para nada', () => {
    expect(escopoValido([])).toBe(false);
  });

  /* Conversas nunca sao escopo. Nem existe essa opcao no banco. */
  it('recusa escopo que nenhuma funcao sabe honrar', () => {
    expect(escopoValido(['conversas'])).toBe(false);
  });
});

describe('diasRestantes', () => {
  it('conta dias inteiros ate o fim', () => {
    expect(diasRestantes('2026-10-03T12:00:00Z', new Date('2026-09-23T12:00:00Z'))).toBe(10);
  });

  it('vencido vira zero, nunca negativo', () => {
    expect(diasRestantes('2026-01-01T00:00:00Z', new Date('2026-09-23T00:00:00Z'))).toBe(0);
  });
});

describe('rotuloEscopo', () => {
  it('junta com "e", sem travessao', () => {
    expect(rotuloEscopo(['bem_estar', 'estudo'])).toBe('índice de cansaço e ritmo de estudo');
  });
});

describe('mensagemErroConsentimento', () => {
  it('explica ao menor quem autoriza', () => {
    expect(mensagemErroConsentimento(new Error('menor_de_16: so o responsavel pode autorizar'))).toMatch(/responsável/);
  });

  it('nenhuma mensagem usa travessao', () => {
    for (const cod of ['menor_de_16', 'maior_de_16', 'profissional nao encontrado', 'nao autenticado', 'x']) {
      expect(mensagemErroConsentimento(new Error(cod))).not.toMatch(/[—–]/);
    }
  });
});
