import { create } from 'zustand';
import {
  enfileirarOperacao,
  operacoesPendentes,
  sincronizarFila,
  type TipoOperacao,
} from '@mentor/core/filaOffline';
import { plataforma } from '@mentor/core/plataforma';
import { aplicarOperacao } from '@mentor/api/SincronizacaoRepository';
import type { GamificationState } from '@mentor/core/types';

/**
 * Estado da sincronização offline (#56): quantas operações esperam no
 * aparelho e se há conexão. A tela mostra isso; quem grava chama
 * `registrarOperacao` em vez de falar direto com o banco.
 *
 * Não importa o appStore de propósito (evita import circular): o XP
 * confirmado pelo servidor volta por `aoConfirmarXp`, que o appStore
 * registra.
 */
interface EstadoSincronizacao {
  pendentes: number;
  online: boolean;
  sincronizando: boolean;
}

export const useSincronizacaoStore = create<EstadoSincronizacao>(() => ({
  pendentes: operacoesPendentes().length,
  online: plataforma().online() !== false,
  sincronizando: false,
}));

let confirmarXp: ((g: Partial<GamificationState>) => void) | null = null;
export function aoConfirmarXp(cb: (g: Partial<GamificationState>) => void): void {
  confirmarXp = cb;
}

let emVoo: Promise<void> | null = null;

export function sincronizarAgora(opcoes: { conexaoVoltou?: boolean } = {}): Promise<void> {
  if (emVoo) return emVoo;
  emVoo = (async () => {
    useSincronizacaoStore.setState({ sincronizando: true });
    try {
      const r = await sincronizarFila(aplicarOperacao, Date.now(), { ignorarEspera: opcoes.conexaoVoltou });
      for (const { op, resposta } of r.aplicadas) {
        const g = (resposta as { gamificacao?: { xp: number; level: number; streak: number; ultimo_acesso?: string } } | null)?.gamificacao;
        if (op.tipo === 'xp' && g) {
          confirmarXp?.({ xp: g.xp, level: g.level, streak: g.streak, lastAccessDate: g.ultimo_acesso ?? '' });
        }
      }
      if (r.recusadas.length > 0) console.warn('[sincronizacao] operacoes recusadas pelo servidor:', r.recusadas.map((x) => x.motivo));
      useSincronizacaoStore.setState({ pendentes: r.pendentes });
    } finally {
      useSincronizacaoStore.setState({ sincronizando: false });
      emVoo = null;
    }
  })();
  return emVoo;
}

/** Guarda a operação no aparelho e tenta enviar na hora. */
export function registrarOperacao(tipo: TipoOperacao, dados: Record<string, unknown>): void {
  enfileirarOperacao(tipo, dados);
  useSincronizacaoStore.setState({ pendentes: operacoesPendentes().length });
  void sincronizarAgora();
}

/**
 * Liga a sincronização no boot: tenta ao abrir, quando a conexão volta e
 * a cada 30 s enquanto houver pendente. Devolve a função que desliga.
 */
export function iniciarSincronizacao(): () => void {
  const desligarConexao = plataforma().aoMudarConexao((online) => {
    useSincronizacaoStore.setState({ online });
    if (online) void sincronizarAgora({ conexaoVoltou: true });
  });
  const relogio = setInterval(() => {
    if (useSincronizacaoStore.getState().pendentes > 0) void sincronizarAgora();
  }, 30_000);
  void sincronizarAgora();
  return () => {
    desligarConexao();
    clearInterval(relogio);
  };
}
