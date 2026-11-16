import { describe, expect, it } from 'vitest';
import {
  filtrarIneditas,
  formatarTempoSimulado,
  hashEnunciado,
  montarBlocoAntirrepeticao,
  normalizarEnunciado,
  validarRascunhoSimulado,
} from '../quizHistory';

/**
 * Antirrepeticao do quiz.
 *
 * A garantia e em tres camadas (banco unique, prompt, filtro cliente) e
 * as tres usam o MESMO hash: se a normalizacao divergisse entre
 * gravacao e leitura, a questao voltaria. Estes testes travam a
 * estabilidade do hash e o comportamento do filtro.
 */

describe('normalizarEnunciado + hashEnunciado', () => {
  it('ignora caixa, pontuacao e espacos', () => {
    expect(normalizarEnunciado('  Qual a CAPITAL?? ')).toBe('qual a capital');
    expect(hashEnunciado('Qual a capital??')).toBe(hashEnunciado('QUAL A CAPITAL'));
  });

  it('e estavel e tem 16 hex', () => {
    const h = hashEnunciado('Uma função afim passa por (0, 2) e (2, 6).');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hashEnunciado('Uma função afim passa por (0, 2) e (2, 6).')).toBe(h);
  });

  it('enunciados diferentes dao hashes diferentes', () => {
    expect(hashEnunciado('Quanto é 2 + 2?')).not.toBe(hashEnunciado('Quanto é 3 + 3?'));
  });
});

describe('filtrarIneditas', () => {
  it('remove o que ja foi exibido pelo mesmo hash', () => {
    const qs = [
      { enunciado: 'Questão nova sobre fotossíntese aqui.' },
      { enunciado: 'QUESTÃO NOVA SOBRE FOTOSSÍNTESE AQUI!!' },
      { enunciado: 'Questão inédita sobre mitose aqui.' },
    ];
    const vistos = new Set([hashEnunciado(qs[0].enunciado)]);
    const resto = filtrarIneditas(qs, vistos);
    // A segunda e a mesma normalizada: cai junto com a primeira.
    expect(resto.map((q) => q.enunciado)).toEqual(['Questão inédita sobre mitose aqui.']);
  });

  it('sem historico, nada e filtrado', () => {
    const qs = [{ enunciado: 'A' }, { enunciado: 'B' }];
    expect(filtrarIneditas(qs, new Set())).toHaveLength(2);
  });
});

describe('formatarTempoSimulado', () => {
  it('formata mm:ss com zeros', () => {
    expect(formatarTempoSimulado(8100)).toBe('135:00');
    expect(formatarTempoSimulado(65)).toBe('01:05');
    expect(formatarTempoSimulado(0)).toBe('00:00');
    expect(formatarTempoSimulado(-30)).toBe('00:00');
  });
});

describe('validarRascunhoSimulado', () => {
  const base = {
    versao: 1,
    questions: [
      {
        id: 'q1', materia: 'Matemática', enunciado: 'Quanto é 2+2?',
        alternativas: ['1', '2', '3', '4'], correta: 2, explicacao: 'x',
      },
    ],
    respostas: { 0: 1 },
    currentIndex: 0,
    acertos: 0,
    fimEm: 2000,
    totalMin: 3,
    dificuldade: 'media',
    materia: 'Simulado',
  };

  it('aceita rascunho valido dentro do prazo', () => {
    const r = validarRascunhoSimulado(base, 1000);
    expect(r?.questions).toHaveLength(1);
    expect(r?.respostas).toEqual({ 0: 1 });
  });

  it('expirado, versao errada ou malformado viram null', () => {
    expect(validarRascunhoSimulado(base, 2000)).toBeNull(); // fimEm <= agora
    expect(validarRascunhoSimulado(base, 5000)).toBeNull();
    expect(validarRascunhoSimulado({ ...base, versao: 2 }, 1000)).toBeNull();
    expect(validarRascunhoSimulado({ ...base, questions: [] }, 1000)).toBeNull();
    expect(validarRascunhoSimulado(null, 1000)).toBeNull();
    expect(validarRascunhoSimulado('lixo', 1000)).toBeNull();
  });

  it('descarta questao fora do contrato e ajusta o indice', () => {
    const r = validarRascunhoSimulado(
      {
        ...base,
        questions: [...base.questions, { id: 'ruim', enunciado: 'x' }],
        currentIndex: 9,
      },
      1000,
    );
    expect(r?.questions).toHaveLength(1);
    expect(r?.currentIndex).toBe(0);
  });
});

describe('montarBlocoAntirrepeticao', () => {
  it('vazio quando nao ha historico (prompt sem peso morto)', () => {
    expect(montarBlocoAntirrepeticao([])).toBe('');
  });

  it('lista ate 20 previews com ordem contra repeticao e reformulacao', () => {
    const bloco = montarBlocoAntirrepeticao(['Q1', 'Q2']);
    expect(bloco).toContain('JÁ APLICADAS');
    expect(bloco).toContain('não repita');
    expect(bloco).toContain('reformule');
    expect(bloco).toContain('1. Q1');
    expect(montarBlocoAntirrepeticao(Array.from({ length: 30 }, (_, i) => `Q${i}`)).split('\n')).toHaveLength(21);
  });
});
