import { ehMenorDe16 } from './vinculoCodigo';

/**
 * Analytics de produto com privacidade (issue #66).
 *
 * DECISÕES (conservadoras de propósito, revisar com o jurídico)
 *   • Desligado por padrão. Só envia com consentimento explícito no Perfil.
 *   • Menor de 16, ou sem data de nascimento, NÃO pode ligar: pela LGPD o
 *     consentimento seria do responsável, e o app ainda não tem esse
 *     fluxo para analytics. Melhor não medir do que medir sem base legal.
 *   • Nenhum dado pessoal: o identificador é um hash do id da conta, e só
 *     saem os eventos e propriedades desta lista fechada. Texto digitado,
 *     nome, escola e turma nunca entram.
 *   • Sem chave configurada (POSTHOG_KEY), nada sai.
 *
 * O plano de eventos e os funis estão em docs/analytics.md.
 */

/** Plano de eventos: nome -> propriedades permitidas e seus valores. */
export const PLANO_DE_EVENTOS = {
  app_aberto: {},
  onboarding_concluido: { pulou_data: ['sim', 'nao'] },
  quiz_concluido: { materia: 'texto-curto', questoes: 'numero', faixa_acerto: ['0-49', '50-69', '70-100'], offline: ['sim', 'nao'] },
  redacao_corrigida: { origem: ['digitada', 'foto'] },
  mentor_pergunta: { modo: ['explicativo', 'comunicativo'] },
  foco_concluido: { minutos: 'numero' },
  revisao_feita: {},
  notificacoes_ligadas: {},
  convite_compartilhado: { tipo: ['liga', 'turma', 'vinculo'] },
  feedback_enviado: { tipo: ['ideia', 'problema', 'elogio'] },
} as const;

export type NomeEvento = keyof typeof PLANO_DE_EVENTOS;

export function podeRastrear(o: { chaveConfigurada: boolean; consentiu: boolean; dataNascimento: string | null | undefined }): boolean {
  return o.chaveConfigurada && o.consentiu && !ehMenorDe16(o.dataNascimento ?? null);
}

/** Mantém só as propriedades do plano, com valores dentro do permitido. */
export function filtrarPropriedades(nome: NomeEvento, props: Record<string, unknown> = {}): Record<string, string | number> {
  const regra = PLANO_DE_EVENTOS[nome] as Record<string, string | readonly string[]>;
  const saida: Record<string, string | number> = {};
  for (const [chave, tipo] of Object.entries(regra)) {
    const v = props[chave];
    if (Array.isArray(tipo)) {
      if (typeof v === 'string' && tipo.includes(v)) saida[chave] = v;
    } else if (tipo === 'numero') {
      const n = Number(v);
      if (Number.isFinite(n)) saida[chave] = Math.round(n);
    } else if (tipo === 'texto-curto' && typeof v === 'string') {
      saida[chave] = v.slice(0, 40);
    }
  }
  return saida;
}

export function faixaDeAcerto(acertos: number, total: number): '0-49' | '50-69' | '70-100' {
  const p = total > 0 ? (acertos / total) * 100 : 0;
  return p < 50 ? '0-49' : p < 70 ? '50-69' : '70-100';
}

/** Identificador anônimo e estável: SHA-256 do id da conta com sal fixo. */
export async function idAnonimo(uid: string): Promise<string> {
  const dados = new TextEncoder().encode(`midnight-mentor:${uid}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', dados));
  return Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ConfigAnalytics {
  chave: string;
  host: string;
}

/** Corpo do envio no formato de captura do PostHog. */
export function montarCaptura(cfg: ConfigAnalytics, nome: NomeEvento, distinctId: string, props: Record<string, unknown>, agora = new Date()) {
  return {
    api_key: cfg.chave,
    event: nome,
    distinct_id: distinctId,
    timestamp: agora.toISOString(),
    properties: { ...filtrarPropriedades(nome, props), $lib: 'midnight-mentor', $process_person_profile: false, $ip: null },
  };
}
