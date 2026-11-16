import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, persistir } from '../../../stores/appStore';

/**
 * Gravacao que falha precisa ser visivel.
 *
 * O codigo tinha 13 pontos com `.catch(() => {})`. Como a interface
 * atualiza de forma otimista, a falha ficava invisivel: a anotacao sumia
 * da tela, a exclusao falhava no servidor, e ela reaparecia sozinha no
 * proximo carregamento. O aluno concluia que tinha apagado.
 *
 * `persistir` existe para que isso nao volte a acontecer em silencio.
 */

const esperarMicrotarefas = () => new Promise((r) => setTimeout(r, 0));

describe('persistir', () => {
  beforeEach(() => {
    useAppStore.getState().clearToast();
  });

  it('nao incomoda quando a gravacao da certo', async () => {
    const desfazer = vi.fn();
    persistir(Promise.resolve('ok'), { aoFalhar: desfazer });
    await esperarMicrotarefas();

    expect(desfazer).not.toHaveBeenCalled();
    expect(useAppStore.getState().toastMessage).toBeNull();
  });

  it('avisa o aluno quando a gravacao falha', async () => {
    persistir(Promise.reject(new Error('sem rede')));
    await esperarMicrotarefas();

    const s = useAppStore.getState();
    expect(s.toastMessage).toBeTruthy();
    expect(s.toastType).toBe('error');
  });

  it('desfaz a alteracao otimista, para a tela parar de mentir', async () => {
    // Sem o desfazer, o aviso apareceria mas a anotacao continuaria sumida
    // da tela ate o proximo carregamento: metade da correcao.
    const desfazer = vi.fn();
    persistir(Promise.reject(new Error('recusado')), { aoFalhar: desfazer });
    await esperarMicrotarefas();

    expect(desfazer).toHaveBeenCalledOnce();
  });

  it('usa a mensagem especifica quando o chamador da uma', async () => {
    persistir(Promise.reject(new Error('x')), {
      mensagem: 'Não foi possível apagar a anotação. Ela continua no seu caderno.',
    });
    await esperarMicrotarefas();

    expect(useAppStore.getState().toastMessage).toContain('continua no seu caderno');
  });

  it('nao deixa a rejeicao escapar como erro nao tratado', async () => {
    // Um `unhandledrejection` derrubaria o log de erros do navegador com
    // ruido a cada oscilacao de rede.
    const aoEscapar = vi.fn();
    process.on('unhandledRejection', aoEscapar);
    persistir(Promise.reject(new Error('sem rede')));
    await esperarMicrotarefas();
    process.off('unhandledRejection', aoEscapar);

    expect(aoEscapar).not.toHaveBeenCalled();
  });
});
