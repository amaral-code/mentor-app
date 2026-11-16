import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { aplicarAcessibilidade } from './shared/lib/acessibilidade';
import { carregarConfigRuntime } from './shared/lib/runtimeConfig';
import { registrarPWA } from './pwa';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';

// Acessibilidade antes da primeira pintura: fonte, contraste, movimento
// e daltonismo valem já no login, sem sessão.
aplicarAcessibilidade();

// Service Worker do App Shell (no-op em `vite dev`, ativo no build).
registrarPWA();

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
