/**
 * Configuração compartilhada dos scripts de depuração em tools/.
 *
 * Nenhuma chave fica no código: os scripts leem do ambiente.
 * Use SEMPRE um projeto Supabase de dev/staging, nunca o de produção:
 * a service_role ignora a RLS e os scripts criam e apagam usuários.
 *
 *   SUPABASE_URL=https://<projeto-dev>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service_role do projeto dev> \
 *   node tools/debug_login.mjs http://localhost:5173
 *
 * Ou coloque as duas variáveis no .env local (gitignored) e rode com
 * `node --env-file=.env tools/<script>.mjs`.
 */
import { randomBytes } from 'node:crypto';

function exigir(nome) {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`Defina ${nome} no ambiente (veja tools/_ambiente.mjs).`);
    process.exit(1);
  }
  return valor;
}

export const SUPA = exigir('SUPABASE_URL').replace(/\/+$/, '');
export const SVC = exigir('SUPABASE_SERVICE_KEY');

/** Senha forte e aleatória para os usuários descartáveis criados pelos scripts. */
export const senhaDescartavel = () => `${randomBytes(12).toString('base64url')}Aa1!`;
