import { describe, expect, it } from 'vitest';
import { cabecalhoVapid, cifrarParaInscricao, deBase64Url, paraBase64Url } from '../webPush.js';

/*
 * A prova de que a cifra está certa é DECIFRAR do lado do navegador,
 * seguindo a RFC 8291 de forma independente da implementação.
 */
const enc = new TextEncoder();

async function hmac(chave, dados) {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dados));
}
const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const hk = async (sal, ikm, info, n) => (await hmac(await hmac(sal, ikm), cat(info, new Uint8Array([1])))).slice(0, n);

async function navegador() {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { par, inscricao: { p256dh: paraBase64Url(pub), auth: paraBase64Url(auth), endpoint: 'https://push.exemplo/x' }, pub, auth };
}

async function decifrar(corpo, nav) {
  const sal = corpo.slice(0, 16);
  const idlen = corpo[20];
  const asPub = corpo.slice(21, 21 + idlen);
  const cifrado = corpo.slice(21 + idlen);
  const asChave = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asChave }, nav.par.privateKey, 256));
  const ikm = await hk(nav.auth, ecdh, cat(enc.encode('WebPush: info\0'), nav.pub, asPub), 32);
  const cek = await hk(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cifrado));
  expect(claro[claro.length - 1]).toBe(2);
  return new TextDecoder().decode(claro.slice(0, -1));
}

describe('Web Push', () => {
  it('o navegador decifra o que o servidor cifrou', async () => {
    const nav = await navegador();
    const corpo = await cifrarParaInscricao(JSON.stringify({ titulo: 'Hora de revisar', url: '/?aba=calendario' }), nav.inscricao);
    expect(new DataView(corpo.buffer).getUint32(16)).toBe(4096);
    expect(JSON.parse(await decifrar(corpo, nav))).toEqual({ titulo: 'Hora de revisar', url: '/?aba=calendario' });
  });

  it('o JWT do VAPID é verificável com a chave pública', async () => {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
    const env = { VAPID_PUBLIC_KEY: paraBase64Url(pub), VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', par.privateKey)).d, VAPID_SUBJECT: 'mailto:a@b.c' };
    const cab = await cabecalhoVapid('https://fcm.googleapis.com/fcm/send/abc', env, 1_700_000_000_000);
    const [, jwt, k] = cab.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(k).toBe(env.VAPID_PUBLIC_KEY);
    const [h, c, s] = jwt.split('.');
    const payload = JSON.parse(new TextDecoder().decode(deBase64Url(c)));
    expect(payload).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'mailto:a@b.c', exp: 1_700_000_000 + 12 * 3600 });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, par.publicKey, deBase64Url(s), enc.encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});
