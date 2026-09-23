import { ehMenorDe16 } from './vinculoCodigo';

/**
 * CONSENTIMENTO DO PSICÓLOGO — as regras que a tela precisa saber ANTES
 * de chamar o banco (migration 027).
 *
 * A fonte da verdade é `conceder_consentimento`, no banco. O que está
 * aqui existe para a tela não oferecer um botão que o banco vai recusar:
 * mostrar "Autorizar" a um aluno de 14 anos e devolver erro depois é
 * pior que explicar de cara que quem autoriza é o responsável.
 */

export type EscopoConsentimento = 'bem_estar' | 'estudo';

export const ESCOPOS: { id: EscopoConsentimento; rotulo: string; detalhe: string }[] = [
  {
    id: 'bem_estar',
    rotulo: 'Índice de cansaço',
    detalhe: 'A curva diária de fadiga que o app calcula. Não inclui nada que você escreveu.',
  },
  {
    id: 'estudo',
    rotulo: 'Ritmo de estudo',
    detalhe: 'Minutos, dias ativos e acerto por matéria. O mesmo resumo que um responsável vê.',
  },
];

/** Teto do banco. Consentimento para dado de saúde nunca é permanente. */
export const DIAS_MAXIMOS = 180;
export const DIAS_PADRAO = 90;

export const DURACOES: { dias: number; rotulo: string }[] = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '3 meses' },
  { dias: 180, rotulo: '6 meses' },
];

export type QuemAutoriza = 'aluno' | 'responsavel';

/**
 * Quem pode conceder, espelhando o banco. As pontas são EXCLUSIVAS:
 * menor de 16 só pelo responsável; 16 ou mais só pelo próprio aluno.
 */
export function quemAutoriza(nascimento: string | null | undefined, hoje: Date = new Date()): QuemAutoriza {
  return ehMenorDe16(nascimento, hoje) ? 'responsavel' : 'aluno';
}

/** Recorta para o que o banco aceita, em vez de deixar o banco recusar. */
export function diasValidos(dias: number): number {
  if (!Number.isFinite(dias)) return DIAS_PADRAO;
  return Math.min(Math.max(Math.round(dias), 1), DIAS_MAXIMOS);
}

/** Sem escopo seria consentimento para nada; o banco recusa. */
export function escopoValido(escopo: string[]): escopo is EscopoConsentimento[] {
  return escopo.length > 0 && escopo.every((e) => e === 'bem_estar' || e === 'estudo');
}

/** Dias inteiros até o fim, para "vence em 12 dias". Nunca negativo. */
export function diasRestantes(validoAte: string, agora: Date = new Date()): number {
  const fim = new Date(validoAte).getTime();
  if (Number.isNaN(fim)) return 0;
  return Math.max(0, Math.ceil((fim - agora.getTime()) / 86400000));
}

export function rotuloEscopo(escopo: string[]): string {
  const nomes = escopo
    .map((e) => ESCOPOS.find((x) => x.id === e)?.rotulo.toLowerCase())
    .filter(Boolean) as string[];
  if (nomes.length === 0) return 'nada';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/**
 * Traduz o erro do banco. O banco fala em código ("menor_de_16"); a
 * tela precisa falar com uma pessoa, e sem travessão.
 */
export function mensagemErroConsentimento(e: unknown): string {
  const bruto = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (bruto.includes('menor_de_16')) {
    return 'Como você tem menos de 16 anos, quem autoriza é o seu responsável, pelo painel dele.';
  }
  if (bruto.includes('maior_de_16')) {
    return 'Este estudante tem 16 anos ou mais. Quem autoriza é ele mesmo, pelo app dele.';
  }
  if (bruto.includes('profissional nao encontrado')) return 'Profissional não encontrado.';
  if (bruto.includes('nao autenticado')) return 'Sua sessão expirou. Entre de novo.';
  return 'Não foi possível salvar agora. Tente de novo em instantes.';
}
