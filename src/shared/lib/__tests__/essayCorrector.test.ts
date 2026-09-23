import { describe, it, expect } from 'vitest';
import { correctEssay } from '../essayCorrector';

describe('correctEssay', () => {
  const goodEssay = [
    'A educação é um direito fundamental de todo cidadão brasileiro. Segundo a Constituição Federal, é dever do Estado garantir o acesso ao ensino de qualidade para todas as crianças e jovens do país.',
    '',
    'No entanto, observa-se que milhões de jovens ainda estão fora da sala de aula. Dados do IBGE indicam que a evasão escolar cresceu nos últimos anos, principalmente entre as classes mais baixas da população brasileira.',
    '',
    'Diante disso, é necessário que o governo invista em políticas públicas eficientes de inclusão educacional. Além disso, a escola deve promover um ambiente acolhedor para manter os alunos engajados e motivados.',
    '',
    'Portanto, cabe ao Ministério da Educação implementar programas de permanência estudantil, criando bolsas e auxílios para os estudantes em situação de vulnerabilidade social e econômica.',
    '',
    'Dessa forma, será possível reduzir a desigualdade educacional no país e garantir um futuro melhor para todos os brasileiros que dependem da educação pública.',
  ].join('\n\n');

  it('returns all 5 competencies', () => {
    const result = correctEssay(goodEssay);
    expect(result.competencia1).toBeDefined();
    expect(result.competencia2).toBeDefined();
    expect(result.competencia3).toBeDefined();
    expect(result.competencia4).toBeDefined();
    expect(result.competencia5).toBeDefined();
  });

  it('calculates notaFinal between 0-1000', () => {
    const result = correctEssay(goodEssay);
    expect(result.notaFinal).toBeGreaterThanOrEqual(0);
    expect(result.notaFinal).toBeLessThanOrEqual(1000);
  });

  it('detects short text and penalizes C1', () => {
    const shortText = 'Estou estudando para o ENEM. Vou passar.';
    const result = correctEssay(shortText);
    expect(result.competencia1).toBeLessThan(200);
    expect(result.pontosMelhorar).toContain('Texto muito curto. Mínimo recomendado: 150 palavras');
  });

  it('penalizes excessive word repetition', () => {
    const repetitivo = Array(20).fill('A educação é importante porque educação transforma a vida das pessoas com educação de qualidade.').join(' ');
    const result = correctEssay(repetitivo);
    // The keyword "educação" would repeat many times
    const wordCount200 = repetitivo.split(/\s+/).length;
    if (wordCount200 >= 200) {
      // most likely C1 got penalized
      expect(result.competencia1).toBeLessThan(200);
    }
  });

  it('penalizes slang usage', () => {
    const textWithSlang = [
      'Então tipo, a parada é que tipo o ENEM é muito foda cara. Tipo, o bagulho é doido. Tipo, tenho que estudar pra caramba.',
      ...Array(15).fill('A educação é importante para a sociedade.'),
    ].join('\n\n');
    const result = correctEssay(textWithSlang);
    expect(result.pontosMelhorar).toContain('Evitar linguagem informal e gírias');
  });

  it('gives bonus for good structure in C2', () => {
    const result = correctEssay(goodEssay);
    // Good essay has >200 words and >=4 paragraphs
    expect(result.competencia2).toBeGreaterThanOrEqual(60);
  });

  it('gives bonus for repertorio markers in C3', () => {
    const result = correctEssay(goodEssay);
    expect(result.competencia3).toBeGreaterThanOrEqual(50);
  });

  it('scores C4 based on conectivos count', () => {
    const result = correctEssay(goodEssay);
    // The essay has "No entanto", "Diante disso", "Além disso", "Portanto", "Dessa forma"
    expect(result.competencia4).toBeGreaterThanOrEqual(25);
  });

  it('scores C5 higher when intervention proposal includes agent and action', () => {
    const result = correctEssay(goodEssay);
    // "governo" (agent) + "implementar" / "criando" (action)
    expect(result.competencia5).toBeGreaterThanOrEqual(120);
  });

  it('generates pontosFortes and pontosMelhorar lists', () => {
    const result = correctEssay(goodEssay);
    expect(result.pontosFortes.length).toBeGreaterThan(0);
    expect(result.pontosMelhorar).toBeDefined();
  });

  it('preserves original text', () => {
    const result = correctEssay(goodEssay);
    expect(result.originalText).toBe(goodEssay);
  });
});
