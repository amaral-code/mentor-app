// Primeiro de tudo: instala os adaptadores web do @mentor/core
// (localStorage, import.meta.env). Nenhum modulo do core le a plataforma
// na importacao, mas o boot abaixo ja le config e acessibilidade.
import './plataforma/web';
import { interpretarLink } from '@mentor/core/deepLinks';
import { plataforma } from '@mentor/core/plataforma';
import { useAppStore } from '@mentor/state/appStore';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { aplicarAcessibilidade } from './shared/lib/acessibilidade';
import { carregarConfigRuntime } from '@mentor/core/runtimeConfig';
import { registrarPWA } from './pwa';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import { registrarDescargaAoSair } from '@mentor/state/bemEstarStore';
import { iniciarSincronizacao } from '@mentor/state/sincronizacaoStore';

// Acessibilidade antes da primeira pintura: fonte, contraste, movimento
// e daltonismo valem já no login, sem sessão.
aplicarAcessibilidade();

// Service Worker do App Shell (no-op em `vite dev`, ativo no build).
registrarPWA();

// Telemetria de estudo que ainda está no buffer é gravada quando a aba
// esconde. Antes isso era registrado no topo da store; agora a store é
// compartilhada com o celular e quem sabe o que é "sair" é a plataforma.
registrarDescargaAoSair();

// Fila offline (#56): envia o que ficou guardado ao abrir, quando a
// conexão volta e a cada 30 s enquanto houver pendente.
iniciarSincronizacao();

/*
 * Deep links (#57). O endereço de abertura (convite de liga, código de
 * turma, toque numa notificação) vira um destino pendente, aplicado
 * depois do login pelo App. A barra de endereço volta para "/" para o
 * mesmo link não ser reaplicado a cada recarga.
 */
function receberLink(url: string) {
  const destino = interpretarLink(url, plataforma().origem());
  if (!destino) return;
  useAppStore.getState().setLinkPendente(destino);
  if (window.location.pathname !== '/' || window.location.search) window.history.replaceState(null, '', '/' + window.location.hash);
}
receberLink(plataforma().urlInicial());
navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
  if (e.data?.tipo === 'abrir-url' && typeof e.data.url === 'string') receberLink(e.data.url);
});

/*
 * Configuração de runtime ANTES da primeira renderização.
 *
 * `/api/config` devolve as Environment Variables públicas (Supabase,
 * provedor de IA) lidas no servidor a cada requisição. Renderizar antes
 * da resposta faria o app decidir "não tem Supabase" com base no valor
 * congelado no bundle — exatamente o bug que a config de runtime remove.
 *
 * `carregarConfigRuntime` nunca rejeita e tem teto de 6s: sem back-end
 * (build estático puro) o app segue com os valores do build em vez de
 * ficar preso numa tela branca.
 */
carregarConfigRuntime().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {/* Ultima rede: excecao nao tratada em qualquer lugar cai aqui, numa
          tela amigavel com recarga — nunca tela branca fatal. */}
      <ErrorBoundary nome="raiz">
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
});
