/**
 * Calendário mensal da revisão espaçada, e os lembretes que dele saem.
 *
 * O srsEngine já sabe QUANDO cada tópico volta. Faltava a visão de mês
 * do app nativo (#41) e a lista que a notificação local vai usar (M5).
 * Tudo no fuso do aparelho: o web comparava a data da revisão com
 * `toISOString()`, que é UTC, e às 22h de Brasília a revisão de amanhã
 * já aparecia como "atrasada".
 */
import type { RevisaoEspacada } from './types';

/** AAAA-MM-DD no fuso do aparelho. */
export function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function estaAtrasada(r: Pick<RevisaoEspacada, 'proximaRevisao'>, hoje: Date = new Date()): boolean {
  return r.proximaRevisao < diaLocal(hoje);
}

export interface DiaDoCalendario {
  data: string;
  dia: number;
  doMes: boolean;
  hoje: boolean;
  passado: boolean;
  /** Revisões marcadas para o dia. As vencidas contam no dia de HOJE. */
  quantidade: number;
}

export const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const INICIAIS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Semanas do mês (domingo a sábado), com as revisões de cada dia.
 *
 * Revisão vencida não fica pintada no dia que já passou: entra no dia de
 * hoje, como no `montarAgenda`. Calendário que mostra tarefa em dia
 * passado só serve para lembrar o aluno de que ele falhou.
 */
export function semanasDoMes(ano: number, mes: number, revisoes: RevisaoEspacada[], hoje: Date = new Date()): DiaDoCalendario[][] {
  const hojeStr = diaLocal(hoje);
  const contagem = new Map<string, number>();
  for (const r of revisoes) {
    const chave = r.proximaRevisao < hojeStr ? hojeStr : r.proximaRevisao;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const primeiro = new Date(ano, mes, 1, 12);
  const inicio = new Date(ano, mes, 1 - primeiro.getDay(), 12);
  const semanas: DiaDoCalendario[][] = [];
  const cursor = new Date(inicio);
  do {
    const semana: DiaDoCalendario[] = [];
    for (let i = 0; i < 7; i++) {
      const data = diaLocal(cursor);
      semana.push({
        data,
        dia: cursor.getDate(),
        doMes: cursor.getMonth() === mes,
        hoje: data === hojeStr,
        passado: data < hojeStr,
        quantidade: contagem.get(data) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(semana);
  } while (cursor.getMonth() === mes);
  return semanas;
}

/** Revisões de um dia escolhido no calendário (hoje inclui as vencidas). */
export function revisoesDoDia(revisoes: RevisaoEspacada[], data: string, hoje: Date = new Date()): RevisaoEspacada[] {
  const hojeStr = diaLocal(hoje);
  return revisoes
    .filter((r) => (data === hojeStr ? r.proximaRevisao <= hojeStr : r.proximaRevisao === data))
    .sort((a, b) => a.proximaRevisao.localeCompare(b.proximaRevisao) || a.topicoNome.localeCompare(b.topicoNome));
}

export interface Lembrete {
  data: string;
  quantidade: number;
  titulo: string;
  corpo: string;
}

/**
 * Um lembrete por dia com revisão, para a notificação local (M5).
 *
 * O corpo diz QUANTOS tópicos e de que matérias, nunca o nome do tópico:
 * notificação aparece na tela bloqueada, e "Revisar: reprodução humana"
 * na tela de um adolescente, à vista da família, não é escolha do app.
 */
export function lembretesDeRevisao(revisoes: RevisaoEspacada[], dias = 7, hoje: Date = new Date()): Lembrete[] {
  const hojeStr = diaLocal(hoje);
  const porDia = new Map<string, RevisaoEspacada[]>();
  for (const r of revisoes) {
    const chave = r.proximaRevisao < hojeStr ? hojeStr : r.proximaRevisao;
    porDia.set(chave, [...(porDia.get(chave) ?? []), r]);
  }
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias - 1, 12);
  const limiteStr = diaLocal(limite);
  return [...porDia.entries()]
    .filter(([data]) => data <= limiteStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, lista]) => {
      const materias = [...new Set(lista.map((r) => r.materia).filter(Boolean))].slice(0, 3);
      const n = lista.length;
      return {
        data,
        quantidade: n,
        titulo: n === 1 ? '1 revisão para hoje' : `${n} revisões para hoje`,
        corpo: materias.length > 0 ? `De ${materias.join(', ')}. Cinco minutos seguram a memória.` : 'Cinco minutos seguram a memória.',
      };
    });
}
