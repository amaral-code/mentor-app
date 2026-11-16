import { describe, expect, it } from 'vitest';
import { gerarTextoDoEstudio, lacunasLocais, resumoLocal } from '../estudioCaderno';

describe('estúdio do caderno sem IA', () => {
  it('resumo local usa a primeira frase de cada nota e avisa que é sem IA', () => {
    const r = resumoLocal(['A mitose gera duas células iguais. Ocorre no corpo todo.', 'Meiose gera gametas.']);
    expect(r).toContain('• A mitose gera duas células iguais.');
    expect(r).toContain('sem IA');
  });
  it('lacunas: palavra que volta em notas diferentes', () => {
    expect(lacunasLocais(['mitose e cromossomos', 'cromossomos na meiose'])).toContain('**cromossomos** aparece em 2 notas');
  });
  it('sem chave nem servidor, cai no local sem chamar a rede', async () => {
    const r = await gerarTextoDoEstudio('resumo', ['Fotossíntese produz glicose e oxigênio.'], '');
    expect(r.viaIA).toBe(false);
  });
});
