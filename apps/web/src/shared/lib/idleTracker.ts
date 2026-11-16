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

export interface ConfigOciosidade {
  /** Tempo de rolagem sem decisao ate intervir. */
  limiarMs: number;
  /** Eventos de rolagem/toque minimos para caracterizar "vagando". */
  minimoEventos: number;
  /** Se a pessoa sumiu por mais que isto, ela saiu - nao e doomscroll. */
  inatividadeMaximaMs: number;
  /** Intervalo minimo entre duas intervencoes. */
  cooldownMs: number;
}

export const CONFIG_PADRAO: ConfigOciosidade = {
  limiarMs: 120_000, // 2 minutos
  minimoEventos: 8,
  inatividadeMaximaMs: 30_000,
  cooldownMs: 15 * 60_000,
};

export interface EstadoOciosidade {
  /** Quando comecou a janela atual (ultima acao de compromisso). */
  inicioJanela: number;
  /** Ultimo sinal de vida (rolagem, toque, movimento). */
  ultimaInteracao: number;
  /** Rolagens/toques desde o inicio da janela. */
  eventosNavegacao: number;
  /** Acoes de compromisso desde o inicio da janela. */
  acoesDecisivas: number;
  /** Quando a ultima intervencao foi mostrada. */
  ultimaIntervencao: number;
}

export function estadoInicial(agora = Date.now()): EstadoOciosidade {
  return {
    inicioJanela: agora,
    ultimaInteracao: agora,
    eventosNavegacao: 0,
    acoesDecisivas: 0,
    ultimaIntervencao: 0,
  };
}

export interface AvaliacaoOciosidade {
  deveIntervir: boolean;
  /** Segundos rolando sem decidir - vai no gatilho salvo no banco. */
  segundosVagando: number;
  eventos: number;
  motivo: 'doomscroll' | 'ativo' | 'ausente' | 'cooldown' | 'cedo';
}

/**
 * Funcao pura: dado o estado acumulado, decide se e hora de intervir.
 * Separada do DOM justamente para poder ser testada sem navegador.
 */
export function avaliarOciosidade(
  estado: EstadoOciosidade,
  agora: number,
  cfg: ConfigOciosidade = CONFIG_PADRAO,
): AvaliacaoOciosidade {
  const decorrido = agora - estado.inicioJanela;
  const base = {
    segundosVagando: Math.round(decorrido / 1000),
    eventos: estado.eventosNavegacao,
  };

  if (estado.acoesDecisivas > 0) return { ...base, deveIntervir: false, motivo: 'ativo' };
  if (agora - estado.ultimaInteracao > cfg.inatividadeMaximaMs)
    return { ...base, deveIntervir: false, motivo: 'ausente' };
  if (decorrido < cfg.limiarMs) return { ...base, deveIntervir: false, motivo: 'cedo' };
  if (estado.eventosNavegacao < cfg.minimoEventos)
    return { ...base, deveIntervir: false, motivo: 'cedo' };
  if (agora - estado.ultimaIntervencao < cfg.cooldownMs)
    return { ...base, deveIntervir: false, motivo: 'cooldown' };

  return { ...base, deveIntervir: true, motivo: 'doomscroll' };
}

/** Um clique so conta como decisao se foi num elemento acionavel. */
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
export function sugestaoLocal(materia: string | null): { titulo: string; convite: string; acao: string } {
  const alvo = materia || 'Biologia';
  return {
    titulo: 'Voce parece na duvida.',
    convite: `Vamos fazer so 3 questoes rapidas de ${alvo} e parar por hoje?`,
    acao: `Comecar 3 de ${alvo}`,
  };
}
