// Gera um par de chaves VAPID para o Web Push (issue #55).
//   node scripts/gerar-vapid.mjs
// A pública vai em VAPID_PUBLIC_KEY (pode aparecer no app).
// A privada vai em VAPID_PRIVATE_KEY: SEGREDO, só nas Environment Variables.
import { paraBase64Url } from '../server/webPush.js';

const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);

console.log(`VAPID_PUBLIC_KEY=${paraBase64Url(publica)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log('VAPID_SUBJECT=mailto:seu-contato@seu-dominio');
