/**
 * O que veio no link que abriu o app depois do login por e-mail ou por
 * Google/Apple (deep link `midnightmentor://entrar?...`).
 *
 * Três formatos, conforme o fluxo do Supabase:
 *   ?code=...                         PKCE (o do celular): troca pelo código
 *   #access_token=...&refresh_token=  implícito (links antigos)
 *   ?error=...&error_description=...  o provedor recusou
 * Função pura: testada sem aparelho, sem rede.
 */
export type CredencialDoLink =
  | { tipo: 'codigo'; codigo: string }
  | { tipo: 'tokens'; accessToken: string; refreshToken: string }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'nada' };

function parametros(trecho: string): URLSearchParams {
  return new URLSearchParams(trecho.replace(/^[?#]/, ''));
}

export function credencialDoLink(url: string | null | undefined): CredencialDoLink {
  if (!url) return { tipo: 'nada' };
  const iConsulta = url.indexOf('?');
  const iFragmento = url.indexOf('#');
  const consulta = iConsulta >= 0 ? parametros(url.slice(iConsulta, iFragmento > iConsulta ? iFragmento : undefined)) : new URLSearchParams();
  const fragmento = iFragmento >= 0 ? parametros(url.slice(iFragmento)) : new URLSearchParams();
  const ler = (k: string) => consulta.get(k) ?? fragmento.get(k);

  const erro = ler('error_description') ?? ler('error');
  if (erro) {
    return {
      tipo: 'erro',
      mensagem: /expired|invalid/i.test(erro) ? 'O link expirou ou já foi usado. Peça outro.' : 'Não foi possível entrar por este link.',
    };
  }
  const codigo = ler('code');
  if (codigo) return { tipo: 'codigo', codigo };
  const accessToken = ler('access_token');
  const refreshToken = ler('refresh_token');
  if (accessToken && refreshToken) return { tipo: 'tokens', accessToken, refreshToken };
  return { tipo: 'nada' };
}

/** E-mail com cara de e-mail (o servidor confere de verdade). */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
