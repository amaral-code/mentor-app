import { describe, expect, it } from 'vitest';
import {
  COMPETENCIAS,
  ESQUEMA_CORRECAO,
  ajustarParaGrade,
  normalizarCorrecao,
  pareceFotoIlegivel,
  promptCorrecaoFoto,
} from '../../../../../../server/essaySchema.js';
import {
  calcularDimensoes,
  limitesDoHistograma,
  paraCinza,
  tabelaDeNiveis,
  formatarBytes,
} from '../imagePrep';

/**
 * Correcao por foto: o contrato de saida e o preparo da imagem.
 *
 * A tela divide imagem, transcricao e cinco competencias. Campo faltando
 * ou nota fora da grade quebraria a interface DEPOIS de o aluno esperar
 * a leitura de uma folha inteira - por isso a normalizacao e testada
 * contra respostas malformadas, nao so contra a resposta ideal.
 */

const RESPOSTA_IDEAL = {
  transcription: 'A '.repeat(200),
  detected_theme: 'Desafios da inclusão digital no Brasil',
  scores: {
    competence_1: { score: 160, feedback: 'Desvios pontuais de vírgula.' },
    competence_2: { score: 200, feedback: 'Domínio do tema com repertório legitimado.' },
    competence_3: { score: 160, feedback: 'Projeto de texto claro.' },
    competence_4: { score: 200, feedback: 'Operadores argumentativos variados.' },
    competence_5: { score: 160, feedback: 'Agente e ação presentes; falta detalhamento.' },
  },
  total_score: 880,
  strengths: ['Tese clara na introdução'],
  actionable_improvements: ['Detalhe o meio na proposta de intervenção'],
};

describe('esquema de resposta', () => {
  it('exige todos os campos do contrato publicado', () => {
    expect(ESQUEMA_CORRECAO.required).toEqual([
      'transcription', 'detected_theme', 'scores', 'total_score', 'strengths', 'actionable_improvements',
    ]);
    const scores: any = (ESQUEMA_CORRECAO as any).properties.scores;
    expect(scores.required).toHaveLength(5);
    expect(scores.properties.competence_5.required).toEqual(['score', 'feedback']);
  });

  it('cobre as cinco competencias do INEP na ordem oficial', () => {
    expect(COMPETENCIAS.map((c) => c.chave)).toEqual([
      'competence_1', 'competence_2', 'competence_3', 'competence_4', 'competence_5',
    ]);
    expect(COMPETENCIAS[4].guia).toContain('agente');
    expect(COMPETENCIAS[4].guia).toContain('detalhamento');
  });
});

describe('prompt da correcao', () => {
  it('pede transcricao fiel, sem corrigir o que o aluno escreveu', () => {
    const p = promptCorrecaoFoto('');
    expect(p).toContain('você é um escâner, não um revisor');
    expect(p).toContain('[ilegível]');
  });

  it('manda zerar quando a foto impede a leitura', () => {
    expect(promptCorrecaoFoto('')).toContain('atribua 0 a todas as competências');
  });

  it('usa o tema informado e, sem ele, manda identificar', () => {
    expect(promptCorrecaoFoto('Inclusão digital')).toContain('"Inclusão digital"');
    expect(promptCorrecaoFoto('')).toContain('identifique-o a partir do próprio texto');
  });

  it('prende a nota na grade discreta do INEP', () => {
    expect(promptCorrecaoFoto('')).toContain('0, 40, 80, 120, 160 ou 200');
    expect(promptCorrecaoFoto('')).toContain('Não use valores intermediários');
  });
});

describe('ajustarParaGrade', () => {
  it('arredonda para o degrau mais proximo', () => {
    expect(ajustarParaGrade(160)).toBe(160);
    expect(ajustarParaGrade(155)).toBe(160);
    // Empate desce, de proposito: nota inflada engana quem estuda.
    expect(ajustarParaGrade(100)).toBe(80);
    expect(ajustarParaGrade(101)).toBe(120);
    expect(ajustarParaGrade(-40)).toBe(0);
    expect(ajustarParaGrade(999)).toBe(200);
  });

  it('valor invalido vira zero em vez de NaN na tela', () => {
    expect(ajustarParaGrade('abc')).toBe(0);
    expect(ajustarParaGrade(undefined)).toBe(0);
  });
});

describe('normalizarCorrecao', () => {
  it('preserva uma resposta ja correta', () => {
    const c = normalizarCorrecao(RESPOSTA_IDEAL);
    expect(c.total_score).toBe(880);
    expect(c.scores.competence_2.score).toBe(200);
    expect(c.detected_theme).toContain('inclusão digital');
  });

  it('recalcula o total quando o modelo erra a soma', () => {
    const c = normalizarCorrecao({ ...RESPOSTA_IDEAL, total_score: 1000 });
    // O aluno confere a soma: nota geral que nao bate com o detalhamento
    // logo abaixo destroi a confianca na correcao inteira.
    expect(c.total_score).toBe(880);
  });

  it('sobrevive a competencia faltando', () => {
    const c = normalizarCorrecao({
      ...RESPOSTA_IDEAL,
      scores: { competence_1: { score: 200, feedback: 'ok' } },
    });
    expect(Object.keys(c.scores)).toHaveLength(5);
    expect(c.scores.competence_4.score).toBe(0);
    expect(c.scores.competence_4.feedback).toBeTruthy();
    expect(c.total_score).toBe(200);
  });

  it('sobrevive a lixo completo sem lancar', () => {
    const c = normalizarCorrecao(null);
    expect(c.total_score).toBe(0);
    expect(c.strengths).toEqual([]);
    expect(c.detected_theme).toBe('Tema não identificado');
  });

  it('corta listas longas demais para a tela', () => {
    const c = normalizarCorrecao({ ...RESPOSTA_IDEAL, strengths: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(c.strengths).toHaveLength(4);
  });
});

describe('pareceFotoIlegivel', () => {
  it('reconhece foto ruim: redacao de caderno nao tem 3 linhas', () => {
    expect(pareceFotoIlegivel(normalizarCorrecao({ ...RESPOSTA_IDEAL, transcription: 'nao consegui ler' }))).toBe(true);
  });

  it('nao acusa foto boa', () => {
    expect(pareceFotoIlegivel(normalizarCorrecao(RESPOSTA_IDEAL))).toBe(false);
  });

  it('texto so de [ilegível] conta como ilegivel', () => {
    const transcription = '[ilegível] '.repeat(40);
    expect(pareceFotoIlegivel(normalizarCorrecao({ ...RESPOSTA_IDEAL, transcription }))).toBe(true);
  });
});

describe('preparo da imagem no cliente', () => {
  it('reduz o lado maior mantendo a proporcao', () => {
    expect(calcularDimensoes(4032, 3024, 1600)).toEqual({ largura: 1600, altura: 1200 });
    expect(calcularDimensoes(3024, 4032, 1600)).toEqual({ largura: 1200, altura: 1600 });
  });

  it('nao amplia foto pequena', () => {
    expect(calcularDimensoes(800, 600, 1600)).toEqual({ largura: 800, altura: 600 });
  });

  it('alonga os niveis descartando as pontas do histograma', () => {
    // Folha "lavada": tudo entre 60 e 200, mais um pixel branco perdido.
    const hist = new Uint32Array(256);
    for (let i = 60; i <= 200; i++) hist[i] = 100;
    hist[255] = 1;

    const { preto, branco } = limitesDoHistograma(hist, 14101, 0.005);
    expect(preto).toBeGreaterThanOrEqual(60);
    // O pixel isolado em 255 nao pode definir o branco da pagina.
    expect(branco).toBeLessThan(255);
  });

  it('devolve a escala inteira quando a folha e quase uniforme', () => {
    const hist = new Uint32Array(256);
    hist[128] = 1000;
    expect(limitesDoHistograma(hist, 1000)).toEqual({ preto: 0, branco: 255 });
  });

  it('a tabela de niveis leva preto a 0 e branco a 255', () => {
    const t = tabelaDeNiveis(60, 200);
    expect(t[60]).toBe(0);
    expect(t[200]).toBe(255);
    expect(t[130]).toBeGreaterThan(100);
    expect(t[130]).toBeLessThan(160);
  });

  it('cinza usa luminancia perceptual', () => {
    expect(Math.round(paraCinza(255, 255, 255))).toBe(255);
    expect(Math.round(paraCinza(0, 0, 0))).toBe(0);
    // Verde pesa mais que azul para o olho humano.
    expect(paraCinza(0, 255, 0)).toBeGreaterThan(paraCinza(0, 0, 255));
  });

  it('mostra o tamanho em unidade legivel', () => {
    expect(formatarBytes(5_400_000)).toBe('5,1 MB');
    expect(formatarBytes(480_000)).toBe('469 kB');
  });
});
