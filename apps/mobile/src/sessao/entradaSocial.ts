import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getSupabase } from '@mentor/api/supabase';
import { credencialDoLink, emailValido } from '@mentor/core/linkDeEntrada';

/*
 * Entradas sem senha: link no e-mail, Google e Apple.
 *
 * Todas voltam ao app pelo mesmo endereço (midnightmentor://entrar no
 * celular, /entrar no navegador), e o que veio nele vira sessão em
 * `concluirPeloLink`. No painel do Supabase, em Authentication > URL
 * Configuration, esse endereço precisa estar em "Redirect URLs", e
 * Google e Apple precisam estar ligados em Providers.
 */
export const enderecoDeVolta = (): string => Linking.createURL('/entrar');

WebBrowser.maybeCompleteAuthSession();

export async function concluirPeloLink(url: string | null): Promise<string | null> {
  const sb = getSupabase();
  const c = credencialDoLink(url);
  if (!sb || c.tipo === 'nada') return null;
  if (c.tipo === 'erro') return c.mensagem;
  const { error } =
    c.tipo === 'codigo'
      ? await sb.auth.exchangeCodeForSession(c.codigo)
      : await sb.auth.setSession({ access_token: c.accessToken, refresh_token: c.refreshToken });
  return error ? 'O link expirou ou já foi usado. Peça outro.' : null;
}

/** Ouve o link que abre o app (frio ou quente) e transforma em sessão. */
export function ouvirLinksDeEntrada(aoErro: (m: string) => void): () => void {
  // No navegador o próprio supabase-js lê a URL (detectSessionInUrl): trocar
  // o código aqui também gastaria o código duas vezes.
  if (Platform.OS === 'web') return () => {};
  void Linking.getInitialURL().then((u) => concluirPeloLink(u).then((e) => e && aoErro(e)));
  const sub = Linking.addEventListener('url', ({ url }) => void concluirPeloLink(url).then((e) => e && aoErro(e)));
  return () => sub.remove();
}

/**
 * Renovação do token só com o app na frente (recomendação do Supabase
 * para React Native): em segundo plano o timer do JS para, e a renovação
 * acontece na volta. Offline, a sessão do cofre continua valendo e o
 * token é renovado quando a rede voltar.
 */
export function renovarSessaoComOApp(): () => void {
  const sb = getSupabase();
  if (!sb || Platform.OS === 'web') return () => {};
  void sb.auth.startAutoRefresh();
  const sub = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') void sb.auth.startAutoRefresh();
    else void sb.auth.stopAutoRefresh();
  });
  return () => sub.remove();
}

/**
 * Link de entrada no e-mail. Só para conta que já existe: quem cria conta
 * de aluno é a matrícula (ou o cadastro com senha), e um link que cria
 * conta seria um cadastro sem os termos.
 */
export async function pedirLinkNoEmail(email: string): Promise<string | null> {
  if (!emailValido(email)) return 'Digite um e-mail válido.';
  const sb = getSupabase();
  if (!sb) return 'Sem conexão com o servidor.';
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: enderecoDeVolta(), shouldCreateUser: false },
  });
  // Mensagem igual com ou sem conta: dizer "não existe" entrega quem é aluno.
  return error && !/not found|signups not allowed/i.test(error.message) ? 'Não foi possível enviar agora. Tente de novo.' : null;
}

/** Google (e Apple fora do iOS) pelo navegador do sistema. */
export async function entrarComProvedor(provedor: 'google' | 'apple'): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'Sem conexão com o servidor.';
  const volta = enderecoDeVolta();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: provedor,
    options: { redirectTo: volta, skipBrowserRedirect: Platform.OS !== 'web' },
  });
  if (error || !data.url) return 'Este jeito de entrar ainda não está ligado. Use e-mail e senha.';
  if (Platform.OS === 'web') return null; // o navegador já foi redirecionado
  const r = await WebBrowser.openAuthSessionAsync(data.url, volta);
  if (r.type !== 'success') return null; // a pessoa fechou: não é erro
  return concluirPeloLink(r.url);
}
