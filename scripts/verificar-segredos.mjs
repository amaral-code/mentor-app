#!/usr/bin/env node
/**
 * Falha se algum arquivo versionado contiver algo com cara de segredo.
 * Roda no CI e pode rodar localmente: `npm run check:secrets`.
 *
 * Complementa (não substitui) o secret scanning do GitHub.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** JWTs com papel diferente de `anon` (a anon é pública por design; a service_role ignora a RLS). */
function jwtsPerigosos(texto) {
  const papeis = [];
  for (const [, payload] of texto.matchAll(/eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g)) {
    try {
      const { role } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (role && role !== 'anon' && role !== 'authenticated') papeis.push(role);
    } catch {
      // não é JSON: não é JWT de verdade
    }
  }
  return papeis;
}

const PADROES = [
  { nome: 'Chave secreta do Supabase (sb_secret_)', re: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { nome: 'Chave de API estilo OpenAI/DeepSeek', re: /\bsk-[A-Za-z0-9]{24,}\b/ },
  { nome: 'Chave de API do Google', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { nome: 'Token do GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { nome: 'Chave privada', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

// Arquivos binários e o lockfile ficam de fora.
const IGNORAR = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|mp3|wav|zip)$|package-lock\.json$/i;

const arquivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !IGNORAR.test(f));

const achados = [];
for (const arquivo of arquivos) {
  let texto;
  try {
    texto = readFileSync(arquivo, 'utf8');
  } catch {
    continue; // removido do disco mas ainda no índice
  }
  // Junta strings partidas com '...' + '...' para pegar chaves quebradas em linhas.
  const colado = texto.replace(/['"`]\s*\+\s*['"`]/g, '');
  for (const papel of new Set(jwtsPerigosos(colado))) {
    achados.push(`${arquivo}: JWT do Supabase com papel "${papel}"`);
  }
  for (const { nome, re } of PADROES) {
    if (re.test(colado)) achados.push(`${arquivo}: ${nome}`);
  }
}

if (achados.length) {
  console.error('Possíveis segredos encontrados em arquivos versionados:\n');
  for (const a of achados) console.error(`  - ${a}`);
  console.error('\nMova o valor para o .env (gitignored) ou para `wrangler secret put` e gire a chave.');
  process.exit(1);
}
console.log(`Nenhum segredo encontrado em ${arquivos.length} arquivos.`);
