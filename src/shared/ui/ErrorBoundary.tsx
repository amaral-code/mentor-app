import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Identifica o trecho no log (ex.: "raiz", "chat", "login"). */
  nome: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  erro: Error | null;
}

/**
 * Limite de erro global por trecho.
 *
 * Sem isto, qualquer excecao em render (dado inesperado do banco, sprite
 * corrompido, conta quebrada) derrubava o React inteiro numa TELA BRANCA
 * fatal — no celular do jurado, sem console, sem volta. Aqui o trecho
 * afetado mostra um fallback amigavel com recarga, e o resto do app
 * (abas ja montadas acima do limite) continua vivo.
 *
 * Onde e usado (App.tsx + main.tsx): raiz, login, troca de senha e cada
 * perfil (aluno/educador/responsaveis/psicologo). Erro no chat nao mata o
 * login, e vice-versa.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { erro: null };

  static getDerivedStateFromError(erro: Error): ErrorBoundaryState {
    return { erro };
  }

  componentDidCatch(erro: Error, info: { componentStack?: string }): void {
    console.error(`[boundary:${this.props.nome}]`, erro, info.componentStack);
  }

  private tentarDeNovo = (): void => {
    this.setState({ erro: null });
  };

  private recarregar = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.erro) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ background: '#0b1120' }}
          role="alert"
        >
          <div className="w-full max-w-sm glass rounded-2xl p-7 text-center animate-fade-up">
            <img
              src="/assets/sagui_meditando_2.png"
              alt=""
              width={96}
              height={96}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="w-24 h-24 object-contain mx-auto mb-4"
            />
            <h1 className="text-lg font-extrabold text-white">
              O sagui tropeçou aqui
            </h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Esta parte travou, mas seus dados estão salvos. Recarregue para
              voltar ao normal.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <button onClick={this.recarregar} className="btn-primary w-full h-12">
                Recarregar o app
              </button>
              <button onClick={this.tentarDeNovo} className="btn-secondary w-full">
                Tentar de novo sem recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
