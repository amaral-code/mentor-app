import { describe, expect, it } from 'vitest';
import { limparPii as doServidor } from '../monitoramento.js';
import { limparPii as doNucleo } from '../../packages/core/src/monitoramento.ts';
import worker from '../worker.js';

describe('monitoramento do worker', () => {
  it('limpa dado pessoal exatamente como o núcleo', () => {
    const amostras = [
      'ana@escola.com.br falhou',
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.assinatura',
      'cpf 123.456.789-09 e 12345678909',
      'ligar (11) 98765-4321 ou +55 11 987654321',
      'usuario 0f8c1e2a-1234-4abc-9def-0123456789ab',
      'https://x.googleapis.com/v1?key=SEGREDO&a=1',
    ];
    for (const a of amostras) expect(doServidor(a)).toBe(doNucleo(a));
  });

  it('erro inesperado vira 500 sem vazar detalhe e é reportado ao Sentry', async () => {
    const saidas = [];
    globalThis.fetch = async (url, init) => {
      saidas.push({ url: String(url), body: init?.body });
      if (String(url).includes('/auth/v1/user')) throw new Error('banco caiu para ana@x.com');
      return new Response('{}', { status: 200 });
    };
    const env = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_KEY: 'k', SENTRY_DSN: 'https://chave@o1.ingest.sentry.io/42', GOOGLE_TTS_KEY: 'x' };
    // usuarioDoToken já trata falha de rede; força um erro fora dele:
    const r = await worker.fetch(new Request('https://w.dev/tts', { method: 'POST', headers: { 'X-Supabase-Auth': 'jwt' }, body: '{"texto":"oi"' }), env);
    expect([400, 401, 500]).toContain(r.status);
    const quebrado = { ...env };
    Object.defineProperty(quebrado, 'API_TOKEN', { get() { throw new Error('falha inesperada para ana@x.com'); } });
    const r2 = await worker.fetch(new Request('https://w.dev/generate', { method: 'POST', body: '{}' }), quebrado);
    expect(r2.status).toBe(500);
    expect(await r2.text()).not.toContain('ana@');
    const envio = saidas.find((s) => s.url.includes('ingest.sentry.io/api/42/envelope'));
    expect(envio).toBeDefined();
    expect(envio.body).toContain('[email]');
    expect(envio.body).not.toContain('ana@');
  });
});
