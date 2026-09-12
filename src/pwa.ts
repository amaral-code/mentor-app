import { registerSW } from 'virtual:pwa-register';

/**
 * Registro do Service Worker (vite-plugin-pwa, registerType autoUpdate).
 *
 * - Em `vite dev`: modulo virtual vira no-op (sem SW no desenvolvimento).
 * - Em producao: registra /sw.js; com autoUpdate o SW novo assume
 *   sozinho - este callback so loga, sem popup para o aluno/jurado.
 * - Offline: o App Shell abre do precache; Supabase/Gemini/DeepSeek
 *   estao em Network Only e falham limpo (o app ja trata com toast +
 *   fallbacks locais).
 */
export function registrarPWA(): void {
  try {
    registerSW({ immediate: true });
  } catch (err) {
    console.debug('[pwa] registro indisponivel neste ambiente', err);
  }
}
