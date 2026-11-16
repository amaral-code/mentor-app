import { clienteAtivo, exigir, falhou, getSupabase } from './supabaseHelpers';

/**
 * ACOMPANHAMENTO DO ESTUDANTE — o que o responsável vê (migration 025).
 *
 * Tudo aqui vem de função `SECURITY DEFINER` que devolve AGREGADO, e não
 * de `select` em tabela. O motivo não é arquitetura: `telemetria_estudo`
 * é 100% do aluno por decisão de produto, porque cada linha ali é uma
 * questão específica — matéria, dificuldade, hora, acerto. Isso é
 * conteúdo. O responsável recebe padrão: quantos minutos, que proporção
 * de acerto, em quantos dias.
 *
 * É esse trato que mantém o aluno respondendo com honestidade dentro do
 * app, que é de onde todo sinal útil vem.
 *
 * Leitura que falha vira lista vazia com aviso no console (a tela mostra
 * o que conseguiu); só a ficha propaga, porque sem o nome do estudante o
 * painel não tem cabeçalho.
 */

export interface ResumoMensal {
  /** Primeiro dia do mês, 'AAAA-MM-DD'. */
  mes: string;
  minutos: number;
  questoes: number;
  acertos: number;
  /** 0-100. Mês sem questão devolve 0, não nulo — o gráfico desenha o zero. */
  taxaAcerto: number;
  diasAtivos: number;
}

export interface ResumoSemanal {
  /** Segunda-feira da semana, 'AAAA-MM-DD'. */
  semana: string;
  minutos: number;
  questoes: number;
}

export interface MateriaResumo {
  materia: string;
  questoes: number;
  acertos: number;
  taxaAcerto: number;
}

export interface FichaAluno {
  nome: string;
  escola: string | null;
  turma: string | null;
  desde: string | null;
}

export class AcompanhamentoRepository {
  async resumoMensal(alunoId: string, meses = 6): Promise<ResumoMensal[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('resumo_mensal_aluno', { p_aluno: alunoId, p_meses: meses });
    if (error) {
      falhou('resumo_mensal_aluno', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      mes: r.mes,
      minutos: Number(r.minutos) || 0,
      questoes: Number(r.questoes) || 0,
      acertos: Number(r.acertos) || 0,
      taxaAcerto: Number(r.taxa_acerto) || 0,
      diasAtivos: Number(r.dias_ativos) || 0,
    }));
  }

  async resumoSemanal(alunoId: string, semanas = 4): Promise<ResumoSemanal[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('resumo_semanal_aluno', { p_aluno: alunoId, p_semanas: semanas });
    if (error) {
      falhou('resumo_semanal_aluno', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      semana: r.semana,
      minutos: Number(r.minutos) || 0,
      questoes: Number(r.questoes) || 0,
    }));
  }

  async materias(alunoId: string, meses = 3): Promise<MateriaResumo[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('materias_aluno', { p_aluno: alunoId, p_meses: meses });
    if (error) {
      falhou('materias_aluno', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      materia: r.materia,
      questoes: Number(r.questoes) || 0,
      acertos: Number(r.acertos) || 0,
      taxaAcerto: Number(r.taxa_acerto) || 0,
    }));
  }

  async ficha(alunoId: string): Promise<FichaAluno | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('ficha_aluno', { p_aluno: alunoId });
    if (error) exigir('ficha_aluno', error);
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r) return null;
    return { nome: r.nome, escola: r.escola ?? null, turma: r.turma ?? null, desde: r.desde ?? null };
  }
}

export const acompanhamentoRepository = new AcompanhamentoRepository();
