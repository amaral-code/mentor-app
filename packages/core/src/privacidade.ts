/**
 * Regras puras da área "Sua conta e seus dados" (LGPD, issue #70) e do
 * feedback do beta (#74). Sem DOM: o app nativo usa as mesmas.
 */

/**
 * Páginas públicas (HTML estático em `apps/web/public/legal`). Mesmos
 * endereços nas lojas (#71, #72). Caminho com `.html` de propósito: abre
 * igual no dev, no preview e na Vercel, sem depender de reescrita.
 */
export const LINKS_LEGAIS = {
  privacidade: '/legal/privacidade.html',
  termos: '/legal/termos.html',
} as const;

/** A palavra que a pessoa digita para excluir a conta. O servidor confere a mesma. */
export const PALAVRA_EXCLUSAO = 'EXCLUIR';

export function confirmacaoValida(digitado: string): boolean {
  return digitado.trim().toUpperCase() === PALAVRA_EXCLUSAO;
}

/** `meus-dados-midnight-mentor-2026-11-16.json`, na data de Brasília. */
export function nomeArquivoExportacao(agora: Date = new Date()): string {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  return `meus-dados-midnight-mentor-${dia}.json`;
}

/**
 * O que a exclusão leva e o que fica, dito antes do botão. O psicólogo
 * vê a linha do prontuário porque ela muda o que ele precisa fazer antes
 * (exportar as notas que é obrigado a guardar).
 */
export function oQueAExclusaoFaz(papel: string): string[] {
  const linhas = [
    'Apaga o seu perfil, o seu progresso, as conversas com o Mentor, o caderno, as redações e as fotos enviadas.',
    'Desfaz os vínculos com responsáveis, turma e ligas.',
    'Não tem volta. Se quiser guardar alguma coisa, baixe os seus dados antes.',
  ];
  if (papel === 'psychologist') {
    linhas.push(
      'As notas de prontuário que você escreveu saem junto. Você é obrigado a guardá-las por 5 anos: baixe os seus dados antes de excluir.',
    );
  } else {
    linhas.push(
      'Se você foi atendido por um psicólogo pelo app, as notas de prontuário ficam com ele pelo prazo que a lei exige, sem ligação com a sua conta.',
    );
  }
  return linhas;
}

export type TipoFeedback = 'ideia' | 'problema' | 'elogio';

export interface Feedback {
  tipo: TipoFeedback;
  texto: string;
  nota: number | null;
  tela?: string;
}

/** Devolve o motivo da recusa, ou null quando pode enviar. */
export function problemaNoFeedback(f: Feedback): string | null {
  const texto = f.texto.trim();
  if (!texto) return 'Escreva o que você quer contar.';
  if (texto.length > 2000) return 'Use até 2000 caracteres.';
  if (f.nota !== null && (!Number.isInteger(f.nota) || f.nota < 0 || f.nota > 10)) return 'A nota vai de 0 a 10.';
  return null;
}

/** Faixa do NPS: 9 e 10 promovem, 7 e 8 são neutros, 0 a 6 detratam. */
export function faixaNps(nota: number): 'promotor' | 'neutro' | 'detrator' {
  if (nota >= 9) return 'promotor';
  if (nota >= 7) return 'neutro';
  return 'detrator';
}

/** NPS de uma lista de notas: % promotores menos % detratores, de -100 a 100. */
export function calcularNps(notas: number[]): number | null {
  if (notas.length === 0) return null;
  const p = notas.filter((n) => faixaNps(n) === 'promotor').length;
  const d = notas.filter((n) => faixaNps(n) === 'detrator').length;
  return Math.round(((p - d) / notas.length) * 100);
}
