import { base64UrlParaBytes } from '@mentor/core/notificacoes';
import { vapidPublicKey } from '@mentor/core/runtimeConfig';
import { notificacoesRepository } from '@mentor/api/NotificacoesRepository';

/**
 * Inscrição de Web Push neste navegador (#55).
 *
 * No celular nativo (M2) isto vira `expo-notifications`; as preferências
 * e o envio continuam os mesmos, porque moram no banco e no worker.
 */

export type EstadoPush = 'sem-suporte' | 'sem-servidor' | 'bloqueado' | 'desligado' | 'ligado';

export function pushSuportado(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSuportado()) return null;
  // Em `vite dev` não há service worker (injectRegister: false + só no
  // build). Sem registro, não há inscrição possível.
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'sem-suporte';
  if (!vapidPublicKey()) return 'sem-servidor';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await registro();
  const atual = await reg?.pushManager.getSubscription();
  return atual ? 'ligado' : 'desligado';
}

/** Pede permissão, inscreve e grava no banco. Devolve o estado final. */
export async function ligarPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'sem-suporte';
  const chave = vapidPublicKey();
  if (!chave) return 'sem-servidor';
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desligado';
  const reg = await registro();
  if (!reg) return 'sem-suporte';
  const inscricao =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(chave) as BufferSource }));
  const json = inscricao.toJSON();
  const ok = await notificacoesRepository.salvarInscricao({
    endpoint: inscricao.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    userAgent: navigator.userAgent,
  });
  if (!ok) {
    await inscricao.unsubscribe();
    throw new Error('Não foi possível registrar este aparelho. Tente de novo.');
  }
  return 'ligado';
}

export async function desligarPush(): Promise<EstadoPush> {
  const reg = await registro();
  const atual = await reg?.pushManager.getSubscription();
  if (atual) {
    await notificacoesRepository.removerInscricao(atual.endpoint);
    await atual.unsubscribe();
  }
  return 'desligado';
}
