import { describe, expect, it } from 'vitest';
import { criarLeitorSSE, transmitirChat } from '../chatStream';

function respostaSSE(eventos: object[], tamanho = 5): Response {
  const bytes = new TextEncoder().encode(eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''));
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += tamanho) c.enqueue(bytes.slice(i, i + tamanho));
      c.close();
    },
  });
  return new Response(corpo, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('criarLeitorSSE', () => {
  it('evento partido entre pedaços sai inteiro uma vez', () => {
    const l = criarLeitorSSE();
    expect(l.empurrar('data: {"x"')).toEqual([]);
    expect(l.empurrar(':1}\n')).toEqual(['{"x":1}']);
  });
});

describe('transmitirChat', () => {
  it('chama aoParcial com o texto acumulado e devolve o fim', async () => {
    const parciais: string[] = [];
    let corpoEnviado: Record<string, unknown> = {};
    const fim = await transmitirChat({
      url: '/api/chat/completions',
      corpo: { modo: 'exatas', mensagens: [] },
      fetch: async (_u, init) => {
        corpoEnviado = JSON.parse(String(init.body));
        return respostaSSE([
          { tipo: 'delta', texto: 'Boa ' },
          { tipo: 'delta', texto: 'pergunta.' },
          { tipo: 'fim', texto: 'Boa pergunta.', frustrationDetected: true, fontes: [], groundingUsado: false },
        ]);
      },
      aoParcial: (t) => parciais.push(t),
    });
    expect(corpoEnviado.stream).toBe(true);
    expect(parciais).toEqual(['Boa ', 'Boa pergunta.']);
    expect(fim).toMatchObject({ texto: 'Boa pergunta.', frustrationDetected: true, modo: 'exatas' });
  });

  it('servidor antigo (JSON inteiro) também funciona', async () => {
    const fim = await transmitirChat({
      url: '/x',
      corpo: { modo: 'enem_geral' },
      fetch: async () => new Response(JSON.stringify({ texto: 'oi', fontes: [] }), { headers: { 'Content-Type': 'application/json' } }),
    });
    expect(fim.texto).toBe('oi');
  });

  it('conexão cai depois de alguns pedaços: aproveita o que chegou', async () => {
    const fim = await transmitirChat({
      url: '/x',
      corpo: {},
      fetch: async () => respostaSSE([{ tipo: 'delta', texto: 'metade da ' }, { tipo: 'delta', texto: 'resposta' }]),
    });
    expect(fim.texto).toBe('metade da resposta');
  });

  it('evento de erro e status de erro viram exceção', async () => {
    await expect(
      transmitirChat({ url: '/x', corpo: {}, fetch: async () => respostaSSE([{ tipo: 'erro', mensagem: 'caiu' }]) }),
    ).rejects.toThrow('caiu');
    await expect(
      transmitirChat({ url: '/x', corpo: {}, fetch: async () => new Response('cota', { status: 429 }) }),
    ).rejects.toThrow('429');
  });
});
