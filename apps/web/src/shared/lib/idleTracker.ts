/**
 * INTERVENCAO DE DOOMSCROLLING ACADEMICO - rastreio de ociosidade.
 *
 * O sintoma que se quer pegar nao e "parado": e ROLANDO SEM DECIDIR. A
 * pessoa desce e sobe os menus, abre e fecha materias, e nao comeca
 * nada. Isso e paralisia por analise, e ela nao aparece em nenhuma
 * metrica de engajamento tradicional - pelo contrario, parece uso.
 *
 * COMO SE DISTINGUE DE "SO SAIU DA MESA"
 * Tres condicoes precisam valer ao mesmo tempo:
 *   1. passaram-se 2 minutos desde o inicio da janela;
 *   2. houve movimento continuo (rolagem/toque acima de um minimo);
 *   3. NENHUMA acao de compromisso no periodo - clicar num botao, abrir
 *      um quiz, enviar uma mensagem.
 *
 * A condicao 2 exclui quem largou o celular na mesa (nao rolaria nada) e
 * a 3 exclui quem esta lendo um texto longo com atencao (essa pessoa
 * clica em algo em algum momento). Sem as duas, a intervencao viraria um
 * pop-up aleatorio - o pior resultado possivel para um app que se propoe
 * a reduzir ansiedade.
 *
 * COOLDOWN: uma intervencao a cada 15 minutos, no maximo. Ser
 * interrompido duas vezes seguidas e mais irritante que o problema.
 */

import {
  CONFIG_PADRAO,
  avaliarOciosidade,
  estadoInicial,
  type AvaliacaoOciosidade,
  type ConfigOciosidade,
  type EstadoOciosidade,
} from '@mentor/core/ociosidade';

/* A regra (estado, avaliação, sugestão) mora no @mentor/core: o celular usa
   a mesma, com toque no lugar de rolagem de janela. Aqui fica só o DOM. */
export { CONFIG_PADRAO, avaliarOciosidade, estadoInicial, sugestaoLocal } from '@mentor/core/ociosidade';
export type { AvaliacaoOciosidade, ConfigOciosidade, EstadoOciosidade } from '@mentor/core/ociosidade';

export function ehAcaoDecisiva(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof Element)) return false;
  return !!alvo.closest('button, a, input, select, textarea, [role="button"], [role="tab"], label');
}

export interface RastreadorOciosidade {
  parar: () => void;
  /** Zera a janela - chamado quando a intervencao e exibida ou aceita. */
  reiniciar: () => void;
  estado: () => EstadoOciosidade;
}

/**
 * Liga o rastreio na janela do navegador.
 *
 * Os listeners sao passivos: nenhum deles bloqueia a rolagem. O timer
 * roda a cada 5 s (nao a cada evento) para nao gastar bateria avaliando
 * a cada pixel rolado.
 */
export function criarRastreadorOciosidade(
  aoDetectar: (avaliacao: AvaliacaoOciosidade) => void,
  cfg: ConfigOciosidade = CONFIG_PADRAO,
): RastreadorOciosidade {
  let estado = estadoInicial();

  const marcarNavegacao = () => {
    estado.ultimaInteracao = Date.now();
    estado.eventosNavegacao += 1;
  };

  const marcarDecisao = (e: Event) => {
    if (!ehAcaoDecisiva(e.target)) return;
    estado = { ...estadoInicial(Date.now()), ultimaIntervencao: estado.ultimaIntervencao };
  };

  const aoTeclar = (e: KeyboardEvent) => {
    // Digitar E decidir: quem escreve no chat nao esta vagando.
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab') {
      estado = { ...estadoInicial(Date.now()), ultimaIntervencao: estado.ultimaIntervencao };
    }
  };

  const aoTrocarVisibilidade = () => {
    if (document.visibilityState === 'visible') {
      estado = { ...estadoInicial(Date.now()), ultimaIntervencao: estado.ultimaIntervencao };
    }
  };

  const opcoes: AddEventListenerOptions = { passive: true };
  window.addEventListener('scroll', marcarNavegacao, opcoes);
  window.addEventListener('wheel', marcarNavegacao, opcoes);
  window.addEventListener('touchmove', marcarNavegacao, opcoes);
  window.addEventListener('pointermove', marcarNavegacao, opcoes);
  window.addEventListener('click', marcarDecisao, true);
  window.addEventListener('keydown', aoTeclar, true);
  document.addEventListener('visibilitychange', aoTrocarVisibilidade);

  const timer = window.setInterval(() => {
    const avaliacao = avaliarOciosidade(estado, Date.now(), cfg);
    if (avaliacao.deveIntervir) {
      estado.ultimaIntervencao = Date.now();
      estado.inicioJanela = Date.now();
      estado.eventosNavegacao = 0;
      aoDetectar(avaliacao);
    }
  }, 5000);

  return {
    parar: () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', marcarNavegacao);
      window.removeEventListener('wheel', marcarNavegacao);
      window.removeEventListener('touchmove', marcarNavegacao);
      window.removeEventListener('pointermove', marcarNavegacao);
      window.removeEventListener('click', marcarDecisao, true);
      window.removeEventListener('keydown', aoTeclar, true);
      document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
    },
    reiniciar: () => {
      estado = { ...estadoInicial(Date.now()), ultimaIntervencao: estado.ultimaIntervencao };
    },
    estado: () => ({ ...estado }),
  };
}

/**
 * Sugestao de fallback quando a IA nao responde.
 *
 * Precisa ser CURTA e conter uma acao unica. Uma lista de opcoes num
 * momento de paralisia por analise e exatamente o problema outra vez.
 */
