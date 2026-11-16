import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker.js';
import { criarFiltroFrustracao, criarLeitorSSE } from '../chatStream.js';

/**
 * Streaming do Mentor (#38).
 *
 * O que importa provar: o aluno nunca vê o bloco ```frustracao``` (nem o
 * começo dele, que sem cuidado sairia num pedaço antes de o servidor
 * saber o que era) e o evento final traz a resposta inteira e limpa.
 */

describe('criarFiltroFrustracao', () => {
  it('segura o começo do marcador até saber se é bloco', () => {
    const f = criarFiltroFrustracao();
    expect(f.empurrar('Olá! Tudo certo.\n`')).toBe('Olá! Tudo certo.\n');
    expect(f.empurrar('``fru')).toBe('');
    expect(f.empurrar('stracao\n{"frustration_detected": true}\n```')).toBe('');
    const fim = f.finalizar();
    expect(fim.textoLimpo).toBe('Olá! Tudo certo.');
    expect(fim.frustrationDetected).toBe(true);
  });

  it('crase que não vira bloco é solta no pedaço seguinte', () => {
    const f = criarFiltroFrustracao();
    expect(f.empurrar('Use `')).toBe('Use ');
    expect(f.empurrar('x^2` aqui')).toBe('`x^2` aqui');
  });

  it('juntar os pedaços dá o mesmo texto da rota sem streaming', () => {
    const texto = 'Primeiro passo: isole o x.\n\n```frustracao\n{"frustration_detected": false}\n```';
    const f = criarFiltroFrustracao();
    let montado = '';
    for (const ch of texto) montado += f.empurrar(ch);
    expect(montado.trim()).toBe(f.finalizar().textoLimpo);
    expect(montado).not.toContain('frustracao');
  });
});

describe('criarLeitorSSE', () => {
  it('junta evento cortado no meio entre dois pedaços', () => {
    const l = criarLeitorSSE();
    expect(l.empurrar('data: {"a":')).toEqual([]);
    expect(l.empurrar('1}\n\ndata: {"b":2}\n')).toEqual(['{"a":1}', '{"b":2}']);
    expect(l.finalizar()).toEqual([]);
  });
});

const ENV = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'chave-gemini', GROUNDING_DESLIGADO: '1' };

function sse(eventos) {
  const corpo = eventos.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join('');
  // Corta em pedaços de 7 bytes: o leitor não pode depender de linha inteira.
  const bytes = new TextEncoder().encode(corpo);
  return new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
      c.close();
    },
  });
}

async function eventosDe(resposta) {
  const texto = await resposta.text();
  return texto
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5)));
}

function chamar(corpo, env = ENV) {
  return worker.fetch(
    new Request('https://app.test/api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagens: [{ role: 'user', text: 'oi' }], ...corpo }),
    }),
    env,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('/api/chat/completions com stream', () => {
  it('Gemini: pede streamGenerateContent e repassa os pedaços sem o bloco', async () => {
    const urls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      urls.push(String(url));
      return new Response(
        sse([
          { candidates: [{ content: { parts: [{ text: 'Boa pergunta! ' }] } }] },
          { candidates: [{ content: { parts: [{ text: 'Isole o x.\n```frus' }] } }] },
          { candidates: [{ content: { parts: [{ text: 'tracao\n{"frustration_detected": true}\n```' }] } }] },
        ]),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }));

    const r = await chamar({ stream: true });
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toContain('text/event-stream');
    expect(urls[0]).toContain(':streamGenerateContent?alt=sse');

    const eventos = await eventosDe(r);
    const deltas = eventos.filter((e) => e.tipo === 'delta').map((e) => e.texto).join('');
    expect(deltas).not.toContain('`');
    expect(deltas).toContain('Boa pergunta! Isole o x.');
    const fim = eventos.at(-1);
    expect(fim).toMatchObject({ tipo: 'fim', texto: 'Boa pergunta! Isole o x.', frustrationDetected: true });
  });

  it('DeepSeek: liga stream no upstream e ignora o [DONE]', async () => {
    let enviado;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      enviado = JSON.parse(init.body);
      const corpo = sse([{ choices: [{ delta: { content: 'Olá' } }] }, { choices: [{ delta: { content: ', aluno.' } }] }]);
      return new Response(corpo, { status: 200 });
    }));
    const r = await chamar({ stream: true }, { AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'chave-ds' });
    expect(enviado.stream).toBe(true);
    const eventos = await eventosDe(r);
    expect(eventos.at(-1)).toMatchObject({ tipo: 'fim', texto: 'Olá, aluno.', frustrationDetected: false });
  });

  it('erro do provedor antes do fluxo volta como JSON com o status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('cota estourada', { status: 429 })));
    const r = await chamar({ stream: true });
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ error: 'gemini_falhou' });
  });

  it('sem stream, a rota continua devolvendo o JSON inteiro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'oi' }] } }] }), { status: 200 })));
    const r = await chamar({});
    expect(r.headers.get('Content-Type')).toContain('application/json');
    expect((await r.json()).texto).toBe('oi');
  });
});
