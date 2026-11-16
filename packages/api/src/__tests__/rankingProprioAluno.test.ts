import { describe, expect, it } from 'vitest';
import { comProprioAluno } from '../rankingEngine';
import type { RankingEntry } from '@mentor/core/types';

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
    expect(lista.map((e: RankingEntry) => e.nome)).toEqual(['Ana', 'Lince']);
    expect(comProprioAluno(lista, perfil, 900, 3)).toHaveLength(2);
  });
});
