/**
 * Preferências de notificação (issue #55).
 *
 * O banco é quem decide o que sai (`pushes_para_enviar`, migration 032).
 * Este módulo só descreve as preferências para a tela e espelha a regra
 * do horário silencioso, para a tela mostrar "agora está em silêncio"
 * com a mesma conta que o servidor faz.
 */

export type TipoNotificacao = 'revisao' | 'ofensiva' | 'liga' | 'consulta' | 'mensagens' | 'alerta' | 'relatorio';

export interface PreferenciasNotificacao {
  tipos: Record<TipoNotificacao, boolean>;
  silencioInicio: number;
  silencioFim: number;
  limiteDiario: number;
}

/** Ordem e texto de cada tipo na tela. `perfil` diz para quem aparece. */
export const TIPOS_NOTIFICACAO: { id: TipoNotificacao; rotulo: string; descricao: string; perfil: 'aluno' | 'responsavel' | 'todos' }[] = [
  { id: 'revisao', rotulo: 'Revisões do dia', descricao: 'De manhã, quando alguma revisão vence.', perfil: 'aluno' },
  { id: 'ofensiva', rotulo: 'Ofensiva em risco', descricao: 'À noite, se você ainda não estudou hoje.', perfil: 'aluno' },
  { id: 'liga', rotulo: 'Ligas', descricao: 'Convites e novidades das suas ligas.', perfil: 'aluno' },
  { id: 'consulta', rotulo: 'Consultas', descricao: 'Confirmação e lembrete de atendimento.', perfil: 'todos' },
  { id: 'mensagens', rotulo: 'Mensagens e acompanhamento', descricao: 'Mensagem nova, responsável ou psicólogo com acesso. O texto nunca aparece no aviso.', perfil: 'todos' },
  { id: 'alerta', rotulo: 'Alertas de bem-estar', descricao: 'Quando o estudante dá sinais de cansaço forte.', perfil: 'responsavel' },
  { id: 'relatorio', rotulo: 'Resumo da semana', descricao: 'O resumo positivo de sexta-feira.', perfil: 'responsavel' },
];

export const PREFERENCIAS_PADRAO: PreferenciasNotificacao = {
  tipos: { revisao: true, ofensiva: true, liga: true, consulta: true, mensagens: true, alerta: true, relatorio: true },
  silencioInicio: 22,
  silencioFim: 7,
  limiteDiario: 3,
};

const hora = (n: unknown, padrao: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(23, v)) : padrao;
};

/** Converte a linha do banco (ou nada) em preferências completas. */
export function normalizarPreferencias(linha: {
  tipos?: unknown;
  silencio_inicio?: unknown;
  silencio_fim?: unknown;
  limite_diario?: unknown;
} | null | undefined): PreferenciasNotificacao {
  const base = PREFERENCIAS_PADRAO;
  const tipos = { ...base.tipos };
  const vindos = linha?.tipos && typeof linha.tipos === 'object' ? (linha.tipos as Record<string, unknown>) : {};
  for (const t of Object.keys(tipos) as TipoNotificacao[]) {
    if (typeof vindos[t] === 'boolean') tipos[t] = vindos[t] as boolean;
  }
  const limite = Math.round(Number(linha?.limite_diario));
  return {
    tipos,
    silencioInicio: hora(linha?.silencio_inicio, base.silencioInicio),
    silencioFim: hora(linha?.silencio_fim, base.silencioFim),
    limiteDiario: Number.isFinite(limite) ? Math.max(1, Math.min(10, limite)) : base.limiteDiario,
  };
}

/** Mesma conta de `pushes_para_enviar`: início == fim quer dizer sem silêncio. */
export function emSilencio(horaAtual: number, inicio: number, fim: number): boolean {
  if (inicio === fim) return false;
  return inicio > fim ? horaAtual >= inicio || horaAtual < fim : horaAtual >= inicio && horaAtual < fim;
}

/** Hora atual em Brasília (0 a 23), o relógio do servidor. */
export function horaDeBrasilia(agora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora));
}

/** Chave VAPID em base64url para os bytes que o `pushManager.subscribe` pede. */
export function base64UrlParaBytes(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
