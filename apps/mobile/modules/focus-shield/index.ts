/**
 * Escudo de Dopamina: ponte JavaScript do módulo nativo FocusShield.
 *
 * Com o módulo (build de desenvolvimento ou loja, Android e iOS), mede o
 * tempo de tela apagada/bloqueada no relógio monotônico. Sem ele (web,
 * Expo Go), cai na medição por AppState: o tempo com o app em segundo
 * plano, que é aproximação e a tela avisa.
 */
import { AppState, type NativeEventSubscription } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo';
import { criarMedidor, type Medidor } from '../../src/lib/medidorFundo';

export type ModoEscudo = 'enem' | 'leve' | 'maratona';
export type EventoEscudo = 'telaApagada' | 'espiada' | 'retornou' | 'saiu';

export interface EstadoEscudoNativo {
  ativo: boolean;
  minutosOffline: number;
  minutosSessao: number;
  interrupcoes: number;
  telaApagada: boolean;
  /** true: módulo nativo. false: aproximação por AppState. */
  medicaoNativa: boolean;
}

export interface ResultadoEscudo {
  minutosOffline: number;
  minutosSessao: number;
  interrupcoes: number;
  medicaoNativa: boolean;
  /** iOS: false quando o aparelho não tem senha e nenhum bloqueio foi visto. */
  medicaoPorBloqueio?: boolean;
}

interface ModuloNativo {
  iniciar(modo: string): Promise<EstadoEscudoNativo>;
  encerrar(): Promise<ResultadoEscudo>;
  estado(): EstadoEscudoNativo;
  addListener(evento: string, cb: (e: EstadoEscudoNativo) => void): EventSubscription;
}

const nativo = requireOptionalNativeModule<ModuloNativo>('FocusShield');

export const temModuloNativo = (): boolean => nativo !== null;

/* ------------------------- plano B: AppState ------------------------- */

let medidor: Medidor | null = null;
let inicioFallback = 0;
let assinatura: NativeEventSubscription | null = null;
const ouvintes = new Map<EventoEscudo, Set<(e: EstadoEscudoNativo) => void>>();

function estadoFallback(): EstadoEscudoNativo {
  const t = Date.now();
  return {
    ativo: medidor !== null,
    minutosOffline: medidor?.minutosOffline(t) ?? 0,
    minutosSessao: medidor ? (t - inicioFallback) / 60_000 : 0,
    interrupcoes: medidor?.interrupcoes() ?? 0,
    telaApagada: medidor?.noFundo() ?? false,
    medicaoNativa: false,
  };
}

function emitir(evento: EventoEscudo) {
  const e = estadoFallback();
  ouvintes.get(evento)?.forEach((cb) => cb(e));
}

/* ------------------------------ API ------------------------------ */

export async function iniciar(modo: ModoEscudo): Promise<EstadoEscudoNativo> {
  if (nativo) return nativo.iniciar(modo);
  medidor = criarMedidor();
  inicioFallback = Date.now();
  assinatura?.remove();
  assinatura = AppState.addEventListener('change', (s) => {
    if (!medidor) return;
    if (s === 'background') {
      medidor.saiu(Date.now());
      emitir('telaApagada');
    } else if (s === 'active' && medidor.noFundo()) {
      medidor.voltou(Date.now());
      emitir('retornou');
    }
  });
  return estadoFallback();
}

export async function encerrar(): Promise<ResultadoEscudo> {
  if (nativo) return nativo.encerrar();
  const final = estadoFallback();
  assinatura?.remove();
  assinatura = null;
  medidor = null;
  return { minutosOffline: final.minutosOffline, minutosSessao: final.minutosSessao, interrupcoes: final.interrupcoes, medicaoNativa: false };
}

export function estado(): EstadoEscudoNativo {
  return nativo ? nativo.estado() : estadoFallback();
}

export function ouvir(evento: EventoEscudo, cb: (e: EstadoEscudoNativo) => void): { remove(): void } {
  if (nativo) return nativo.addListener(evento, cb);
  const lista = ouvintes.get(evento) ?? new Set();
  lista.add(cb);
  ouvintes.set(evento, lista);
  return { remove: () => lista.delete(cb) };
}
