import { describe, expect, it } from 'vitest';
import { diaDeBrasilia, ofensivaAoAbrir } from '../utils';
import { searchKB } from '../kbSearch';
import { comProprioAluno } from '../rankingEngine';
import type { RankingEntry } from '../../types';

describe('diaDeBrasilia', () => {
  it('22h30 em Brasília ainda é o mesmo dia, embora já seja amanhã em UTC', () => {
    // 01:30 UTC do dia 11 = 22:30 do dia 10 em Brasília.
    expect(diaDeBrasilia(new Date('2026-11-11T01:30:00Z'))).toBe('2026-11-10');
    expect(diaDeBrasilia(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-11');
  });
});

describe('ofensivaAoAbrir', () => {
  const hoje = '2026-11-10';

  it('já entrou hoje: não mexe', () => {
    expect(ofensivaAoAbrir(hoje, 5, hoje)).toBeNull();
  });

  it('data à frente (servidor acabou de gravar): não zera a sequência', () => {
    // Era exatamente este caso que derrubava a ofensiva de 5 para 1.
    expect(ofensivaAoAbrir('2026-11-11', 5, hoje)).toBeNull();
  });

  it('entrou ontem: continua', () => {
    expect(ofensivaAoAbrir('2026-11-09', 5, hoje)).toEqual({ lastAccessDate: hoje, streak: 6 });
  });

  it('pulou um dia ou nunca entrou: recomeça', () => {
    expect(ofensivaAoAbrir('2026-11-08', 5, hoje)?.streak).toBe(1);
    expect(ofensivaAoAbrir('', 0, hoje)?.streak).toBe(1);
  });

  it('virada de mês e de ano', () => {
    expect(ofensivaAoAbrir('2026-10-31', 2, '2026-11-01')?.streak).toBe(3);
    expect(ofensivaAoAbrir('2026-12-31', 9, '2027-01-01')?.streak).toBe(10);
  });
});

describe('busca na base local', () => {
  const kb = [
    { id: 'filo', keywords: ['mito', 'caverna', 'platao'], content: 'Mito da Caverna', source: 'faq' as const },
    { id: 'bio', keywords: ['mitose', 'divisao', 'celular'], content: 'Mitose', source: 'faq' as const },
  ];

  it('"mitose" não casa com "mito"', () => {
    expect(searchKB('O que é mitose?', [kb[0]])).toBeNull();
    expect(searchKB('O que é mitose?', kb)?.entry.id).toBe('bio');
  });

  it('plural e flexão continuam casando', () => {
    expect(searchKB('como funcionam as mitoses', kb)?.entry.id).toBe('bio');
  });
});

describe('ranking sem colegas inventados', () => {
  const perfil = { uid: 'u1', nome: 'Ana', email: '' };

  it('aluno novo, sem XP, aparece sozinho na própria lista', () => {
    const lista = comProprioAluno([], perfil, 0, 1);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ destaque: true, posicao: 1, nome: 'Ana' });
  });

  it('entra na posição certa entre os colegas reais e não duplica', () => {
    const colega = { posicao: 1, nome: 'Lince', xp: 500, destaque: false } as RankingEntry;
    const lista = comProprioAluno([colega], perfil, 900, 3);
    expect(lista.map((e) => e.nome)).toEqual(['Ana', 'Lince']);
    expect(comProprioAluno(lista, perfil, 900, 3)).toHaveLength(2);
  });
});
