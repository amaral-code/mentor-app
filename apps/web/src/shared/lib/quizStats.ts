import type { DesempenhoTopico } from '../storage/SupabaseRepository';

/**
 * ANALYTICS DO QUIZ - agregacao pura do placar por topico.
 *
 * O banco guarda contadores (acertos/erros por materia+topico); tudo que
 * e percentual, ranking e "onde focar" e calculado aqui, sem I/O - a
 * tela so exibe e os testes nao precisam de rede.
 */

export interface LinhaTopico {
  materia: string;
  topico: string;
  acertos: number;
  erros: number;
  total: number;
  /** 0-100. Sem respostas, 0 (nunca divide por zero). */
  aproveitamento: number;
}

export interface LinhaMateria {
  materia: string;
  acertos: number;
  erros: number;
  total: number;
  aproveitamento: number;
  topicos: LinhaTopico[];
}

export interface ResumoEstatisticas {
  totalQuestoes: number;
  totalAcertos: number;
  aproveitamentoGeral: number;
  porMateria: LinhaMateria[];
  /** Topicos com pelo menos 3 respostas, do pior para o melhor. */
  pontosFracos: LinhaTopico[];
}

const pct = (acertos: number, total: number): number =>
  total > 0 ? Math.round((acertos / total) * 100) : 0;

const ROTULO_TOPICO_VAZIO = 'Geral';

/** Agrega as linhas do banco em resumo pronto para a tela. */
export function calcularEstatisticas(rows: DesempenhoTopico[]): ResumoEstatisticas {
  const porMateria = new Map<string, LinhaMateria>();
  let totalQuestoes = 0;
  let totalAcertos = 0;

  for (const r of rows ?? []) {
    const acertos = Math.max(0, r.acertos || 0);
    const erros = Math.max(0, r.erros || 0);
    const total = acertos + erros;
    if (total === 0) continue;
    totalQuestoes += total;
    totalAcertos += acertos;

    let mat = porMateria.get(r.materia);
    if (!mat) {
      mat = { materia: r.materia, acertos: 0, erros: 0, total: 0, aproveitamento: 0, topicos: [] };
      porMateria.set(r.materia, mat);
    }
    mat.acertos += acertos;
    mat.erros += erros;
    mat.total += total;
    mat.topicos.push({
      materia: r.materia,
      topico: r.topico || ROTULO_TOPICO_VAZIO,
      acertos,
      erros,
      total,
      aproveitamento: pct(acertos, total),
    });
  }

  const materias = [...porMateria.values()].map((m) => ({
    ...m,
    aproveitamento: pct(m.acertos, m.total),
    topicos: m.topicos.sort((a, b) => a.aproveitamento - b.aproveitamento),
  }));
  // Materias com mais volume primeiro: e onde o retrato e mais confiavel.
  materias.sort((a, b) => b.total - a.total);

  // Ponto fraco = topico com amostra minima (3+) e aproveitamento < 70,
  // do pior para o melhor. Sem amostra minima, e ruido, nao diagnostico.
  const pontosFracos = materias
    .flatMap((m) => m.topicos)
    .filter((t) => t.total >= 3 && t.aproveitamento < 70)
    .sort((a, b) => a.aproveitamento - b.aproveitamento || b.total - a.total);

  return {
    totalQuestoes,
    totalAcertos,
    aproveitamentoGeral: pct(totalAcertos, totalQuestoes),
    porMateria: materias,
    pontosFracos,
  };
}
