/**
 * Web Push sem dependência: VAPID (RFC 8292) + cifra aes128gcm (RFC 8291).
 *
 * POR QUE NÃO A BIBLIOTECA `web-push`
 * O back-end é um arquivo só que roda na Vercel, na Cloudflare e no dev
 * (ver CLAUDE.md). A `web-push` usa o módulo `crypto` do Node e não roda
 * no Worker. Tudo aqui é WebCrypto, que existe nos três.
 *
 * CHAVES
 *   VAPID_PUBLIC_KEY   ponto público P-256 sem compressão (65 bytes), base64url.
 *                      É PÚBLICA: o navegador precisa dela para se inscrever.
 *   VAPID_PRIVATE_KEY  o escalar `d` (32 bytes), base64url. SEGREDO.
 *   VAPID_SUBJECT      `mailto:` ou URL de contato, exigido pelos serviços de push.
 * Para gerar um par: `node scripts/gerar-vapid.mjs`.
 */

const enc = new TextEncoder();

export function deBase64Url(texto) {
  const b64 = String(texto).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function paraBase64Url(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i += 0x8000) bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function juntar(...partes) {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hmac(chave, dados) {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dados));
}

/** HKDF de um passo só (todas as saídas aqui têm até 32 bytes). */
async function hkdf(sal, ikm, info, tamanho) {
  const prk = await hmac(sal, ikm);
  const okm = await hmac(prk, juntar(info, new Uint8Array([1])));
  return okm.slice(0, tamanho);
}

// ---------------------------------------------------------------------
// VAPID
// ---------------------------------------------------------------------

async function chavePrivadaVapid(publica, privada) {
  const pub = deBase64Url(publica);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY inválida');
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: paraBase64Url(pub.slice(1, 33)),
    y: paraBase64Url(pub.slice(33, 65)),
    d: String(privada).trim(),
    ext: true,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** Cabeçalho `Authorization: vapid t=..., k=...` para um endpoint. */
export async function cabecalhoVapid(endpoint, env, agora = Date.now()) {
  const aud = new URL(endpoint).origin;
  const cab = paraBase64Url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = paraBase64Url(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(agora / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:avisos@midnightmentor.app' })),
  );
  const chave = await chavePrivadaVapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  // WebCrypto já devolve r||s (64 bytes), que é o formato do JWS.
  const assinatura = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, enc.encode(`${cab}.${corpo}`)),
  );
  return `vapid t=${cab}.${corpo}.${paraBase64Url(assinatura)}, k=${String(env.VAPID_PUBLIC_KEY).trim()}`;
}

// ---------------------------------------------------------------------
// Cifra (RFC 8291, um único registro)
// ---------------------------------------------------------------------

/**
 * Cifra `texto` para a inscrição `{ p256dh, auth }`.
 * `aleatorio` existe para o teste fixar o sal e a chave efêmera.
 */
export async function cifrarParaInscricao(texto, inscricao, aleatorio = {}) {
  const uaPublica = deBase64Url(inscricao.p256dh);
  const authSecret = deBase64Url(inscricao.auth);
  const sal = aleatorio.sal ?? crypto.getRandomValues(new Uint8Array(16));

  const efemera = aleatorio.efemera ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', efemera.publicKey));
  const uaChave = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, efemera.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, juntar(enc.encode('WebPush: info\0'), uaPublica, asPublica), 32);
  const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // 0x02 marca o último (e único) registro.
  const claro = juntar(enc.encode(texto), new Uint8Array([2]));
  const chave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chave, claro));

  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return juntar(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

/**
 * Envia um push. Devolve `{ ok, status, expirada }`: `expirada` quer dizer
 * que o navegador cancelou a inscrição (404/410) e a linha deve sair do banco.
 */
export async function enviarPush(inscricao, mensagem, env) {
  const corpo = await cifrarParaInscricao(JSON.stringify(mensagem), inscricao);
  const resposta = await fetch(inscricao.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await cabecalhoVapid(inscricao.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: mensagem.urgente ? 'high' : 'normal',
    },
    body: corpo,
  });
  return { ok: resposta.ok, status: resposta.status, expirada: resposta.status === 404 || resposta.status === 410 };
}

export const pushConfigurado = (env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
