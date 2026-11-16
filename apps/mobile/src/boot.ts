/**
 * Primeira coisa que o app executa (importado no topo de app/_layout.tsx).
 *
 * Ordem importa: polyfills antes da plataforma, plataforma antes do
 * cliente Supabase. Nenhum módulo do core lê a plataforma na importação,
 * mas o cliente Supabase guarda as opções na primeira chamada.
 */
import './polyfills';
import './plataforma';
import { Platform } from 'react-native';
import { configurarSupabase } from '@mentor/api/supabase';
import { registrarDescargaAoSair } from '@mentor/state/bemEstarStore';
import { cofreDaSessao } from './sessao/cofreSessao';

configurarSupabase({
  storage: cofreDaSessao(),
  /* No celular não há URL de onde ler o token do link mágico: ele chega
     pelo deep link e é tratado na tela de entrada. No web (Expo Web),
     o comportamento padrão do supabase-js continua valendo. */
  detectSessionInUrl: Platform.OS === 'web',
});

// Telemetria que ainda está no buffer é gravada quando o app vai para o
// segundo plano (no web, quando a aba esconde).
registrarDescargaAoSair();
