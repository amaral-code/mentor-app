/**
 * Monitoramento de erros (issue #65), no formato do Sentry, sem o SDK.
 *
 * POR QUE SEM O SDK
 * O SDK do navegador pesa dezenas de kB no primeiro carregamento, e o
 * público usa Android de entrada em rede móvel (#67). O que o app precisa
 * é pouco: o erro, a pilha e onde aconteceu. O envelope do Sentry é um
 * formato aberto e simples; este módulo monta e envia.
 *
 * DADO PESSOAL NUNCA SAI (exigência da issue e da LGPD)
 * Mensagem e pilha passam por `limparPii` antes de qualquer envio:
 * e-mail, token JWT, CPF, telefone e UUID viram marcadores. Não vai
 * usuário, IP, texto digitado nem conversa: o Mentor e o caderno são
 * conteúdo do aluno, não diagnóstico de erro.
 *
 * Desligado sem `SENTRY_DSN` (variável pública, entregue pelo /api/config).
 */

export interface Dsn {
  chavePublica: string;
  host: string;
  projeto: string;
  protocolo: string;
}

export function lerDsn(dsn: string | undefined | null): Dsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn.trim());
    const projeto = u.pathname.replace(/^\/+/, '');
    if (!u.username || !/^\d+$/.test(projeto)) return null;
    return { chavePublica: u.username, host: u.host, projeto, protocolo: u.protocol.replace(':', '') };
  } catch {
    return null;
  }
}

const PADROES_PII: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '[token]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]'],
  [/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/([?&](?:key|token|access_token|apikey|secret)=)[^&\s]+/gi, '$1[oculto]'],
];

export function limparPii(texto: string): string {
  let t = String(texto ?? '');
  for (const [re, troca] of PADROES_PII) t = t.replace(re, troca);
  return t.slice(0, 8000);
}

export interface ContextoErro {
  /** Onde: 'web', 'worker'. */
  plataforma: string;
  /** Versão do app (hash do build, por exemplo). */
  versao?: string;
  /** Ambiente: production, preview, development. */
  ambiente?: string;
  /** Rótulos curtos e não pessoais: tela, rota, papel. */
  tags?: Record<string, string>;
}

/** Envelope do Sentry: cabeçalho, cabeçalho do item e o evento, um por linha. */
export function montarEnvelope(dsn: Dsn, erro: unknown, ctx: ContextoErro, agora = new Date()): string {
  const e = erro instanceof Error ? erro : new Error(String(erro));
  const idEvento = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx.tags ?? {})) tags[k.slice(0, 32)] = limparPii(v).slice(0, 200);
  const evento = {
    event_id: idEvento,
    timestamp: agora.getTime() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: ctx.ambiente ?? 'production',
    release: ctx.versao,
    tags: { ...tags, plataforma: ctx.plataforma },
    exception: {
      values: [{ type: limparPii(e.name || 'Error'), value: limparPii(e.message || ''), stacktrace: e.stack ? { frames: quadros(e.stack) } : undefined }],
    },
  };
  return [
    JSON.stringify({ event_id: idEvento, sent_at: agora.toISOString(), dsn: `${dsn.protocolo}://${dsn.chavePublica}@${dsn.host}/${dsn.projeto}` }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(evento),
  ].join('\n');
}

/** Converte a pilha em quadros do Sentry (o mais recente por último). */
function quadros(pilha: string) {
  return limparPii(pilha)
    .split('\n')
    .slice(0, 40)
    .map((linha) => {
      const m = linha.trim().match(/(?:at\s+)?(.*?)\s*\(?((?:https?:\/\/|\/)[^\s)]+?):(\d+):(\d+)\)?\s*$/);
      return m ? { function: m[1] || '?', filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: !/node_modules/.test(m[2]) } : null;
    })
    .filter(Boolean)
    .reverse();
}

export function urlDeEnvio(dsn: Dsn): string {
  return `${dsn.protocolo}://${dsn.host}/api/${dsn.projeto}/envelope/?sentry_key=${dsn.chavePublica}&sentry_version=7`;
}

/* Evita inundar a cota: o mesmo erro só vai uma vez por minuto. */
const recentes = new Map<string, number>();
export function deveEnviar(erro: unknown, agora = Date.now()): boolean {
  const chave = erro instanceof Error ? `${erro.name}:${erro.message}` : String(erro);
  const ultimo = recentes.get(chave);
  if (ultimo !== undefined && agora - ultimo < 60_000) return false;
  recentes.set(chave, agora);
  if (recentes.size > 200) recentes.clear();
  return true;
}

/** Envia sem nunca jogar: monitorar não pode virar outro erro. */
export async function reportarErro(dsnTexto: string | undefined | null, erro: unknown, ctx: ContextoErro): Promise<void> {
  const dsn = lerDsn(dsnTexto);
  if (!dsn || !deveEnviar(erro)) return;
  try {
    await fetch(urlDeEnvio(dsn), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: montarEnvelope(dsn, erro, ctx),
      keepalive: true,
    });
  } catch {
    /* sem rede: o erro se perde, e tudo bem */
  }
}
