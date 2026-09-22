import { clienteAtivo, falhou, getSupabase } from './supabaseHelpers';
import type { TurmaTermometro } from '../lib/termometroCognitivo';

/**
 * TERMOMETRO COGNITIVO — leitura do agregado por turma (migration 022).
 *
 * Repositorio proprio (e nao mais um metodo no SupabaseRepository, que ja
 * passa de 1200 linhas) seguindo o molde do FocusMetricsRepository.
 *
 * Leitura: erro nunca propaga. Aluno que abrir a tela por engano, conta
 * sem escola ou banco fora do ar caem todos no mesmo lugar — lista vazia
 * com aviso no console — e a tela mostra o estado "sem dados" em vez de
 * quebrar o painel inteiro.
 */
export class TermometroRepository {
  /** Mapa de calor das turmas da escola do docente nos ultimos `dias`. */
  async carregar(dias = 1): Promise<TurmaTermometro[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('termometro_cognitivo', { p_dias: dias });
    if (error) {
      falhou('termometroCognitivo', error);
      return [];
    }
    return (Array.isArray(data) ? data : []).map((r) => ({
      turmaId: String(r.turma_id ?? ''),
      turmaNome: String(r.turma_nome ?? 'Turma'),
      totalAlunos: Number(r.total_alunos ?? 0),
      comIndice: Number(r.com_indice ?? 0),
      exaustos: Number(r.exaustos ?? 0),
      emAlerta: Number(r.em_alerta ?? 0),
      scoreMedio: Number(r.score_medio ?? 0),
      minutosFocoMedio: Number(r.minutos_foco_medio ?? 0),
      distracoesMedia: Number(r.distracoes_media ?? 0),
      fracaoMadrugada: Number(r.fracao_madrugada ?? 0),
    }));
  }
}

export const termometroRepository = new TermometroRepository();
