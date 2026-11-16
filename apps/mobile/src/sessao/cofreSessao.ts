import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';
import { emPedacos } from '../lib/pedacos';

/**
 * Onde o Supabase guarda a sessão no celular: o cofre do sistema
 * (Keychain no iOS, Keystore no Android), em pedaços.
 *
 * No web devolve `undefined` e o supabase-js usa o localStorage, como no
 * app Vite. Não existe sessão em armazenamento comum no celular: o
 * mesmo motivo que tirou a sessão do localStorage no web (dava para virar
 * outro papel editando o valor) vale aqui para backup e root.
 */
export function cofreDaSessao(): SupportedStorage | undefined {
  if (Platform.OS === 'web') return undefined;
  return emPedacos({
    getItem: (k) => SecureStore.getItemAsync(k),
    setItem: (k, v) => SecureStore.setItemAsync(k, v),
    removeItem: (k) => SecureStore.deleteItemAsync(k),
  });
}
