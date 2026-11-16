/**
 * Implementação mobile dos adaptadores do @mentor/core.
 *
 * Importada no topo de `app/_layout.tsx`, antes de qualquer tela: os
 * módulos do core leem a plataforma só dentro de funções, então basta que
 * ela esteja instalada antes da primeira chamada.
 */
import { AppState, Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { configurarPlataforma, type ArmazenamentoChaveValor } from '@mentor/core/plataforma';
import { criarArmazenamento } from './armazenamentoLocal';

/*
 * O Expo só troca `process.env.EXPO_PUBLIC_X` pelo valor quando o acesso
 * é ESCRITO assim, por extenso. `process.env[nome]` chega vazio ao
 * aparelho. Por isso a tabela: o core pede o nome do web (`VITE_*`) e
 * aqui ele vira a variável equivalente do Expo, lida de forma estática.
 *
 * Nenhuma destas é segredo. Chave de servidor nunca leva prefixo
 * público, nem aqui (`EXPO_PUBLIC_`) nem no web (`VITE_`).
 */
const ENV_DO_BUILD: Record<string, string | undefined> = {
  VITE_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  VITE_AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER,
  VITE_AI_MODEL: process.env.EXPO_PUBLIC_AI_MODEL,
};

/** Site publicado que serve `/api/*`. No celular não há "mesma origem". */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? '').trim();

let armazenamento: ArmazenamentoChaveValor | null | undefined;

/* NetInfo é assíncrono e o core pergunta de forma síncrona: guardamos o
   último estado conhecido. `null` até a primeira leitura, que o core
   trata como "não sei dizer". */
let online: boolean | null = null;
NetInfo.addEventListener((estado) => {
  online = estado.isConnected ?? null;
});

configurarPlataforma({
  armazenamento: () => {
    if (armazenamento === undefined) {
      try {
        armazenamento = criarArmazenamento();
      } catch {
        armazenamento = null;
      }
    }
    return armazenamento;
  },
  envBuild: (nome) => (ENV_DO_BUILD[nome] ?? '').trim(),
  online: () => online,
  dev: () => __DEV__,
  abrirUrl: (url) => void Linking.openURL(url),
  aoIrParaSegundoPlano: (aoSair) => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'background') aoSair();
    });
    return () => assinatura.remove();
  },
  origemBackend: () => SITE_URL,
});
