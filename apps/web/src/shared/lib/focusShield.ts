import type { ModoEscudo, SessaoOffline } from '../types';

/**
 * ESCUDO DE DOPAMINA - conversao de tempo offline em moedas de foco.
 *
 * A tese do produto: a recompensa e por NAO olhar a tela. Isso muda a
 * matematica em relacao ao XP normal, que premia atividade dentro do app.
 * Tres decisoes vieram daí:
 *
 * 1. FAIXAS, nao linear. Pagar 1 moeda por minuto desde o minuto zero
 *    premia trancar a tela por 3 minutos, que e exatamente o
 *    comportamento de quem esta ansioso conferindo o celular. A curva so
 *    fica boa a partir de 25 min (um pomodoro inteiro) e satura em 90.
 *
 * 2. INTERRUPCAO PESA. Cada volta a tela corta 10% do bloco - com piso em
 *    40%, porque zerar a sessao inteira ensina o aluno a desistir dela
 *    depois do primeiro deslize.
 *
 * 3. TETO DIARIO. Sem teto, o "estudo offline" vira farm de moeda com o
 *    celular na gaveta durante a aula. 500 moedas/dia equivalem a umas
 *    4 horas bem feitas.
 *
 * Este arquivo e a FONTE da formula, mas nao a autoridade: a mesma conta
 * existe em creditar_moedas_foco() (migracao 011) e o servidor recalcula
 * os minutos pelo relogio dele. Aqui e para a tela poder mostrar o valor
 * antes de o servidor responder.
 */

export const TETO_DIARIO_MOEDAS = 500;
export const MINUTOS_MINIMOS = 5;
export const TETO_MINUTOS_SESSAO = 240;

/** Faixas de duracao (minutos) -> multiplicador. */
export const FAIXAS: { min: number; mult: number; rotulo: string }[] = [
  { min: 0, mult: 0, rotulo: 'curta demais' },
  { min: 5, mult: 0.5, rotulo: 'aquecimento' },
  { min: 15, mult: 1.0, rotulo: 'bloco' },
  { min: 25, mult: 1.25, rotulo: 'pomodoro' },
  { min: 50, mult: 1.5, rotulo: 'imersao' },
  { min: 90, mult: 1.75, rotulo: 'maratona' },
];

export const MULTIPLICADOR_MODO: Record<ModoEscudo, number> = {
  leve: 0.8,
  enem: 1.0,
  maratona: 1.2,
};

/** Quanto tempo cada modo pede antes de valer alguma coisa. */
export const META_MINUTOS_MODO: Record<ModoEscudo, number> = {
  leve: 15,
  enem: 25,
  maratona: 50,
};

export function faixaDe(minutos: number): { min: number; mult: number; rotulo: string } {
  let atual = FAIXAS[0];
  for (const f of FAIXAS) if (minutos >= f.min) atual = f;
  return atual;
}

export function penalidadeInterrupcoes(interrupcoes: number): number {
  return Math.max(0.4, 1 - 0.1 * Math.max(0, interrupcoes));
}

export interface CalculoMoedas {
  minutos: number;
  moedas: number;
  multiplicadorFaixa: number;
  multiplicadorModo: number;
  penalidade: number;
  faixa: string;
  limitadoPorTeto: boolean;
}

/**
 * Converte uma sessao offline em moedas.
 *
 * @param minutos       minutos de tela bloqueada
 * @param interrupcoes  quantas vezes o aluno voltou ao aparelho
 * @param modo          intensidade escolhida no inicio da sessao
 * @param jaGanhasHoje  moedas ja creditadas hoje (para aplicar o teto)
 */
export function calcularMoedas(
  minutos: number,
  interrupcoes = 0,
  modo: ModoEscudo = 'enem',
  jaGanhasHoje = 0,
): CalculoMoedas {
  const min = Math.max(0, Math.min(Math.floor(minutos), TETO_MINUTOS_SESSAO));
  const faixa = faixaDe(min);
  const multModo = MULTIPLICADOR_MODO[modo] ?? 1;
  const penalidade = penalidadeInterrupcoes(interrupcoes);

  /*
   * O arredondamento em 6 casas antes do piso nao e preciosismo: em
   * ponto flutuante, 60 * 1.5 * 0.7 da 62.99999999999999 e o floor
   * devolveria 62. O banco calcula o mesmo com numeric (exato) e diria
   * 63 - a tela mostraria uma moeda a menos do que o servidor credita.
   */
  const bruto = Math.floor(Number((min * faixa.mult * multModo * penalidade).toFixed(6)));
  const restante = Math.max(0, TETO_DIARIO_MOEDAS - Math.max(0, jaGanhasHoje));
  const moedas = Math.max(0, Math.min(bruto, restante));

  return {
    minutos: min,
    moedas,
    multiplicadorFaixa: faixa.mult,
    multiplicadorModo: multModo,
    penalidade,
    faixa: faixa.rotulo,
    limitadoPorTeto: bruto > moedas,
  };
}

/** Quantos minutos faltam para a proxima faixa (para a barra de progresso). */
export function proximaFaixa(minutos: number): { faltam: number; mult: number } | null {
  const proxima = FAIXAS.find((f) => f.min > minutos);
  return proxima ? { faltam: proxima.min - minutos, mult: proxima.mult } : null;
}

/**
 * Recompensas compraveis com moeda de foco.
 *
 * Sao itens que so fazem sentido no contexto de descanso, nao mais
 * conteudo: o aluno que ficou 2h offline nao precisa de outro simulado
 * como premio.
 */
export interface RecompensaFoco {
  id: string;
  nome: string;
  descricao: string;
  custo: number;
  icone: string;
}

export const RECOMPENSAS: RecompensaFoco[] = [
  { id: 'skin_sagui_noturno', nome: 'Sagui Noturno', descricao: 'Skin exclusiva do mascote para quem estuda no escuro.', custo: 300, icone: 'moon' },
  { id: 'pausa_sem_streak', nome: 'Escudo de Streak', descricao: 'Um dia de folga sem perder a sequencia.', custo: 450, icone: 'shield' },
  { id: 'pilula_extra', nome: 'Pilula sob medida', descricao: 'Um audio de 3 min gerado no tema que voce escolher.', custo: 200, icone: 'headphones' },
  { id: 'tema_amanhecer', nome: 'Tema Amanhecer', descricao: 'Paleta clara para os dias em que a tela escura cansa.', custo: 250, icone: 'sun' },
  { id: 'boost_xp', nome: 'Dobro de XP por 1h', descricao: 'Vale para a proxima hora de estudo no app.', custo: 350, icone: 'zap' },
];

/** Resumo de um periodo de sessoes offline, para o card de estatisticas. */
export function resumirSessoes(sessoes: SessaoOffline[]): {
  totalMinutos: number;
  totalMoedas: number;
  melhorSessao: number;
  media: number;
  sessoesHoje: number;
} {
  const hoje = new Date().toDateString();
  const totalMinutos = sessoes.reduce((a, s) => a + s.minutosOffline, 0);
  const totalMoedas = sessoes.reduce((a, s) => a + s.moedasCreditadas, 0);
  const melhorSessao = sessoes.reduce((a, s) => Math.max(a, s.minutosOffline), 0);
  return {
    totalMinutos,
    totalMoedas,
    melhorSessao,
    media: sessoes.length ? Math.round(totalMinutos / sessoes.length) : 0,
    sessoesHoje: sessoes.filter((s) => new Date(s.inicio).toDateString() === hoje).length,
  };
}

/** Moedas ja creditadas hoje - entrada do teto diario. */
export function moedasDeHoje(sessoes: SessaoOffline[]): number {
  const hoje = new Date().toDateString();
  return sessoes
    .filter((s) => new Date(s.inicio).toDateString() === hoje)
    .reduce((a, s) => a + s.moedasCreditadas, 0);
}
