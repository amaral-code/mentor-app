import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { getSupabase } from '@mentor/api/supabase';
import { entrarComProvedor } from './entradaSocial';

/**
 * Sign in with Apple. No iOS é o botão nativo (a App Store exige quando
 * o app oferece login social); fora dele, o mesmo provedor pelo navegador.
 *
 * O nonce vai em SHA-256 para a Apple e cru para o Supabase, que confere
 * os dois: é o que impede reaproveitar um token de outra entrada.
 */
export async function appleDisponivelNativo(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function entrarComApple(): Promise<string | null> {
  if (!(await appleDisponivelNativo())) return entrarComProvedor('apple');
  const sb = getSupabase();
  if (!sb) return 'Sem conexão com o servidor.';
  const nonce = Crypto.randomUUID();
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hash,
    });
    if (!credencial.identityToken) return 'A Apple não devolveu a identificação. Tente de novo.';
    const { error } = await sb.auth.signInWithIdToken({ provider: 'apple', token: credencial.identityToken, nonce });
    return error ? 'Não foi possível entrar com a Apple agora.' : null;
  } catch (e) {
    // Cancelar a janela da Apple não é erro.
    return (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED' ? null : 'Não foi possível entrar com a Apple agora.';
  }
}
