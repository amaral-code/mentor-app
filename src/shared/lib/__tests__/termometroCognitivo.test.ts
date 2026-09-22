import { describe, expect, it } from 'vitest';
import {
  AMOSTRA_MINIMA,
  nivelDeCalor,
  percentualAlerta,
  percentualExaustao,
  resumoRede,
  resumoTurma,
  sugerirIntervencao,
  temAmostraSuficiente,
  turmasOcultas,
  turmasVisiveis,
  type TurmaTermometro,
} from '../termometroCognitivo';

function turma(over: Partial<TurmaTermometro> = {}): TurmaTermometro {
  return {
    turmaId: 't1',
    turmaNome: 'Turma 3º B',
    totalAlunos: 30,
    comIndice: 20,
    exaustos: 0,
    emAlerta: 0,
    scoreMedio: 20,
    minutosFocoMedio: 25,
    distracoesMedia: 1,
    fracaoMadrugada: 0.05,
    ...over,
  };
}

describe('percentuais', () => {
  it('divide pelos alunos MEDIDOS, nao pela matricula', () => {
    // 13 de 20 medidos = 65%, ainda que a turma tenha 30 matriculados.
    expect(percentualExaustao(turma({ exaustos: 13 }))).toBe(65);
    expect(percentualAlerta(turma({ emAlerta: 5 }))).toBe(25);
  });

  it('turma sem ninguem medido nao vira divisao por zero', () => {
    expect(percentualExaustao(turma({ comIndice: 0, exaustos: 0 }))).toBe(0);
    expect(percentualAlerta(turma({ comIndice: 0 }))).toBe(0);
  });
});

describe('nivelDeCalor', () => {
  it('respeita os cortes 25 / 50 / 75', () => {
    expect(nivelDeCalor(0)).toBe('calmo');
    expect(nivelDeCalor(24)).toBe('calmo');
    expect(nivelDeCalor(25)).toBe('atencao');
    expect(nivelDeCalor(49)).toBe('atencao');
    expect(nivelDeCalor(50)).toBe('alerta');
    expect(nivelDeCalor(74)).toBe('alerta');
    expect(nivelDeCalor(75)).toBe('critico');
    expect(nivelDeCalor(100)).toBe('critico');
  });
});

describe('anonimato', () => {
  it('turma abaixo da amostra minima nunca aparece', () => {
    const pequena = turma({ turmaId: 'p', comIndice: AMOSTRA_MINIMA - 1, exaustos: 3 });
    expect(temAmostraSuficiente(pequena)).toBe(false);
    expect(turmasVisiveis([pequena])).toEqual([]);
    expect(turmasOcultas([pequena])).toBe(1);
  });

  it('ordena da turma mais quente para a mais fria', () => {
    const fria = turma({ turmaId: 'fria', exaustos: 2 });
    const quente = turma({ turmaId: 'quente', exaustos: 14 });
    const morna = turma({ turmaId: 'morna', exaustos: 7 });
    expect(turmasVisiveis([fria, quente, morna]).map((t) => t.turmaId)).toEqual([
      'quente',
      'morna',
      'fria',
    ]);
  });
});

describe('resumoTurma', () => {
  it('escreve a frase do painel', () => {
    expect(resumoTurma(turma({ exaustos: 13 }))).toBe(
      '65% da Turma 3º B está com exaustão cognitiva hoje.',
    );
  });

  it('turma sem exaustao ganha frase propria (nao "0%")', () => {
    expect(resumoTurma(turma(), 'semana')).toContain('Nenhum aluno');
  });
});

describe('sugerirIntervencao', () => {
  it('madrugada vence a temperatura geral', () => {
    const i = sugerirIntervencao(turma({ exaustos: 16, fracaoMadrugada: 0.4 }));
    expect(i.titulo).toContain('22h');
    expect(i.motivo).toContain('40%');
  });

  it('muita distracao pede bloco de foco coletivo', () => {
    const i = sugerirIntervencao(turma({ exaustos: 10, distracoesMedia: 5.2 }));
    expect(i.titulo).toContain('foco');
    expect(i.motivo).toContain('5.2');
  });

  it('foco curto pede conteudo fatiado', () => {
    const i = sugerirIntervencao(turma({ minutosFocoMedio: 8 }));
    expect(i.titulo).toContain('blocos');
  });

  it('turma quente sem sinal especifico adia a avaliacao', () => {
    const i = sugerirIntervencao(turma({ exaustos: 13 }));
    expect(i.titulo).toContain('avaliação');
    expect(i.motivo).toContain('65%');
  });

  it('turma calma recebe permissao de avancar, nao alarme', () => {
    expect(sugerirIntervencao(turma()).titulo).toBe('Mantenha o ritmo');
  });
});

describe('resumoRede', () => {
  it('soma alunos antes de dividir (turma grande pesa mais)', () => {
    const grande = turma({ turmaId: 'g', comIndice: 40, exaustos: 4 });
    const pequena = turma({ turmaId: 'p', comIndice: 10, exaustos: 6 });
    const r = resumoRede([grande, pequena]);
    expect(r.alunosMedidos).toBe(50);
    // 10/50 = 20%; a media das medias daria 35% e inflaria o alarme.
    expect(r.percentualExaustao).toBe(20);
    expect(r.nivel).toBe('calmo');
    expect(r.turmasMedidas).toBe(2);
  });

  it('ignora turmas ocultas tambem no agregado', () => {
    const r = resumoRede([turma({ comIndice: 2, exaustos: 2 })]);
    expect(r.alunosMedidos).toBe(0);
    expect(r.percentualExaustao).toBe(0);
  });
});
