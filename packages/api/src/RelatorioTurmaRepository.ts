import type { LinhaRelatorioTurma, ResumoTurma } from '@mentor/core/relatorioTurma';
import { getSupabase } from './supabase';
import type { LinhaRpc } from './tiposBanco';

/**
 * Relatório da turma (#60). O escopo é do banco: `resumo_turma` e
 * `relatorio_turma` recusam turma fora de `minhas_turmas()`.
 */
export class RelatorioTurmaRepository {
  async carregar(turmaId: string, dias: number): Promise<{ resumo: ResumoTurma | null; linhas: LinhaRelatorioTurma[] }> {
    const sb = getSupabase();
    if (!sb) return { resumo: null, linhas: [] };
    const [r, l] = await Promise.all([
      sb.rpc('resumo_turma', { p_turma: turmaId, p_dias: dias }),
      sb.rpc('relatorio_turma', { p_turma: turmaId, p_dias: dias }),
    ]);
    if (r.error) throw new Error(r.error.message);
    if (l.error) throw new Error(l.error.message);
    const linhaResumo = Array.isArray(r.data) ? r.data[0] : r.data;
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      resumo: linhaResumo
        ? {
            turmaNome: linhaResumo.turma_nome ?? 'sem turma',
            totalAlunos: Number(linhaResumo.total_alunos) || 0,
            alunosAtivos: Number(linhaResumo.alunos_ativos) || 0,
            respostas: Number(linhaResumo.respostas) || 0,
            taxaAcerto: num(linhaResumo.taxa_acerto),
          }
        : null,
      linhas: ((l.data ?? []) as LinhaRpc<'relatorio_turma'>[]).map((x) => ({
        materia: x.materia,
        topico: x.topico,
        alunosMedidos: Number(x.alunos_medidos) || 0,
        alunosComDificuldade: Number(x.alunos_com_dificuldade) || 0,
        respostas: Number(x.respostas) || 0,
        taxaAcerto: num(x.taxa_acerto),
      })),
    };
  }
}

export const relatorioTurmaRepository = new RelatorioTurmaRepository();
