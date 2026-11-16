import { describe, expect, it } from 'vitest';
import {
  JANELA_PRESENCA_MS,
  colegasNaSala,
  estaPresente,
  formatarCronometro,
  formatarTempoFoco,
  iniciaisDeSala,
  minutosDeFoco,
  nomeDeSala,
  resumoSala,
  rotuloMateria,
  totalColegas,
  type PresencaSala,
} from '../salaFoco';

const AGORA = Date.parse('2026-03-10T21:00:00.000Z');

function presenca(over: Partial<PresencaSala> = {}): PresencaSala {
  return {
    nome: 'Ana M.',
    avatarUrl: null,
    materia: 'Matemática',
    minutosFoco: 10,
    ultimoPing: new Date(AGORA - 5_000).toISOString(),
    entrouEm: new Date(AGORA - 600_000).toISOString(),
    ehVoce: false,
    ...over,
  };
}

describe('nomeDeSala', () => {
  it('reduz a primeiro nome + inicial', () => {
    expect(nomeDeSala('Ana Beatriz Moreira')).toBe('Ana M.');
    expect(nomeDeSala('Joao')).toBe('Joao');
  });

  it('nome vazio nunca vira string vazia na tela', () => {
    expect(nomeDeSala('   ')).toBe('Colega');
  });
});

describe('iniciaisDeSala', () => {
  it('usa primeira e ultima inicial', () => {
    expect(iniciaisDeSala('Ana Moreira')).toBe('AM');
    expect(iniciaisDeSala('Ana')).toBe('AN');
    expect(iniciaisDeSala('')).toBe('?');
  });
});

describe('presenca por heartbeat', () => {
  it('ping dentro da janela conta como presente', () => {
    expect(estaPresente(presenca(), AGORA)).toBe(true);
    expect(
      estaPresente(presenca({ ultimoPing: new Date(AGORA - JANELA_PRESENCA_MS).toISOString() }), AGORA),
    ).toBe(true);
  });

  it('quem parou de pingar some da sala', () => {
    const sumiu = presenca({ ultimoPing: new Date(AGORA - JANELA_PRESENCA_MS - 1).toISOString() });
    expect(estaPresente(sumiu, AGORA)).toBe(false);
    expect(colegasNaSala([sumiu], AGORA)).toEqual([]);
  });

  it('data invalida nao vira presenca eterna', () => {
    expect(estaPresente(presenca({ ultimoPing: 'nao-e-data' }), AGORA)).toBe(false);
  });
});

describe('colegasNaSala', () => {
  it('coloca voce por ultimo e ordena colegas por tempo de foco', () => {
    const lista = [
      presenca({ nome: 'Você', ehVoce: true, minutosFoco: 90 }),
      presenca({ nome: 'Bia R.', minutosFoco: 12 }),
      presenca({ nome: 'Caio S.', minutosFoco: 40 }),
    ];
    expect(colegasNaSala(lista, AGORA).map((p) => p.nome)).toEqual(['Caio S.', 'Bia R.', 'Você']);
  });

  it('nao conta voce entre os colegas', () => {
    const lista = [presenca({ ehVoce: true }), presenca()];
    expect(totalColegas(lista, AGORA)).toBe(1);
  });
});

describe('resumoSala', () => {
  it('convida quem ainda nao entrou', () => {
    expect(resumoSala(0, false)).toContain('silenciosa');
    expect(resumoSala(3, false)).toContain('3 pessoas');
  });

  it('acolhe quem chegou primeiro', () => {
    expect(resumoSala(0, true)).toContain('chegou primeiro');
    expect(resumoSala(1, true)).toBe('Você e mais 1 pessoa focando agora, em silêncio.');
  });
});

describe('formatacao', () => {
  it('formata tempo de foco', () => {
    expect(formatarTempoFoco(0)).toBe('começou agora');
    expect(formatarTempoFoco(45)).toBe('45min');
    expect(formatarTempoFoco(60)).toBe('1h');
    expect(formatarTempoFoco(80)).toBe('1h 20min');
  });

  it('cronometro proprio anda em mm:ss e vira h depois de 60min', () => {
    expect(formatarCronometro(0)).toBe('00:00');
    expect(formatarCronometro(65)).toBe('01:05');
    expect(formatarCronometro(3_600)).toBe('1h 00min');
    expect(formatarCronometro(4_920)).toBe('1h 22min');
  });

  it('sem materia declarada, nao inventa materia', () => {
    expect(rotuloMateria('  ')).toBe('Estudo livre');
    expect(rotuloMateria('Biologia')).toBe('Biologia');
  });
});

describe('minutosDeFoco', () => {
  it('conta so minutos inteiros de tela visivel', () => {
    expect(minutosDeFoco(59)).toBe(0);
    expect(minutosDeFoco(60)).toBe(1);
    expect(minutosDeFoco(3_599)).toBe(59);
    expect(minutosDeFoco(-10)).toBe(0);
  });
});
