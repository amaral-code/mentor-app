import type { StatusAgendamento } from '../../shared/types';

/** Sessão pronta para exibição (derivada de Agendamento + catálogo). */
export interface SessaoView {
  id: string;
  inicio: Date;
  fim: Date;
  psicologoNome: string;
  crp: string;
  duracaoMinutos: number;
  meetingUrl: string | null;
  status: StatusAgendamento;
  passada: boolean;
  ehHoje: boolean;
}

export function iniciais(nome: string): string {
  const partes = nome.replace(/^(Dra?\.?|Dr\.?)\s+/i, '').trim().split(/\s+/);
  if (partes.length === 1) return (partes[0]?.slice(0, 2) ?? 'P').toUpperCase();
  return `${partes[0]?.[0] ?? ''}${partes[partes.length - 1]?.[0] ?? ''}`.toUpperCase();
}

export function formatarDataHora(d: Date): string {
  const data = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}
