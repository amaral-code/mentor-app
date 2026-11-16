import { clienteAtivo, exigir, falhou, getSupabase } from './supabaseHelpers';

/**
 * ESCOPO DO DOCENTE (migration 026).
 *
 * Antes desta camada, `teacher` e `educator` liam exatamente a mesma
 * coisa: os agregados de todas as turmas da escola. O professor de uma
 * sala via o mapa de fadiga de salas que nunca pisou.
 *
 * Quem decide o escopo é `minhas_turmas()`, no banco. O front usa a
 * mesma lista só para exibir o que faz sentido; esconder card aqui não
 * protegeria nada, porque a função continua chamável pelo console.
 *
 * Vincular e desvincular é da secretaria (educator/admin) e o servidor
 * confere de novo, inclusive se a turma e o docente são da mesma escola.
 */

export interface TurmaDoDocente {
  id: string;
  nome: string;
}

export interface DocenteDaEscola {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

export class DocenteRepository {
  /** Turmas no escopo de quem está logado. Vazio = sem vínculo ainda. */
  async minhasTurmas(): Promise<TurmaDoDocente[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('minhas_turmas');
    if (error) {
      falhou('minhas_turmas', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({ id: r.id, nome: r.nome }));
  }

  /** Só a secretaria. Erro de permissão vira lista vazia na tela. */
  async docentesDaEscola(): Promise<DocenteDaEscola[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('docentes_da_escola');
    if (error) {
      falhou('docentes_da_escola', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      email: r.email ?? '',
      papel: r.papel ?? 'teacher',
    }));
  }

  async professoresDaTurma(turmaId: string): Promise<DocenteDaEscola[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('professores_da_turma', { p_turma: turmaId });
    if (error) {
      falhou('professores_da_turma', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      email: r.email ?? '',
      papel: 'teacher',
    }));
  }

  async atribuir(professorId: string, turmaId: string): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.rpc('atribuir_professor_turma', {
      p_professor: professorId,
      p_turma: turmaId,
    });
    if (error) exigir('atribuir_professor_turma', error);
  }

  async remover(professorId: string, turmaId: string): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.rpc('remover_professor_turma', {
      p_professor: professorId,
      p_turma: turmaId,
    });
    if (error) exigir('remover_professor_turma', error);
  }
}

export const docenteRepository = new DocenteRepository();
