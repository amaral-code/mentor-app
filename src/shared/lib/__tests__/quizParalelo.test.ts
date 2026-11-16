import { describe, expect, it, vi, afterEach } from 'vitest';
import { QUIZ_LOTE_MAX, QUIZ_TETO_TOKENS_SERVIDOR } from '../quizLotes';

/**
 * Orquestracao do quiz em lotes paralelos.
 *
 * Os dois sintomas relatados vinham daqui:
 *   - "demora demais": um pedido grande era UMA geracao gigante,
 *     sequencial por natureza;
 *   - "as vezes nao gera": esse pedido estourava o teto de saida do
 *     back-end e voltava truncado, e o parser nao salvava nada.
 *
 * `aiService` le a config no momento do import, por isso cada caso
 * reimporta o modulo com o env preparado.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Uma questao valida, com enunciado unico. */
const questao = (marca: string) => ({
  tema: 'Tema ' + marca,
  enunciado: 'Enunciado suficientemente longo da questao ' + marca,
  alternativas: ['a', 'b', 'c', 'd'],
  correta: 0,
  explicacao: 'porque ' + marca,
  dica: 'dica',
  dificuldade: 'media',
});

const respostaWorker = (questoes: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(questoes) }] } }] }),
});

async function carregar() {
  vi.resetModules();
  vi.stubEnv('VITE_AI_PROVIDER', 'deepseek');
  vi.stubEnv('VITE_AI_MODEL', 'deepseek-v4-flash');
  vi.stubEnv('VITE_AI_BASE_URL', 'https://worker.dev');
  vi.stubEnv('VITE_AI_PROXY_TOKEN', '');
  return import('../aiService');
}

describe('generateQuizStructured em lotes', () => {
  it('pedido pequeno faz UMA chamada (sem orquestracao desnecessaria)', async () => {
    const { generateQuizStructured } = await carregar();
    const fetchMock = vi.fn().mockResolvedValue(respostaWorker([questao('a'), questao('b')]));
    vi.stubGlobal('fetch', fetchMock);

    await generateQuizStructured('Matemática', 'geral', '', 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /* O CASO QUE NUNCA GERAVA: 30 questoes num pedido so. */
  it('pedido grande e dividido em varias chamadas', async () => {
    const { generateQuizStructured } = await carregar();
    let bloco = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      bloco++;
      return Promise.resolve(respostaWorker([questao(`b${bloco}-1`), questao(`b${bloco}-2`)]));
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateQuizStructured('Matemática', 'geral', '', 30);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(fetchMock.mock.calls.length).toBe(Math.ceil(30 / QUIZ_LOTE_MAX));
  });

  it('nenhum lote pede mais tokens que o teto do servidor', async () => {
    const { generateQuizStructured } = await carregar();
    const fetchMock = vi.fn().mockResolvedValue(respostaWorker([questao('x')]));
    vi.stubGlobal('fetch', fetchMock);

    await generateQuizStructured('Matemática', 'geral', '', 30);

    for (const [, init] of fetchMock.mock.calls) {
      const corpo = JSON.parse((init as RequestInit).body as string);
      expect(corpo.generationConfig.maxOutputTokens).toBeLessThanOrEqual(QUIZ_TETO_TOKENS_SERVIDOR);
    }
  });

  it('remove questao repetida entre lotes', async () => {
    const { generateQuizStructured } = await carregar();
    // Todos os lotes devolvem a MESMA questao: deve sobrar uma.
    const fetchMock = vi.fn().mockResolvedValue(respostaWorker([questao('igual'), questao('igual')]));
    vi.stubGlobal('fetch', fetchMock);

    const { questions } = await generateQuizStructured('Matemática', 'geral', '', 20);
    expect(questions).toHaveLength(1);
  });

  /* Antes era tudo ou nada: um lote ruim zerava a geracao inteira. */
  it('um lote que falha nao derruba os outros', async () => {
    const { generateQuizStructured } = await carregar();
    let chamada = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      chamada++;
      if (chamada === 1) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(respostaWorker([questao(`ok${chamada}`)]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { questions } = await generateQuizStructured('Matemática', 'geral', '', 24);
    expect(questions.length).toBeGreaterThan(0);
  });

  it('todos os lotes falhando propaga o erro para a tela', async () => {
    const { generateQuizStructured } = await carregar();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(generateQuizStructured('Matemática', 'geral', '', 24)).rejects.toThrow();
  });

  it('nunca devolve mais questoes do que o pedido', async () => {
    const { generateQuizStructured } = await carregar();
    let bloco = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      bloco++;
      return Promise.resolve(
        respostaWorker(Array.from({ length: 8 }, (_, i) => questao(`b${bloco}q${i}`))),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { questions } = await generateQuizStructured('Matemática', 'geral', '', 10);
    expect(questions).toHaveLength(10);
  });
});
