import type { RevisaoEspacada } from '../types';

/**
 * CALENDARIO ADAPTATIVO - repeticao espacada (curva de Ebbinghaus).
 *
 * A curva de esquecimento diz que a retencao cai rapido nas primeiras
 * horas e desacelera depois; revisar EXATAMENTE quando ela se aproxima
 * do limiar reancora a memoria com o menor custo de tempo. Dai os
 * intervalos base 1, 3, 7, 21, 45 e 90 dias - cada nivel e cerca de 2 a
 * 3 vezes o anterior, que e o espacamento que a literatura de SRS
 * (Leitner, SM-2, Anki) converge.
 *
 * O QUE ESTE MOTOR ACRESCENTA AO SM-2 CLASSICO
 * O SM-2 pede que a pessoa se autoavalie ("lembrei facil?"). Adolescente
 * cansado nao autoavalia com honestidade, e um passo a mais na interface
 * e um passo a mais para abandonar. Aqui o q sai da NOTA DO QUIZ, que o
 * app ja tem: 0-100 vira 0-5 dividindo por 20. Ninguem precisa responder
 * nada.
 *
 * REGRA DURA: nota abaixo de 60 reinicia o topico no nivel 0 com revisao
 * amanha. Empurrar para 3 dias um conteudo que a pessoa nao sabe e
 * garantir que ela nao saiba dali a 3 dias tambem.
 *
 * Esta matematica esta duplicada em registrar_revisao() (migracao 011).
 * A duplicacao e proposital: o banco e a autoridade (o cliente poderia
 * mandar qualquer proxima_revisao), e aqui ficam a previa e o modo
 * offline. Se um lado mudar, o teste srsEngine.test.ts quebra a chave.
 */

/** Intervalo base por nivel de memoria, em dias. */
export const INTERVALOS_BASE = [1, 3, 7, 21, 45, 90];

export const NIVEL_MAXIMO = 5;
export const FACILIDADE_INICIAL = 2.5;
export const FACILIDADE_MINIMA = 1.3;
export const FACILIDADE_MAXIMA = 3.0;

/** Abaixo disso o topico volta para o inicio da curva. */
export const NOTA_REPROVACAO = 60;
/** A partir daqui o topico sobe de nivel. */
export const NOTA_PROMOCAO = 80;

export interface EstadoRevisao {
  nivelMemoria: number;
  facilidade: number;
  intervaloDias: number;
}

export interface ResultadoRevisao extends EstadoRevisao {
  proximaRevisao: string; // YYYY-MM-DD
  subiuDeNivel: boolean;
  reiniciou: boolean;
}

function iso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function somarDias(base: Date | string, dias: number): string {
  const d = typeof base === 'string' ? new Date(`${base}T12:00:00`) : new Date(base);
  d.setDate(d.getDate() + dias);
  return iso(d);
}

/**
 * Fator de facilidade do SM-2.
 *
 * EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
 *
 * O piso de 1.3 e do algoritmo original e existe por um motivo pratico:
 * sem ele, um topico dificil encolhe o intervalo ate voltar todo dia, e
 * o aluno passa a odiar aquele topico.
 */
export function ajustarFacilidade(facilidade: number, nota: number): number {
  const q = Math.round(Math.max(0, Math.min(nota, 100)) / 20); // 0..5
  const novo = facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.round(Math.max(FACILIDADE_MINIMA, Math.min(FACILIDADE_MAXIMA, novo)) * 100) / 100;
}

/**
 * Calcula o proximo estado de um topico a partir da nota do ultimo quiz.
 *
 * @param estado estado atual (ou undefined para topico novo)
 * @param nota   0-100 do quiz que acabou de ser feito
 * @param hoje   data de referencia (injetavel para testes)
 */
export function proximaRevisao(
  estado: EstadoRevisao | undefined,
  nota: number,
  hoje: Date | string = new Date(),
): ResultadoRevisao {
  const atual: EstadoRevisao = estado ?? {
    nivelMemoria: 0,
    facilidade: FACILIDADE_INICIAL,
    intervaloDias: 1,
  };

  const facilidade = ajustarFacilidade(atual.facilidade, nota);
  const reiniciou = nota < NOTA_REPROVACAO;
  const subiuDeNivel = nota >= NOTA_PROMOCAO && atual.nivelMemoria < NIVEL_MAXIMO;

  const nivelMemoria = reiniciou ? 0 : subiuDeNivel ? atual.nivelMemoria + 1 : atual.nivelMemoria;

  const intervaloDias = reiniciou
    ? 1
    : Math.max(1, Math.round(INTERVALOS_BASE[nivelMemoria] * (facilidade / FACILIDADE_INICIAL)));

  return {
    nivelMemoria,
    facilidade,
    intervaloDias,
    proximaRevisao: somarDias(hoje, intervaloDias),
    subiuDeNivel,
    reiniciou,
  };
}

/**
 * Forca da memoria estimada hoje, 0-100.
 *
 * Curva exponencial de Ebbinghaus: R = e^(-t/S), onde t sao os dias
 * desde a ultima revisao e S a estabilidade (o proprio intervalo, que
 * cresce com o nivel). Serve para o calendario colorir o que esta
 * "esfriando" antes de vencer, em vez de so mostrar o que ja venceu.
 */
export function forcaDaMemoria(revisao: RevisaoEspacada, hoje: Date = new Date()): number {
  if (!revisao.ultimaRevisao) return 0;
  const desde = (hoje.getTime() - new Date(`${revisao.ultimaRevisao}T12:00:00`).getTime()) / 86400000;
  const estabilidade = Math.max(1, revisao.intervaloDias);
  return Math.round(Math.exp(-Math.max(0, desde) / estabilidade) * 100);
}

export interface AgendaDoDia {
  data: string;
  revisoes: RevisaoEspacada[];
  atrasadas: number;
}

/**
 * Monta a agenda dos proximos N dias.
 *
 * Tudo que venceu antes de hoje entra no DIA DE HOJE, nao no passado:
 * um calendario que mostra tarefa em dia que ja passou so serve para
 * lembrar o aluno de que ele falhou.
 */
export function montarAgenda(
  revisoes: RevisaoEspacada[],
  dias = 14,
  hoje: Date = new Date(),
): AgendaDoDia[] {
  const hojeStr = iso(hoje);
  const agenda: AgendaDoDia[] = [];

  for (let i = 0; i < dias; i++) {
    const data = somarDias(hoje, i);
    const doDia = revisoes.filter((r) =>
      i === 0 ? r.proximaRevisao <= hojeStr : r.proximaRevisao === data,
    );
    agenda.push({
      data,
      revisoes: doDia,
      atrasadas: i === 0 ? doDia.filter((r) => r.proximaRevisao < hojeStr).length : 0,
    });
  }
  return agenda;
}

/** O que precisa ser revisado agora (vencido ou vencendo hoje). */
export function revisoesDeHoje(revisoes: RevisaoEspacada[], hoje: Date = new Date()): RevisaoEspacada[] {
  const hojeStr = iso(hoje);
  return revisoes
    .filter((r) => r.proximaRevisao <= hojeStr)
    .sort((a, b) => a.proximaRevisao.localeCompare(b.proximaRevisao));
}

/**
 * Distribui as revisoes do dia respeitando um teto.
 *
 * Depois de uma semana parado, a fila acumula 30 topicos e a tela vira
 * um muro. O teto empurra o excedente para os proximos dias, priorizando
 * o que esta ha mais tempo vencido e o que tem memoria mais fraca.
 */
export function limitarCargaDiaria(
  revisoes: RevisaoEspacada[],
  teto = 8,
  hoje: Date = new Date(),
): { hoje: RevisaoEspacada[]; adiadas: RevisaoEspacada[] } {
  const fila = revisoesDeHoje(revisoes, hoje).sort((a, b) => {
    const porData = a.proximaRevisao.localeCompare(b.proximaRevisao);
    if (porData !== 0) return porData;
    return forcaDaMemoria(a, hoje) - forcaDaMemoria(b, hoje);
  });
  return { hoje: fila.slice(0, teto), adiadas: fila.slice(teto) };
}

/** Rotulo do nivel, para a interface. */
export const ROTULO_NIVEL = [
  'Primeiro contato',
  'Reconhece',
  'Lembra com esforco',
  'Lembra rapido',
  'Consolidado',
  'Automatico',
];
