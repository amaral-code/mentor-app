import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DEEPSEEK_DEFAULT_MODEL,
  diagnosticarErroRede,
  erroSemBackendDeepSeek,
  extractDeepSeekText,
  fetchDeepSeek,
  geminiGenConfigToDeepSeek,
  mensagemErroRede,
  tipoBackendDeepSeek,
  toChatCompletionsMessages,
} from '../aiProvider';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('aiProvider (DeepSeek-V4-Flash)', () => {
  it('usa o identificador deepseek-v4-flash como padrao', () => {
    expect(DEEPSEEK_DEFAULT_MODEL).toBe('deepseek-v4-flash');
  });

  it('converte systemInstruction + contents em mensagens OpenAI sem perder o prompt', () => {
    const messages = toChatCompletionsMessages(
      { parts: [{ text: 'PAPEL: Prof. Matemática.\n\nESCOPO: voce responde somente sobre matemática.' }] },
      [
        { role: 'user', parts: [{ text: 'Resolva 2x = 8' }] },
        { role: 'model', parts: [{ text: 'x = 4' }] },
      ],
    );

    expect(messages[0]).toEqual({
      role: 'system',
      content: expect.stringContaining('ESCOPO: voce responde somente sobre matemática'),
    });
    expect(messages[1]).toEqual({ role: 'user', content: 'Resolva 2x = 8' });
    // role "model" do Gemini vira "assistant" no chat completions.
    expect(messages[2]).toEqual({ role: 'assistant', content: 'x = 4' });
  });

  it('converte generationConfig em temperature/max_tokens/top_p', () => {
    expect(geminiGenConfigToDeepSeek({ temperature: 0.4, maxOutputTokens: 1024, topP: 0.9 })).toEqual({
      temperature: 0.4,
      max_tokens: 1024,
      top_p: 0.9,
    });
  });

  it('extrai texto do formato choices[].message.content', () => {
    expect(
      extractDeepSeekText({ choices: [{ message: { content: '  OK  ' } }] }),
    ).toBe('  OK  ');
  });

  it('aiService em modo deepseek usa o proxy local same-origin, SEM chave no navegador', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'deepseek');
    vi.stubEnv('VITE_AI_MODEL', 'deepseek-v4-flash');
    vi.stubEnv('VITE_DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
    vi.stubEnv('VITE_AI_BASE_URL', '');
    const { sendMessageToGemini } = await import('../aiService');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'x = 4' } }] }),
      text: async () => 'x = 4',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAppStore } = await import('../../../stores/appStore');
    const matematica = useAppStore.getState().personas.find((p) => p.id === 'prof_matematica')!;
    // Chave do Perfil e ignorada no modo back-end: o servidor autentica.
    const reply = await sendMessageToGemini('Resolva 2x = 8', { apiKey: '', persona: matematica });

    expect(reply).toBe('x = 4');
    const [url, init] = fetchMock.mock.calls[0];
    // Same-origin (sem CORS, sem cross-origin): nunca api.deepseek.com.
    expect(String(url)).toBe('/deepseek-api/chat/completions');
    const corpo = JSON.parse(init.body);
    expect(corpo.model).toBe('deepseek-v4-flash');
    expect(corpo.messages[0].role).toBe('system');
    expect(corpo.messages[0].content).toContain('ESCOPO: voce responde somente sobre');
    expect(corpo.messages.at(-1)).toEqual({ role: 'user', content: 'Resolva 2x = 8' });
    // SEGURANCA: nenhum Authorization sai do navegador (o Vite injeta no servidor).
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(init)).not.toContain('ds-chave');
  });

  it('sem worker e fora do dev, o erro e acionavel (nunca tenta cross-origin)', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'deepseek');
    vi.stubEnv('VITE_AI_MODEL', 'deepseek-v4-flash');
    vi.stubEnv('VITE_AI_BASE_URL', '');
    vi.stubEnv('DEV', false);
    const { sendMessageToGemini } = await import('../aiService');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendMessageToGemini('oi', { apiKey: '' })).rejects.toThrow(/Backend de IA não configurado/);
    // Nenhuma tentativa de rede: nem proxy, nem cross-origin.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('DEV', true);
  });

  it('escolhe worker > proxy local > nenhum (nunca direto cross-origin)', () => {
    expect(tipoBackendDeepSeek(true, true)).toBe('worker');
    expect(tipoBackendDeepSeek(true, false)).toBe('worker');
    expect(tipoBackendDeepSeek(false, true)).toBe('devProxy');
    expect(tipoBackendDeepSeek(false, false)).toBe('nenhum');
    expect(erroSemBackendDeepSeek().message).toContain('DEEPSEEK_API_KEY');
  });

  it('classifica timeout, offline e bloqueio sem expor segredos', () => {
    const timeout = diagnosticarErroRede(
      'https://api.deepseek.com',
      new DOMException('Timeout de 30000ms ao chamar https://api.deepseek.com.', 'TimeoutError'),
      false,
    );
    expect(timeout.tipo).toBe('timeout');
    expect(mensagemErroRede(timeout)).toContain('https://api.deepseek.com');
    expect(mensagemErroRede(timeout)).toContain('30s');

    const bloqueio = diagnosticarErroRede('https://api.deepseek.com', new TypeError('Failed to fetch'), false);
    expect(bloqueio.tipo).toBe('bloqueio_ou_dns');
    expect(mensagemErroRede(bloqueio)).toContain('adblock');
  });

  it('fetchDeepSeek aborta apos o timeout e nunca loga a chave', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej((init.signal as AbortSignal).reason ?? new Error('abort')));
    })));
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await expect(
      fetchDeepSeek('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer CHAVE-SECRETA' },
        body: '{}',
      }, { timeoutMs: 50, contexto: { model: 'deepseek-v4-flash', via: 'teste' } }),
    ).rejects.toThrow(/30|50|timeout/i);

    const logado = JSON.stringify(debug.mock.calls);
    expect(logado).not.toContain('CHAVE-SECRETA');
    expect(logado).toContain('deepseek-v4-flash');
    debug.mockRestore();
  });

  it('aiService em modo deepseek via proxy informa provider ao worker', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'deepseek');
    vi.stubEnv('VITE_AI_MODEL', 'deepseek-v4-flash');
    vi.stubEnv('VITE_AI_BASE_URL', 'https://worker.dev');
    vi.stubEnv('VITE_AI_PROXY_TOKEN', '');
    const { sendMessageToGemini } = await import('../aiService');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessageToGemini('oi', { apiKey: '' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://worker.dev/generate');
    const corpo = JSON.parse(init.body);
    expect(corpo.provider).toBe('deepseek');
    expect(corpo.model).toBe('deepseek-v4-flash');
    // O prompt continua no envelope Gemini para o worker converter.
    expect(corpo.systemInstruction.parts[0].text).toContain('Sagui');
  });
});
