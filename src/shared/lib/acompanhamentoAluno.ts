import type { ResumoMensal, ResumoSemanal } from '../storage/AcompanhamentoRepository';
import type { StudentMonthlyRecord } from './dropoutRisk';

/**
 * Do agregado do banco para o que o painel dos pais desenha.
 *
 * A regra que manda aqui é a de NÃO INVENTAR. O painel antigo era mock:
 * doze meses de nota escolar escritos à mão e uma projeção de evasão
 * rodando em cima. Com dado real aparece o caso que o mock escondia — o
 * estudante que acabou de entrar e tem duas semanas de uso.
 *
 * Regressão linear sobre três pontos quase vazios devolve uma reta com
 * inclinação enorme e um rótulo "Alto risco" com cara de conclusão. Por
 * isso `dadosSuficientes` existe e o painel só mostra a projeção depois
 * dela: é melhor dizer "ainda não dá para dizer" do que assustar um pai
 * com estatística de nada.
 *
 * E não há NOTA ESCOLAR em lugar nenhum deste banco. O que estas funções
 * chamam de desempenho é o acerto nos exercícios do app — o rótulo da
 * tela precisa dizer isso com essas palavras.
 */

const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Mínimo para a tendência significar alguma coisa. */
export const MESES_MINIMOS_TENDENCIA = 3;
export const QUESTOES_MINIMAS_TENDENCIA = 20;

/**
 * 'AAAA-MM-DD' -> 'Set'. Sem `new Date(iso)`: a string é meia-noite UTC
 * e, num fuso a oeste, o dia 1 volta para o mês anterior — o gráfico
 * mostraria o mês errado em todo o Brasil.
 */
export function rotuloMes(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  return MES_CURTO[Number(m[2]) - 1] ?? iso;
}

/** 'AAAA-MM-DD' -> '15/09' (a segunda-feira daquela semana). */
export function rotuloSemana(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[2]}/${m[1]}` : (iso ?? '');
}

/** 'AAAA-MM-DD' -> 'AAAA-MM', que é o formato do motor de evasão. */
export function paraMesCurto(iso: string): string {
  return (iso ?? '').slice(0, 7);
}

/**
 * O que o motor de evasão consome. `notaMedia` recebe a taxa de acerto
 * no app, e não nota escolar — que não existe no banco.
 */
export function paraRegistrosMensais(resumo: ResumoMensal[]): StudentMonthlyRecord[] {
  return resumo.map((r) => ({
    month: paraMesCurto(r.mes),
    notaMedia: r.taxaAcerto,
    tempoUso: Math.round((r.minutos / 60) * 10) / 10,
  }));
}

export interface TotaisPeriodo {
  minutos: number;
  questoes: number;
  acertos: number;
  /** 0-100, calculada sobre o período inteiro (não é média das médias). */
  taxaAcerto: number;
  diasAtivos: number;
  mesesComAtividade: number;
}

export function totaisDoPeriodo(resumo: ResumoMensal[]): TotaisPeriodo {
  const t = resumo.reduce(
    (a, r) => ({
      minutos: a.minutos + r.minutos,
      questoes: a.questoes + r.questoes,
      acertos: a.acertos + r.acertos,
      diasAtivos: a.diasAtivos + r.diasAtivos,
      mesesComAtividade: a.mesesComAtividade + (r.questoes > 0 ? 1 : 0),
    }),
    { minutos: 0, questoes: 0, acertos: 0, diasAtivos: 0, mesesComAtividade: 0 },
  );
  return {
    ...t,
    // Sobre o total, e não média das taxas mensais: um mês com 2 questões
    // pesaria igual a um mês com 200.
    taxaAcerto: t.questoes > 0 ? Math.round((t.acertos * 100) / t.questoes) : 0,
  };
}

/**
 * Se dá para falar em tendência. Exige meses com atividade DE VERDADE e
 * um volume mínimo de questões — os dois, porque cada um sozinho deixa
 * passar um caso ruim: 3 meses de 2 questões, ou 200 questões num mês só.
 */
export function dadosSuficientes(resumo: ResumoMensal[]): boolean {
  const t = totaisDoPeriodo(resumo);
  return t.mesesComAtividade >= MESES_MINIMOS_TENDENCIA && t.questoes >= QUESTOES_MINIMAS_TENDENCIA;
}

/** Falta quanto para a projeção aparecer — vira frase na tela. */
export function faltaParaTendencia(resumo: ResumoMensal[]): { meses: number; questoes: number } {
  const t = totaisDoPeriodo(resumo);
  return {
    meses: Math.max(0, MESES_MINIMOS_TENDENCIA - t.mesesComAtividade),
    questoes: Math.max(0, QUESTOES_MINIMAS_TENDENCIA - t.questoes),
  };
}

/** Horas por semana, arredondadas a uma casa, para o gráfico de barras. */
export function horasPorSemana(semanal: ResumoSemanal[]): { rotulo: string; horas: number }[] {
  return semanal.map((s) => ({
    rotulo: rotuloSemana(s.semana),
    horas: Math.round((s.minutos / 60) * 10) / 10,
  }));
}

/** Nunca teve atividade nenhuma: a tela precisa dizer isso, não zerar. */
export function semAtividade(resumo: ResumoMensal[]): boolean {
  return resumo.every((r) => r.questoes === 0);
}
