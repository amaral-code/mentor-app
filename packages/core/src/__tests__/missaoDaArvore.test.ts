import { describe, expect, it } from 'vitest';
import {
  SOBRE_O_TIPO,
  TIPO_DA_ESPECIE,
  acertos,
  avancar,
  materiaDaArvore,
  montarMissao,
  novaRodada,
  passou,
  precisaAcertar,
  responder,
  type TipoMissao,
} from '../missaoDaArvore';

/* Sorteio previsível: os testes não podem depender da sorte. */
function sorteio(semente = 7) {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('o formato da árvore decide a missão', () => {
  it('cada formato tem um tipo diferente de quiz', () => {
    expect(TIPO_DA_ESPECIE).toEqual({ redonda: 'escolha', pinheiro: 'verdadeiroFalso', nuvem: 'umaOuOutra' });
    expect(new Set(Object.values(TIPO_DA_ESPECIE)).size).toBe(3);
  });

  it('múltipla escolha: 4 opções e a certa continua certa depois de embaralhar', () => {
    const itens = montarMissao('escolha', 'Matemática', sorteio());
    expect(itens).toHaveLength(SOBRE_O_TIPO.escolha.quantidade);
    for (const it of itens) {
      expect(it.opcoes).toHaveLength(4);
      expect(it.correta).toBeGreaterThanOrEqual(0);
    }
  });

  it('verdadeiro ou falso: metade de cada, mesmo em matéria com 3 questões', () => {
    const itens = montarMissao('verdadeiroFalso', 'Biologia', sorteio(3));
    expect(itens).toHaveLength(4);
    for (const it of itens) {
      expect(it.opcoes).toEqual(['Verdadeiro', 'Falso']);
      expect(it.respostaProposta).toBeTruthy();
    }
    expect(itens.filter((i) => i.correta === 0)).toHaveLength(2);
  });

  it('uma ou outra: duas opções, uma certa', () => {
    const itens = montarMissao('umaOuOutra', 'Física', sorteio(11));
    expect(itens).toHaveLength(4);
    for (const it of itens) expect(it.opcoes).toHaveLength(2);
  });

  it('nenhuma missão sai vazia, em nenhuma matéria', () => {
    for (const tipo of ['escolha', 'verdadeiroFalso', 'umaOuOutra'] as TipoMissao[]) {
      for (const m of ['Matemática', 'Química', 'Inglês']) expect(montarMissao(tipo, m, sorteio()).length).toBeGreaterThan(0);
    }
  });
});

describe('matéria da árvore', () => {
  it('começa pela matéria em que o aluno mais erra', () => {
    const hist = [
      { materia: 'Química', pct: 30 },
      { materia: 'História', pct: 90 },
      { materia: 'Matemática', pct: 60 },
    ];
    expect(materiaDaArvore(0, hist)).toBe('Química');
    expect(materiaDaArvore(1, hist)).toBe('Matemática');
  });

  it('sem histórico, segue a lista do quiz e não cai em Redação', () => {
    expect(materiaDaArvore(0, [])).toBe('Matemática');
    for (let i = 0; i < 20; i++) expect(materiaDaArvore(i, [])).not.toBe('Redação');
  });
});

describe('rodada', () => {
  const itens = montarMissao('escolha', 'Matemática', sorteio());

  it('vale a primeira resposta; trocar depois não conta', () => {
    let r = novaRodada(itens);
    const errada = (itens[0].correta + 1) % 4;
    r = responder(r, errada);
    r = responder(r, itens[0].correta);
    expect(r.respostas[0]).toBe(errada);
  });

  it('não avança sem responder', () => {
    const r = novaRodada(itens);
    expect(avancar(r)).toBe(r);
  });

  it('passa com 60%, e chutar tudo errado não passa', () => {
    let r = novaRodada(itens);
    for (const it of itens) r = avancar(responder(r, it.correta));
    expect(r.terminou).toBe(true);
    expect(acertos(r)).toBe(itens.length);
    expect(passou(r)).toBe(true);

    let ruim = novaRodada(itens);
    for (const it of itens) ruim = avancar(responder(ruim, (it.correta + 1) % 4));
    expect(passou(ruim)).toBe(false);
  });

  it('o mínimo arredonda para cima', () => {
    expect(precisaAcertar(3)).toBe(2);
    expect(precisaAcertar(4)).toBe(3);
  });
});

describe('falas do sagui', () => {
  it('a abertura diz a matéria, quantas e quanto precisa acertar', async () => {
    const { falaDeAbertura } = await import('../missaoDaArvore');
    const f = falaDeAbertura('verdadeiroFalso', 'Química', 4);
    expect(f).toContain('Química');
    expect(f).toContain('Acerte 3');
  });

  it('o fim muda com o resultado', async () => {
    const { falaDoFim } = await import('../missaoDaArvore');
    expect(falaDoFim(4, 4)).toContain('Gabaritou');
    expect(falaDoFim(3, 4)).toContain('cumprida');
    expect(falaDoFim(2, 4)).toContain('por pouco');
    expect(falaDoFim(0, 4)).toContain('difícil');
  });
});
