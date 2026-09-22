import { describe, expect, it } from 'vitest';
import {
  codigoValido,
  soHexadecimal,
  ehMenorDe16,
  formatarCodigo,
  idadeEm,
  normalizarCodigo,
  validarDataNascimento,
} from '../vinculoCodigo';

describe('normalizarCodigo', () => {
  it('sobe para maiuscula: o banco compara com upper()', () => {
    expect(normalizarCodigo('a1b2c3d4')).toBe('A1B2C3D4');
  });

  /* O aluno le o codigo em voz alta e o responsavel digita com espaco ou
     hifen. Sem esta limpeza isso virava "codigo invalido". */
  it('descarta separadores digitados por quem le o codigo em voz alta', () => {
    expect(normalizarCodigo('A1B2 C3D4')).toBe('A1B2C3D4');
    expect(normalizarCodigo('a1b2-c3d4')).toBe('A1B2C3D4');
    expect(normalizarCodigo('  A1B2C3D4  ')).toBe('A1B2C3D4');
  });

  /* Filtrar a letra invalida aqui fazia o caractere sumir da tela sem
     explicacao nenhuma. Ela fica; quem reprova e `soHexadecimal`. */
  it('mantem letra fora do hexadecimal em vez de apaga-la em silencio', () => {
    expect(normalizarCodigo('zz12ab34')).toBe('ZZ12AB34');
  });

  it('nao passa de 8 caracteres', () => {
    expect(normalizarCodigo('A1B2C3D4E5F6')).toHaveLength(8);
  });

  it('aguenta entrada vazia', () => {
    expect(normalizarCodigo('')).toBe('');
  });
});

describe('soHexadecimal', () => {
  it('reprova letra que um md5 nunca produz', () => {
    expect(soHexadecimal('ZZ12AB34')).toBe(false);
    expect(soHexadecimal('A1B2C3G4')).toBe(false);
  });

  it('aprova o codigo de verdade, com ou sem formatacao', () => {
    expect(soHexadecimal('A1B2C3D4')).toBe(true);
    expect(soHexadecimal('a1b2 c3d4')).toBe(true);
  });
});

describe('codigoValido', () => {
  it('exige os 8 caracteres completos', () => {
    expect(codigoValido('A1B2C3D4')).toBe(true);
    expect(codigoValido('A1B2C3')).toBe(false);
    expect(codigoValido('')).toBe(false);
  });

  it('recusa 8 caracteres com letra impossivel', () => {
    expect(codigoValido('ZZ12AB34')).toBe(false);
  });

  it('aceita o codigo com a formatacao que a tela mostra', () => {
    expect(codigoValido(formatarCodigo('A1B2C3D4'))).toBe(true);
  });
});

describe('formatarCodigo', () => {
  it('quebra em dois blocos de quatro', () => {
    expect(formatarCodigo('A1B2C3D4')).toBe('A1B2 C3D4');
  });

  it('nao inventa espaco em codigo curto nem quebra com nulo', () => {
    expect(formatarCodigo('A1B2')).toBe('A1B2');
    expect(formatarCodigo(null)).toBe('');
  });
});

describe('idadeEm', () => {
  const hoje = new Date(2026, 8, 22); // 22/09/2026, horario local

  it('conta anos completos', () => {
    expect(idadeEm('2000-09-22', hoje)).toBe(26);
  });

  it('nao adianta o aniversario que ainda nao chegou', () => {
    expect(idadeEm('2000-09-23', hoje)).toBe(25);
    expect(idadeEm('2000-12-01', hoje)).toBe(25);
  });

  /* Este e o caso que `new Date('2010-09-22')` erra: a string vira meia-
     noite UTC e, num fuso a oeste, volta um dia. Na vespera do
     aniversario de 16 anos isso trocaria a resposta da regra. */
  it('nao desloca a data por fuso horario', () => {
    expect(idadeEm('2010-09-22', new Date(2026, 8, 22))).toBe(16);
  });

  it('devolve null para data ausente ou malformada', () => {
    expect(idadeEm(null, hoje)).toBeNull();
    expect(idadeEm('', hoje)).toBeNull();
    expect(idadeEm('22/09/2010', hoje)).toBeNull();
    expect(idadeEm('2010-02-31', hoje)).toBeNull();
  });
});

describe('ehMenorDe16', () => {
  const hoje = new Date(2026, 8, 22);

  it('16 anos completos ja consente sozinho', () => {
    expect(ehMenorDe16('2010-09-22', hoje)).toBe(false);
  });

  it('um dia antes dos 16 ainda exige o responsavel', () => {
    expect(ehMenorDe16('2010-09-23', hoje)).toBe(true);
  });

  /* Mesmo criterio de `public.e_menor_de_16`: sem data, trata como
     menor. Liberar dado de saude mental de menor sem base legal e o erro
     que nao da para desfazer. */
  it('data desconhecida conta como menor', () => {
    expect(ehMenorDe16(null, hoje)).toBe(true);
    expect(ehMenorDe16('', hoje)).toBe(true);
  });
});

describe('validarDataNascimento', () => {
  const hoje = new Date(2026, 8, 22);

  it('aceita data plausivel', () => {
    expect(validarDataNascimento('2008-03-10', hoje)).toEqual({ ok: true });
  });

  it('recusa data no futuro', () => {
    const r = validarDataNascimento('2030-01-01', hoje);
    expect(r.ok).toBe(false);
  });

  it('recusa ano digitado errado', () => {
    expect(validarDataNascimento('1890-01-01', hoje).ok).toBe(false);
    expect(validarDataNascimento('2025-01-01', hoje).ok).toBe(false);
  });

  it('recusa vazio com mensagem propria', () => {
    const r = validarDataNascimento('', hoje);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toMatch(/Informe/);
  });
});
