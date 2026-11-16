/**
 * Detector de doomscroll: a parte que não depende de tela.
 *
 * O web observa rolagem de janela e clique em botão; o celular observa
 * toque e arrasto. Os dois alimentam o MESMO estado e a MESMA regra de
 * quando intervir (2 minutos rolando sem decidir nada, pelo menos 8
 * gestos, sem intervir de novo por 15 minutos). Morava em
 * apps/web/src/shared/lib/idleTracker.ts; a parte de DOM continua lá.
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
export function sugestaoLocal(materia: string | null): { titulo: string; convite: string; acao: string } {
  const alvo = materia || 'Biologia';
  return {
    titulo: 'Você parece na dúvida.',
    convite: `Vamos fazer só 3 questões rápidas de ${alvo} e parar por hoje?`,
    acao: `Começar 3 de ${alvo}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Toque (celular)                                                     */
/* ------------------------------------------------------------------ */

/** Abaixo disso de deslocamento, o toque foi um toque, não um arrasto. */
export const DESLOCAMENTO_TOQUE = 12;
/** Toque mais longo que isso é segurar, não tocar num botão. */
export const DURACAO_TOQUE_MS = 400;

/**
 * No celular não há "clique num botão" para olhar: o que se vê é o dedo.
 * Toque curto e parado é decisão (abriu algo, respondeu, escreveu);
 * arrastar é navegação (rolar a lista). Rolar 2 minutos sem tocar em
 * nada é o doomscroll que o web pega pela rolagem da janela.
 */
export function criarDetectorDeToque(cfg: ConfigOciosidade = CONFIG_PADRAO, agora: () => number = Date.now) {
  let estado = estadoInicial(agora());
  let inicio: { t: number; x: number; y: number } | null = null;
  let arrastou = false;

  const decidir = () => {
    estado = { ...estadoInicial(agora()), ultimaIntervencao: estado.ultimaIntervencao };
  };

  return {
    tocou(x: number, y: number) {
      inicio = { t: agora(), x, y };
      arrastou = false;
      estado.ultimaInteracao = agora();
    },
    moveu(x: number, y: number) {
      if (!inicio || arrastou) return;
      if (Math.hypot(x - inicio.x, y - inicio.y) > DESLOCAMENTO_TOQUE) {
        // Um arrasto conta UMA vez, não a cada pixel.
        arrastou = true;
        estado.eventosNavegacao += 1;
        estado.ultimaInteracao = agora();
      }
    },
    soltou() {
      if (inicio && !arrastou && agora() - inicio.t <= DURACAO_TOQUE_MS) decidir();
      inicio = null;
    },
    /** Trocar de tela ou digitar também é decidir. */
    decidiu: decidir,
    /** Chamar de tempos em tempos; devolve a avaliação quando é hora de intervir. */
    avaliar(): AvaliacaoOciosidade | null {
      const a = avaliarOciosidade(estado, agora(), cfg);
      if (!a.deveIntervir) return null;
      estado.ultimaIntervencao = agora();
      estado.inicioJanela = agora();
      estado.eventosNavegacao = 0;
      return a;
    },
    estado: () => ({ ...estado }),
  };
}
