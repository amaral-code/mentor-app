import { reportarErro } from '@mentor/core/monitoramento';
import { idAnonimo, montarCaptura, podeRastrear, type NomeEvento } from '@mentor/core/analytics';
import { ambienteDoApp, posthogHost, posthogKey, sentryDsn } from '@mentor/core/runtimeConfig';
import { safeGet, safeSet } from '@mentor/core/safeStorage';
import { useAppStore } from '@mentor/state/appStore';

/**
 * Monitoramento de erros (#65) e analytics (#66) no app web.
 * As regras (o que sai, quando sai, sem dado pessoal) moram no núcleo.
 */

const VERSAO = (import.meta.env.VITE_VERSAO as string | undefined) || 'web';

export function reportar(erro: unknown, area: string): void {
  void reportarErro(sentryDsn(), erro, {
    plataforma: 'web',
    versao: VERSAO,
    ambiente: ambienteDoApp(),
    tags: { area, aba: useAppStore.getState().activeTab, papel: useAppStore.getState().userRole },
  });
}

/** Erros soltos (fora de qualquer tela) e promessas rejeitadas sem dono. */
export function iniciarMonitoramento(): void {
  window.addEventListener('error', (e) => reportar(e.error ?? e.message, 'janela'));
  window.addEventListener('unhandledrejection', (e) => reportar(e.reason, 'promessa'));
}

const CHAVE_CONSENTIMENTO = 'mm_analytics_consentimento';

export const consentiuAnalytics = (): boolean => safeGet(CHAVE_CONSENTIMENTO) === 'sim';
export function definirConsentimentoAnalytics(sim: boolean): void {
  safeSet(CHAVE_CONSENTIMENTO, sim ? 'sim' : 'nao');
}

/** Envia um evento do plano, se (e só se) as regras do núcleo deixarem. */
export function rastrear(nome: NomeEvento, props: Record<string, unknown> = {}): void {
  const session = useAppStore.getState().session;
  if (!session) return;
  if (!podeRastrear({ chaveConfigurada: !!posthogKey(), consentiu: consentiuAnalytics(), dataNascimento: session.dataNascimento })) return;
  void (async () => {
    try {
      const corpo = montarCaptura({ chave: posthogKey(), host: posthogHost() }, nome, await idAnonimo(session.uid), props);
      await fetch(`${posthogHost()}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        keepalive: true,
      });
    } catch {
      /* analytics nunca atrapalha o uso */
    }
  })();
}
