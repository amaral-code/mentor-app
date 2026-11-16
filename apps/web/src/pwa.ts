import { registerSW } from 'virtual:pwa-register';

/**
 * Registro do Service Worker (vite-plugin-pwa, registerType autoUpdate).
 *
 * INVÁLIDAÇÃO FORÇADA (nenhum celular preso em cache velho):
 * - `vite.config.ts` fixa `skipWaiting: true` + `clientsClaim: true` +
 *   `cleanupOutdatedCaches: true` — o SW novo assume imediatamente,
 *   toma controle das abas abertas e apaga caches de builds antigos.
 * - `registerType: 'autoUpdate'` dispensa popup de "nova versão".
 * - Este registro soma a checagem periódica: abas abertas por horas (jurado
 *   com o app aberto o dia todo) descobrem o deploy novo sem F5; quando o
 *   SW novo ativa, skipWaiting/clientsClaim aplicam na hora, sem reload
 *   no meio do uso — a troca acontece silenciosa.
 *
 * - Em `vite dev`: modulo virtual vira no-op (sem SW no desenvolvimento).
 * - Offline: o App Shell abre do precache; Supabase/Gemini/DeepSeek
 *   estao em Network Only e falham limpo (o app ja trata com toast +
 *   fallbacks locais).
 */
export function registrarPWA(): void {
  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        // Revalida o SW a cada hora em abas longevas. Falha silenciosa:
        // offline ou sem SW, não há nada a atualizar.
        if (!registration) return;
        window.setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      },
      onRegisterError(err) {
        console.debug('[pwa] registro indisponivel neste ambiente', err);
      },
    });
  } catch (err) {
    console.debug('[pwa] registro indisponivel neste ambiente', err);
  }
}
