import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { aplicarAcessibilidade } from './shared/lib/acessibilidade';
import { registrarPWA } from './pwa';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';

// Acessibilidade antes da primeira pintura: fonte, contraste, movimento
// e daltonismo valem já no login, sem sessão.
aplicarAcessibilidade();

// Service Worker do App Shell (no-op em `vite dev`, ativo no build).
registrarPWA();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Ultima rede: excecao nao tratada em qualquer lugar cai aqui, numa
        tela amigavel com recarga — nunca tela branca fatal. */}
    <ErrorBoundary nome="raiz">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
