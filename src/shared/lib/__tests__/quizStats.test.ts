import { describe, expect, it } from 'vitest';
import { calcularEstatisticas } from '../quizStats';
import type { DesempenhoTopico } from '../../storage/SupabaseRepository';

/**
 * Analytics do quiz.
 *
 * O risco aqui e diagnostico falso: um topico com 1 erro em 1 questao
 * (0%) nao e "ponto fraco", e ruido. Estes testes travam a amostra
 * minima, o ordenamento e a ausencia de divisao por zero.
 */

const linha = (materia: string, topico: string, acertos: number, erros: number): DesempenhoTopico =>
  ({ materia, topico, acertos, erros });

describe('calcularEstatisticas', () => {
  it('vazio nao divide por zero e sugere praticar', () => {
    const r = calcularEstatisticas([]);
    expect(r.totalQuestoes).toBe(0);
    expect(r.aproveitamentoGeral).toBe(0);
    expect(r.porMateria).toEqual([]);
    expect(r.pontosFracos).toEqual([]);
  });

  it('agrega por materia com percentuais', () => {
    const r = calcularEstatisticas([
      linha('Matemática', 'Funções', 7, 3),
      linha('Matemática', 'Probabilidade', 2, 2),
      linha('Biologia', 'Citologia', 9, 1),
    ]);
    expect(r.totalQuestoes).toBe(24);
    expect(r.totalAcertos).toBe(18);
    expect(r.aproveitamentoGeral).toBe(75);
    // Mais volume primeiro.
    expect(r.porMateria[0].materia).toBe('Matemática');
    expect(r.porMateria[0].aproveitamento).toBe(64);
    expect(r.porMateria[1].materia).toBe('Biologia');
  });

  it('pontos fracos exigem amostra minima e vao do pior ao melhor', () => {
    const r = calcularEstatisticas([
      linha('Matemática', 'Funções', 1, 4), // 20%, 5 resp -> fraco
      linha('Matemática', 'Álgebra', 0, 1), // 0% mas 1 resp -> ruido, fora
      linha('Física', 'Mecânica', 1, 2), // 33%, 3 resp -> fraco
      linha('Biologia', 'Citologia', 9, 1), // 90% -> fora
    ]);
    expect(r.pontosFracos.map((t) => t.topico)).toEqual(['Funções', 'Mecânica']);
  });

  it('topico vazio vira rotulo Geral', () => {
    const r = calcularEstatisticas([linha('Química', '', 1, 1)]);
    expect(r.porMateria[0].topicos[0].topico).toBe('Geral');
  });

  it('ignora linha zerada sem quebrar a soma', () => {
    const r = calcularEstatisticas([linha('Física', 'Óptica', 0, 0), linha('Física', 'Mecânica', 2, 0)]);
    expect(r.totalQuestoes).toBe(2);
    expect(r.aproveitamentoGeral).toBe(100);
  });
});
