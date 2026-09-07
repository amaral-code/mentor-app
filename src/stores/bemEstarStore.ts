import { create } from 'zustand';
import type {
  CarteiraFoco,
  ClasseBurnout,
  EventoTelemetria,
  IndiceBurnout,
  ModoEscudo,
  RelatorioSemanal,
  RevisaoEspacada,
  SessaoOffline,
} from '../shared/types';
import { bemEstarRepository } from '../shared/storage/BemEstarRepository';
import { focoOfflineRepository } from '../shared/storage/FocoOfflineRepository';
import { conteudoRepository } from '../shared/storage/ConteudoRepository';
import {
  extrairFeatures,
  preverBurnout,
  deveBloquearConteudoDenso,
  FADIGA_ZERADA,
  PREVISAO_ZERADA,
  type PrevisaoBurnout,
} from '../shared/lib/burnoutModel';
import { calcularMoedas, moedasDeHoje } from '../shared/lib/focusShield';
import { useAppStore, persistir } from './appStore';

/**
 * Estado do modulo de bem-estar.
 *
 * Fica FORA do appStore por dois motivos praticos: o appStore ja tem 60
 * campos e e importado por toda tela (qualquer campo novo re-renderiza o
 * app inteiro), e este estado so interessa a quem abre as telas novas.
 *
 * Como no resto do projeto, escrita que vale moeda ou dispara alerta
 * passa pelo servidor e o retorno SUBSTITUI o palpite local.
 */

/** Lote de telemetria antes de ir para o banco. */
const LOTE_TELEMETRIA = 10;

/**
 * Recalculo local puro (sem rede).
 *
 * O BUG: registrarResposta prometia ("o indicador reage dentro da propria
 * sessao") mas nunca recalculava — o modelo so rodava no boot, no flush
 * de 10 eventos ou no fim do quiz. Resultado: o aluno respondia 5
 * questoes, voltava para a Central e o indice seguia escondido ou com o
 * valor velho do boot. Agora cada resposta recalcula na hora; a gravacao
 * no servidor continua so no flush/fim, para nao spammar a rede.
 */
function calcularLocal(eventos: EventoTelemetria[]): {
  previsao: PrevisaoBurnout;
  features: ReturnType<typeof extrairFeatures>;
} | null {
  if (eventos.length < 5) return null;
  const app = useAppStore.getState();
  const features = extrairFeatures(eventos, { horasSono: app.sono });
  // FADIGA_ZERADA: o modelo roda igual, mas o consumo é sempre 0/saudável.
  return { previsao: FADIGA_ZERADA ? PREVISAO_ZERADA : preverBurnout(features), features };
}

interface IntervencaoAtiva {
  id: number | null;
  titulo: string;
  convite: string;
  acao: string;
  materia: string;
  segundosVagando: number;
}

interface EstadoEscudo {
  ativo: boolean;
  inicio: number | null;
  modo: ModoEscudo;
  /** Quantas vezes o aluno voltou ao app durante a sessao. */
  interrupcoes: number;
  /** Minutos ja acumulados, atualizado por tick de 1 s na tela. */
  minutosDecorridos: number;
}

interface BemEstarState {
  // --- Telemetria e burnout ---
  bufferTelemetria: EventoTelemetria[];
  telemetria: EventoTelemetria[];
  previsao: PrevisaoBurnout | null;
  historicoBurnout: IndiceBurnout[];
  conteudoDensoBloqueado: boolean;

  // --- Escudo de dopamina ---
  escudo: EstadoEscudo;
  carteira: CarteiraFoco;
  sessoesOffline: SessaoOffline[];

  // --- Revisao espacada ---
  revisoes: RevisaoEspacada[];

  // --- Intervencao de doomscrolling ---
  intervencao: IntervencaoAtiva | null;

  // --- Relatorio semanal ---
  relatorios: RelatorioSemanal[];

  carregado: boolean;

  // Acoes
  carregarTudo: () => Promise<void>;
  registrarResposta: (e: Omit<EventoTelemetria, 'timestamp' | 'horaLocal'>) => void;
  descarregarTelemetria: () => Promise<void>;
  recalcularBurnout: () => Promise<PrevisaoBurnout | null>;
  /** Zera telemetria + serie (servidor via RPC 017) e esconde o card ate 5 eventos. */
  reiniciarIndice: () => Promise<void>;
  iniciarEscudo: (modo: ModoEscudo) => void;
  registrarInterrupcao: () => void;
  atualizarCronometro: (minutos: number) => void;
  encerrarEscudo: () => Promise<{ moedas: number; minutos: number } | null>;
  cancelarEscudo: () => void;
  gastarMoedas: (quantidade: number, motivo: string) => Promise<boolean>;
  agendarRevisao: (topicoId: string, topicoNome: string, materia: string, nota: number) => Promise<void>;
  mostrarIntervencao: (i: Omit<IntervencaoAtiva, 'id'>) => Promise<void>;
  responderIntervencao: (aceita: boolean) => Promise<void>;
  adicionarRelatorio: (r: RelatorioSemanal) => void;
}

export const useBemEstarStore = create<BemEstarState>((set, get) => ({
  bufferTelemetria: [],
  telemetria: [],
  previsao: null,
  historicoBurnout: [],
  conteudoDensoBloqueado: false,

  escudo: { ativo: false, inicio: null, modo: 'enem', interrupcoes: 0, minutosDecorridos: 0 },
  carteira: { saldo: 0, totalGanho: 0, totalGasto: 0 },
  sessoesOffline: [],

  revisoes: [],
  intervencao: null,
  relatorios: [],
  carregado: false,

  carregarTudo: async () => {
    const [telemetria, historico, carteira, sessoes, revisoes, relatorios] = await Promise.all([
      bemEstarRepository.carregarTelemetria(14),
      bemEstarRepository.carregarBurnout(30),
      focoOfflineRepository.carregarCarteira(),
      focoOfflineRepository.listarSessoes(60),
      conteudoRepository.listarRevisoes(),
      bemEstarRepository.listarRelatorios(8),
    ]);

    // Fadiga zerada: histórico antigo do servidor é ignorado (a curva dos
    // pais e a série do card nascem zeradas e assim permanecem).
    set({ telemetria, historicoBurnout: FADIGA_ZERADA ? [] : historico, carteira, sessoesOffline: sessoes, revisoes, relatorios, carregado: true });
    await get().recalcularBurnout();
  },

  /**
   * Registra uma resposta de quiz.
   *
   * Acumula em memoria e so grava a cada LOTE_TELEMETRIA. O buffer
   * tambem alimenta o modelo na hora, entao o indicador de fadiga reage
   * dentro da propria sessao, sem esperar o flush.
   */
  registrarResposta: (evento) => {
    const completo: EventoTelemetria = {
      ...evento,
      timestamp: Date.now(),
      horaLocal: new Date().getHours(),
    };

    set((s) => {
      const bufferTelemetria = [...s.bufferTelemetria, completo];
      const telemetria = [completo, ...s.telemetria].slice(0, 2000);
      const calc = calcularLocal([...bufferTelemetria, ...telemetria]);
      return {
        bufferTelemetria,
        telemetria,
        previsao: calc?.previsao ?? null,
        // Fadiga zerada: conteúdo denso nunca é bloqueado.
        conteudoDensoBloqueado: FADIGA_ZERADA ? false : calc ? deveBloquearConteudoDenso(calc.previsao.classe) : false,
      };
    });

    if (get().bufferTelemetria.length >= LOTE_TELEMETRIA) {
      void get().descarregarTelemetria();
    }
  },

  descarregarTelemetria: async () => {
    const buffer = get().bufferTelemetria;
    if (buffer.length === 0) return;
    set({ bufferTelemetria: [] });

    try {
      await bemEstarRepository.salvarTelemetria(buffer);
      await get().recalcularBurnout();
    } catch {
      // Devolve ao buffer: perder telemetria significa o modelo ficar
      // cego justamente na semana pesada, que e quando ele importa.
      set((s) => ({ bufferTelemetria: [...buffer, ...s.bufferTelemetria] }));
    }
  },

  /**
   * Roda o modelo e, se a classe for de risco, avisa o servidor - que
   * decide sobre o alerta aos responsaveis (uma vez por dia, no maximo).
   */
  recalcularBurnout: async () => {
    // Fadiga zerada: responde 0/saudável sem gravar nada no servidor
    // (nem histórico, nem alerta aos responsáveis).
    if (FADIGA_ZERADA) {
      set({ previsao: PREVISAO_ZERADA, conteudoDensoBloqueado: false });
      return PREVISAO_ZERADA;
    }
    const eventos = [...get().bufferTelemetria, ...get().telemetria];
    const calc = calcularLocal(eventos);
    if (!calc) {
      set({ previsao: null, conteudoDensoBloqueado: false });
      return null;
    }
    const { previsao, features } = calc;

    set({ previsao, conteudoDensoBloqueado: deveBloquearConteudoDenso(previsao.classe) });

    const hoje = new Date().toISOString().slice(0, 10);
    const jaRegistradoHoje = get().historicoBurnout.some(
      (h) => h.data === hoje && Math.abs(h.score - previsao.score) < 5,
    );
    if (jaRegistradoHoje) return previsao;

    try {
      await bemEstarRepository.registrarBurnout(
        previsao.score,
        previsao.classe as ClasseBurnout,
        features,
      );
      set((s) => ({
        historicoBurnout: [
          ...s.historicoBurnout.filter((h) => h.data !== hoje),
          { data: hoje, score: previsao.score, classe: previsao.classe, features },
        ],
      }));
    } catch {
      // Silencio proposital: o indice do dia e derivavel da telemetria,
      // que ja foi gravada. Um toast de erro aqui apareceria no meio de
      // um quiz sem nada que o aluno possa fazer a respeito.
    }

    return previsao;
  },

  reiniciarIndice: async () => {
    set({
      bufferTelemetria: [],
      telemetria: [],
      previsao: null,
      historicoBurnout: [],
      conteudoDensoBloqueado: false,
    });
    const ok = await bemEstarRepository.reiniciarIndice().catch(() => false);
    const app = useAppStore.getState();
    if (ok) {
      app.setToast('Índice reiniciado. Ele volta a calcular nas próximas respostas.', 'success');
    } else {
      app.setToast('Índice zerado aqui. Sem conexão, o histórico antigo pode voltar ao recarregar.', 'info');
    }
  },

  // =================================================================
  // Escudo de dopamina
  // =================================================================

  iniciarEscudo: (modo) => {
    set({ escudo: { ativo: true, inicio: Date.now(), modo, interrupcoes: 0, minutosDecorridos: 0 } });
  },

  registrarInterrupcao: () => {
    set((s) =>
      s.escudo.ativo ? { escudo: { ...s.escudo, interrupcoes: s.escudo.interrupcoes + 1 } } : s,
    );
  },

  atualizarCronometro: (minutos) => {
    set((s) => (s.escudo.ativo ? { escudo: { ...s.escudo, minutosDecorridos: minutos } } : s));
  },

  /**
   * Fecha a sessao e credita no servidor.
   *
   * A previa local (calcularMoedas) so serve para a animacao; o numero
   * exibido no fim e o que o banco devolveu.
   */
  encerrarEscudo: async () => {
    const { escudo, sessoesOffline } = get();
    if (!escudo.ativo || !escudo.inicio) return null;

    const inicio = new Date(escudo.inicio);
    const fim = new Date();
    const previa = calcularMoedas(
      (fim.getTime() - inicio.getTime()) / 60000,
      escudo.interrupcoes,
      escudo.modo,
      moedasDeHoje(sessoesOffline),
    );

    set({ escudo: { ativo: false, inicio: null, modo: escudo.modo, interrupcoes: 0, minutosDecorridos: 0 } });

    if (previa.minutos < 1) return { moedas: 0, minutos: previa.minutos };

    try {
      const resultado = await focoOfflineRepository.creditarSessao(
        inicio,
        fim,
        escudo.interrupcoes,
        escudo.modo,
      );
      set((s) => ({
        carteira: { ...s.carteira, saldo: resultado.saldo, totalGanho: s.carteira.totalGanho + resultado.moedas },
        sessoesOffline: [
          {
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            minutosOffline: resultado.minutos,
            interrupcoes: escudo.interrupcoes,
            modo: escudo.modo,
            moedasCreditadas: resultado.moedas,
          },
          ...s.sessoesOffline,
        ],
      }));
      return { moedas: resultado.moedas, minutos: resultado.minutos };
    } catch {
      useAppStore
        .getState()
        .setToast('A sessao terminou, mas as moedas nao foram creditadas. Tente de novo.', 'error');
      return null;
    }
  },

  cancelarEscudo: () => {
    set({ escudo: { ativo: false, inicio: null, modo: get().escudo.modo, interrupcoes: 0, minutosDecorridos: 0 } });
  },

  gastarMoedas: async (quantidade, motivo) => {
    const anterior = get().carteira;
    if (anterior.saldo < quantidade) {
      useAppStore.getState().setToast('Saldo de foco insuficiente.', 'error');
      return false;
    }

    // Otimista: a loja precisa responder no toque.
    set({ carteira: { ...anterior, saldo: anterior.saldo - quantidade, totalGasto: anterior.totalGasto + quantidade } });

    try {
      const saldo = await focoOfflineRepository.gastar(quantidade, motivo);
      set((s) => ({ carteira: { ...s.carteira, saldo } }));
      return true;
    } catch {
      set({ carteira: anterior });
      useAppStore.getState().setToast('Nao foi possivel usar as moedas agora.', 'error');
      return false;
    }
  },

  // =================================================================
  // Revisao espacada
  // =================================================================

  agendarRevisao: async (topicoId, topicoNome, materia, nota) => {
    try {
      const revisao = await conteudoRepository.registrarRevisao(topicoId, topicoNome, materia, nota);
      if (!revisao) return;
      set((s) => ({
        revisoes: [...s.revisoes.filter((r) => r.topicoId !== topicoId), revisao].sort((a, b) =>
          a.proximaRevisao.localeCompare(b.proximaRevisao),
        ),
      }));
    } catch {
      useAppStore
        .getState()
        .setToast('A revisao deste topico nao entrou no calendario.', 'error');
    }
  },

  // =================================================================
  // Intervencao de doomscrolling
  // =================================================================

  mostrarIntervencao: async (i) => {
    set({ intervencao: { ...i, id: null } });
    const id = await bemEstarRepository.registrarIntervencao({
      tipo: 'doomscroll',
      mensagem: `${i.titulo} ${i.convite}`,
      gatilho: { segundosVagando: i.segundosVagando, materia: i.materia },
    });
    set((s) => (s.intervencao ? { intervencao: { ...s.intervencao, id } } : s));
  },

  responderIntervencao: async (aceita) => {
    const atual = get().intervencao;
    set({ intervencao: null });
    if (atual?.id != null) {
      await bemEstarRepository.responderIntervencao(atual.id, aceita);
    }
  },

  adicionarRelatorio: (r) => {
    set((s) => ({ relatorios: [r, ...s.relatorios.filter((x) => x.semanaInicio !== r.semanaInicio)] }));
  },
}));

/**
 * Grava o que sobrou no buffer quando a aba fecha.
 *
 * sendBeacon nao serve aqui (o PostgREST exige cabecalho de auth), entao
 * o flush comum e disparado no visibilitychange - que, ao contrario do
 * unload, e confiavel no iOS.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const store = useBemEstarStore.getState();
      if (store.bufferTelemetria.length > 0) {
        persistir(store.descarregarTelemetria(), {
          mensagem: 'Parte do seu historico de estudo desta sessao nao foi salvo.',
        });
      }
    }
  });
}
