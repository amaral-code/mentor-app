import { describe, expect, it } from 'vitest';
import worker from '../worker.js';

/**
 * Regressao de um bug que chegou a producao.
 *
 * As variaveis AI_PROVIDER e AI_MODEL foram cadastradas juntas no painel
 * da Vercel, com o mesmo valor, coladas do mesmo jeito. O /health
 * respondeu:
 *
 *   {"provider":"gemini","model":"deepseek-v4-flash"}
 *
 * Um estado que, olhando o painel, parecia impossivel. A causa era que
 * AI_MODEL passava por .trim() e AI_PROVIDER nao, entao uma quebra de
 * linha invisivel no fim do valor derrubava so uma das duas.
 *
 * Estes testes usam a rota /health porque e a unica que expoe o que o
 * worker de fato leu do ambiente.
 */

const saude = async (env) => {
  const r = await worker.fetch(new Request('https://w.dev/health'), env);
  return r.json();
};

describe('provedor e modelo lidos do ambiente', () => {
  it('aceita o valor limpo', async () => {
    const d = await saude({ AI_PROVIDER: 'deepseek', AI_MODEL: 'deepseek-v4-flash' });
    expect(d.provider).toBe('deepseek');
    expect(d.model).toBe('deepseek-v4-flash');
  });

  // O CASO DO BUG: espaco/quebra de linha invisivel colado junto.
  it('ignora espaco e quebra de linha em volta do provedor', async () => {
    for (const sujo of ['deepseek\n', 'deepseek ', ' deepseek', '  deepseek\r\n', 'DeepSeek\n']) {
      const d = await saude({ AI_PROVIDER: sujo, AI_MODEL: 'deepseek-v4-flash' });
      expect(d.provider, `valor ${JSON.stringify(sujo)}`).toBe('deepseek');
    }
  });

  it('ignora espaco em volta do modelo', async () => {
    const d = await saude({ AI_PROVIDER: 'deepseek', AI_MODEL: ' deepseek-v4-flash\n' });
    expect(d.model).toBe('deepseek-v4-flash');
  });

  it('nunca devolve provedor e modelo de familias trocadas', async () => {
    // Era exatamente o estado impossivel visto em producao.
    const d = await saude({ AI_PROVIDER: 'deepseek\n', AI_MODEL: 'deepseek-v4-flash\n' });
    expect({ provider: d.provider, model: d.model }).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
  });

  /*
   * Padrao = DeepSeek, nao Gemini.
   *
   * O wrangler.toml contornava isso declarando AI_PROVIDER, mas esse
   * arquivo nao existe na Vercel - e la o padrao errado reaparecia,
   * mandando o trafego para o Gemini sem GEMINI_API_KEY configurada.
   */
  it('assume deepseek quando AI_PROVIDER nao existe', async () => {
    const d = await saude({});
    expect(d.provider).toBe('deepseek');
    expect(d.model).toBe('deepseek-v4-flash');
  });

  it('assume deepseek quando AI_PROVIDER vem vazio ou so com espaco', async () => {
    expect((await saude({ AI_PROVIDER: '' })).provider).toBe('deepseek');
    expect((await saude({ AI_PROVIDER: '   ' })).provider).toBe('deepseek');
  });

  it('respeita gemini quando pedido de propria vontade', async () => {
    const d = await saude({ AI_PROVIDER: 'gemini' });
    expect(d.provider).toBe('gemini');
    expect(d.model).toBe('gemini-2.0-flash');
  });

  it('respeita gemini mesmo sujo', async () => {
    expect((await saude({ AI_PROVIDER: ' GEMINI\n' })).provider).toBe('gemini');
  });
});
