import { describe, expect, it } from 'vitest';
import { deveEnviar, lerDsn, limparPii, montarEnvelope, urlDeEnvio } from '../monitoramento';

describe('monitoramento de erros', () => {
  const dsn = lerDsn('https://abc123@o1.ingest.sentry.io/4500')!;

  it('lê o DSN e monta o endereço de envio', () => {
    expect(dsn).toEqual({ chavePublica: 'abc123', host: 'o1.ingest.sentry.io', projeto: '4500', protocolo: 'https' });
    expect(urlDeEnvio(dsn)).toBe('https://o1.ingest.sentry.io/api/4500/envelope/?sentry_key=abc123&sentry_version=7');
    expect(lerDsn('')).toBeNull();
    expect(lerDsn('lixo')).toBeNull();
  });

  it('dado pessoal nunca sai: e-mail, token, CPF, telefone, id e chave em URL', () => {
    const t = limparPii(
      'falhou para ana@escola.com.br com eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.assinatura cpf 123.456.789-09 tel (11) 98765-4321 id 0f8c1e2a-1234-4abc-9def-0123456789ab em /x?key=SEGREDO&y=1',
    );
    for (const proibido of ['ana@', 'eyJ', '123.456', '98765', '0f8c1e2a', 'SEGREDO']) expect(t).not.toContain(proibido);
    expect(t).toContain('[email]');
    expect(t).toContain('key=[oculto]');
  });

  it('o envelope leva o erro com a pilha, já limpa', () => {
    const erro = new Error('Sessão de ana@x.com expirou');
    erro.stack = 'Error: Sessão de ana@x.com expirou\n    at carregar (https://app.mentor/assets/index-abc.js:10:5)';
    const [cab, item, evento] = montarEnvelope(dsn, erro, { plataforma: 'web', tags: { tela: 'quiz' } }).split('\n').map((l) => JSON.parse(l));
    expect(cab.dsn).toBe('https://abc123@o1.ingest.sentry.io/4500');
    expect(item.type).toBe('event');
    expect(evento.exception.values[0].value).toBe('Sessão de [email] expirou');
    expect(evento.exception.values[0].stacktrace.frames[0]).toMatchObject({ function: 'carregar', lineno: 10, colno: 5 });
    expect(evento.tags).toEqual({ tela: 'quiz', plataforma: 'web' });
    expect(JSON.stringify(evento)).not.toContain('ana@');
  });

  it('o mesmo erro só vai uma vez por minuto', () => {
    const e = new Error('repetido');
    expect(deveEnviar(e, 1000)).toBe(true);
    expect(deveEnviar(e, 30_000)).toBe(false);
    expect(deveEnviar(e, 62_000)).toBe(true);
  });
});
