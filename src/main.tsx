import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { aplicarAcessibilidade } from './shared/lib/acessibilidade';

// Acessibilidade antes da primeira pintura: fonte, contraste, movimento
// e daltonismo valem já no login, sem sessão.
aplicarAcessibilidade();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
