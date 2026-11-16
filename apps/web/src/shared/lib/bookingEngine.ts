import type { Agendamento, JanelaDisponibilidade, SlotAgenda } from '../types';

/**
 * ARQUITETURA DE BOOKING - geracao e validacao de horarios.
 *
 * O modelo e o mesmo de qualquer marketplace de servico serio, com uma
 * escolha central: nao existe tabela de "slots". O profissional declara
 * JANELAS SEMANAIS (segunda 14h-20h) e os horarios concretos sao
 * derivados delas, descontando o que ja esta ocupado.
 *
 * Por que nao materializar slots: 6 horas por dia x 5 dias x 52 semanas
 * x N profissionais = centenas de milhares de linhas que existem so para
 * dizer "ninguem marcou aqui". Mudar a agenda viraria migracao de dados.
 *
 * Onde mora a verdade: neste arquivo esta a PREVIA (o que a tela mostra
 * enquanto o responsavel escolhe). A confirmacao final e do banco -
 * slots_livres() recalcula, agendar_consulta() revalida e o EXCLUDE de
 * agendamentos impede sobreposicao mesmo com dois cliques simultaneos.
 * Cliente nenhum consegue garantir isso sozinho.
 */

/** Antecedencia minima entre agora e o inicio da consulta. */
export const ANTECEDENCIA_MINIMA_HORAS = 2;

/** Ate onde a agenda e oferecida. */
export const JANELA_OFERTA_DIAS = 14;

const MS_MINUTO = 60_000;

function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Gera os horarios possiveis de um profissional.
 *
 * @param janelas    disponibilidade semanal declarada
 * @param duracao    minutos por consulta
 * @param ocupados   consultas ja existentes (qualquer status menos cancelado)
 * @param agora      injetavel para teste
 */
export function gerarSlots(
  janelas: JanelaDisponibilidade[],
  duracao: number,
  ocupados: { inicio: string; fim: string }[] = [],
  agora: Date = new Date(),
  dias = JANELA_OFERTA_DIAS,
): SlotAgenda[] {
  if (duracao <= 0 || janelas.length === 0) return [];

  const limiteInferior = agora.getTime() + ANTECEDENCIA_MINIMA_HORAS * 60 * MS_MINUTO;
  const intervalos = ocupados.map((o) => ({
    de: new Date(o.inicio).getTime(),
    ate: new Date(o.fim).getTime(),
  }));

  const slots: SlotAgenda[] = [];

  for (let d = 0; d < dias; d++) {
    const dia = new Date(agora);
    dia.setDate(dia.getDate() + d);
    dia.setHours(0, 0, 0, 0);

    for (const janela of janelas.filter((j) => j.diaSemana === dia.getDay())) {
      const inicioMin = minutosDoDia(janela.horaInicio);
      const fimMin = minutosDoDia(janela.horaFim);

      for (let t = inicioMin; t + duracao <= fimMin; t += duracao) {
        const inicio = new Date(dia.getTime() + t * MS_MINUTO);
        const fim = new Date(inicio.getTime() + duracao * MS_MINUTO);

        if (inicio.getTime() < limiteInferior) continue;
        const conflita = intervalos.some((o) => inicio.getTime() < o.ate && fim.getTime() > o.de);
        if (conflita) continue;

        slots.push({ inicio: inicio.toISOString(), fim: fim.toISOString() });
      }
    }
  }

  return slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export interface DiaComSlots {
  data: string; // YYYY-MM-DD
  rotulo: string; // "Qua, 27/08"
  slots: SlotAgenda[];
}

const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/** Agrupa por dia - a tela escolhe primeiro o dia, depois a hora. */
export function agruparPorDia(slots: SlotAgenda[]): DiaComSlots[] {
  const mapa = new Map<string, SlotAgenda[]>();

  for (const slot of slots) {
    const d = new Date(slot.inicio);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const lista = mapa.get(chave) ?? [];
    lista.push(slot);
    mapa.set(chave, lista);
  }

  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, lista]) => {
      const d = new Date(`${data}T12:00:00`);
      return {
        data,
        rotulo: `${DIA_CURTO[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        slots: lista,
      };
    });
}

/** Conflito com o que o proprio aluno ja tem marcado. */
export function conflitaComAgenda(slot: SlotAgenda, agendamentos: Agendamento[]): boolean {
  const de = new Date(slot.inicio).getTime();
  const ate = new Date(slot.fim).getTime();
  return agendamentos
    .filter((a) => a.status !== 'cancelado')
    .some((a) => de < new Date(a.fim).getTime() && ate > new Date(a.inicio).getTime());
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Politica de cancelamento.
 *
 * 24h e o padrao da area: o profissional reservou a hora e nao consegue
 * revender em cima da hora. Abaixo disso o cancelamento continua
 * possivel (ninguem e obrigado a entrar numa sessao), mas sem reembolso
 * - e a tela diz isso ANTES de confirmar.
 */
export const HORAS_REEMBOLSO_INTEGRAL = 24;

export function politicaCancelamento(inicio: string, agora: Date = new Date()): {
  podeCancelar: boolean;
  reembolsoIntegral: boolean;
  texto: string;
} {
  const horas = (new Date(inicio).getTime() - agora.getTime()) / (60 * MS_MINUTO);
  if (horas <= 0) {
    return { podeCancelar: false, reembolsoIntegral: false, texto: 'A consulta ja comecou ou passou.' };
  }
  if (horas >= HORAS_REEMBOLSO_INTEGRAL) {
    return {
      podeCancelar: true,
      reembolsoIntegral: true,
      texto: 'Cancelamento gratuito ate 24h antes.',
    };
  }
  return {
    podeCancelar: true,
    reembolsoIntegral: false,
    texto: 'Faltam menos de 24h: o cancelamento nao gera reembolso.',
  };
}

/**
 * Sala de video sem depender de OAuth.
 *
 * Google Meet e Zoom exigem que o PROFISSIONAL conecte a conta dele
 * (OAuth + refresh token no servidor). Enquanto isso nao existe, o
 * worker cria uma sala Jitsi - link publico, sem cadastro, funciona no
 * navegador do celular. O nome carrega o id do agendamento e um sufixo
 * aleatorio para nao ser adivinhavel.
 *
 * A troca de provedor e uma variavel de ambiente no worker; o app so le
 * meeting_url.
 */
export function nomeSalaJitsi(agendamentoId: string): string {
  const curto = agendamentoId.replace(/-/g, '').slice(0, 12);
  return `ampli-${curto}`;
}

export function ehLinkDeSalaValido(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Quanto falta para a consulta, em texto curto ("em 2h", "amanha"). */
export function tempoAte(inicio: string, agora: Date = new Date()): string {
  const min = Math.round((new Date(inicio).getTime() - agora.getTime()) / MS_MINUTO);
  if (min < 0) return 'já passou';
  if (min < 60) return `em ${min} min`;
  if (min < 60 * 24) return `em ${Math.round(min / 60)}h`;
  const dias = Math.round(min / (60 * 24));
  return dias === 1 ? 'amanha' : `em ${dias} dias`;
}

/** A sala abre 10 minutos antes e fecha 30 minutos depois do fim. */
export function salaEstaAberta(agendamento: Agendamento, agora: Date = new Date()): boolean {
  const t = agora.getTime();
  return (
    t >= new Date(agendamento.inicio).getTime() - 10 * MS_MINUTO &&
    t <= new Date(agendamento.fim).getTime() + 30 * MS_MINUTO
  );
}
