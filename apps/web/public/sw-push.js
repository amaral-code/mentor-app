/*
 * Push do Midnight Mentor (issue #55), carregado pelo service worker do
 * Workbox via `importScripts` (vite.config.ts).
 *
 * O servidor manda { titulo, corpo, url, tipo }. O texto já vem genérico
 * para mensagens ("Você tem uma mensagem nova"): o aviso aparece na tela
 * bloqueada, na frente de quem estiver perto.
 */
self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { titulo: 'Midnight Mentor', corpo: evento.data ? evento.data.text() : '' };
  }
  const url = typeof dados.url === 'string' && dados.url.startsWith('/') ? dados.url : '/';
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Midnight Mentor', {
      body: dados.corpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: dados.tipo || 'mentor',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || '/', self.location.origin).href;
  evento.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const janela of abertas) {
        if (new URL(janela.url).origin === self.location.origin) {
          await janela.focus();
          // O app lê a URL para abrir a aba certa (deep link, #57).
          janela.postMessage({ tipo: 'abrir-url', url: destino });
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
