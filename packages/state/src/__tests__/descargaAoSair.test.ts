import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetarPlataforma, configurarPlataforma } from '@mentor/core/plataforma';
import { registrarDescargaAoSair, useBemEstarStore } from '../bemEstarStore';

afterEach(() => {
  _resetarPlataforma();
  vi.restoreAllMocks();
});

/*
 * A store é compartilhada entre web e celular: ela não pode ouvir
 * `visibilitychange` sozinha. Quem avisa que o app foi para segundo
 * plano é a plataforma (web: aba escondida; mobile: AppState).
 */
describe('registrarDescargaAoSair', () => {
  it('registra pela plataforma e devolve quem desfaz', () => {
    const desfazer = vi.fn();
    const aoIrParaSegundoPlano = vi.fn(() => desfazer);
    configurarPlataforma({ aoIrParaSegundoPlano });

    const cancelar = registrarDescargaAoSair();
    expect(aoIrParaSegundoPlano).toHaveBeenCalledTimes(1);
    cancelar();
    expect(desfazer).toHaveBeenCalledTimes(1);
  });

  it('ao sair, descarrega só se houver telemetria no buffer', () => {
    let aoSair = () => {};
    configurarPlataforma({
      aoIrParaSegundoPlano: (cb) => {
        aoSair = cb;
        return () => {};
      },
    });
    const descarregar = vi.fn(async () => {});
    useBemEstarStore.setState({ bufferTelemetria: [], descarregarTelemetria: descarregar });
    registrarDescargaAoSair();

    aoSair();
    expect(descarregar).not.toHaveBeenCalled();

    useBemEstarStore.setState({
      bufferTelemetria: [{} as never],
    });
    aoSair();
    expect(descarregar).toHaveBeenCalledTimes(1);
  });

  it('sem plataforma instalada não registra nada e não quebra', () => {
    expect(() => registrarDescargaAoSair()()).not.toThrow();
  });
});
