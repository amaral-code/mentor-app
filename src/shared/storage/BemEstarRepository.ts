import { clienteAtivo, exigir, falhou, getSupabase, uidAtual } from './supabaseHelpers';
import type {
  ClasseBurnout,
  EventoTelemetria,
  IndiceBurnout,
  IntervencaoIA,
  MetricasDescompressao,
  RelatorioSemanal,
} from '../types';

/**
 * TELEMETRIA, BURNOUT, INTERVENCOES E RELATORIO SEMANAL.
 *
 * A telemetria e gravada em LOTE (flush a cada bloco de questoes ou ao
 * sair da tela), nao a cada resposta. Um insert por questao significa 90
 * requisicoes num simulado, em 4G, com o app parecendo travado - e o
 * dado nao vale isso: ele so e lido em janelas de 7 dias.
 *
 * O score de burnout tambem nao e escrito direto: vai por
 * registrar_burnout(), que garante uma linha por dia e dispara o alerta
 * aos responsaveis no maximo uma vez ao dia.
 */
export class BemEstarRepository {
  // =================================================================
  // Telemetria
  // =================================================================

  async salvarTelemetria(eventos: EventoTelemetria[]): Promise<void> {
    if (!clienteAtivo() || eventos.length === 0) return;
    const sb = getSupabase()!;
    const uid = await uidAtual();
    if (!uid) return;

    const linhas = eventos.map((e) => ({
      user_id: uid,
      question_id: e.questionId.slice(0, 80),
      materia: e.materia,
      dificuldade: e.dificuldade,
      tempo_gasto_segundos: Math.max(0, Math.round(e.tempoGastoSegundos)),
      acertou: e.acertou,
      hora_local: e.horaLocal,
      criado_em: new Date(e.timestamp).toISOString(),
    }));

    const { error } = await sb.from('telemetria_estudo').insert(linhas);
    if (error) exigir('salvarTelemetria', error);
  }

  async carregarTelemetria(dias = 14): Promise<EventoTelemetria[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const { data, error } = await sb
      .from('telemetria_estudo')
      .select('question_id, materia, dificuldade, tempo_gasto_segundos, acertou, hora_local, criado_em')
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(2000);

    if (error) {
      falhou('carregarTelemetria', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      questionId: r.question_id,
      materia: r.materia ?? '',
      dificuldade: r.dificuldade,
      tempoGastoSegundos: r.tempo_gasto_segundos,
      acertou: r.acertou,
      horaLocal: r.hora_local ?? new Date(r.criado_em).getHours(),
      timestamp: new Date(r.criado_em).getTime(),
    }));
  }

  // =================================================================
  // Indice de burnout
  // =================================================================

  /**
   * Grava o indice do dia. Devolve o id do alerta quando o banco decide
   * dispara-lo (fadiga/esgotamento e nenhum alerta hoje).
   */
  async registrarBurnout(
    score: number,
    classe: ClasseBurnout,
    features: Record<string, number>,
  ): Promise<{ alertaId: string | null }> {
    if (!clienteAtivo()) return { alertaId: null };
    const sb = getSupabase()!;

    const { data, error } = await sb.rpc('registrar_burnout', {
      p_score: Math.round(score),
      p_classe: classe,
      p_features: features,
    });

    if (error) exigir('registrar_burnout', error);
    const row: any = Array.isArray(data) ? data[0] : data;
    return { alertaId: row?.alerta_id ?? null };
  }

  /**
   * Zera a base do modelo (migration 017): apaga telemetria e serie do
   * proprio aluno via RPC. Devolve false sem jogar erro — o chamador
   * decide o que contar ao aluno (offline = reset so local).
   */
  async reiniciarIndice(): Promise<boolean> {
    if (!clienteAtivo()) return false;
    try {
      const sb = getSupabase()!;
      const { error } = await sb.rpc('reiniciar_indice');
      return !error;
    } catch {
      return false;
    }
  }

  /** Serie do indice. Sem alunoId, o proprio; com, um filho vinculado. */  async carregarBurnout(dias = 30, alunoId?: string): Promise<IndiceBurnout[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

    let consulta = sb
      .from('indice_burnout')
      .select('data, score, classe, features, user_id')
      .gte('data', desde)
      .order('data', { ascending: true });
    if (alunoId) consulta = consulta.eq('user_id', alunoId);

    const { data, error } = await consulta;
    if (error) {
      falhou('carregarBurnout', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      data: r.data,
      score: r.score,
      classe: r.classe,
      features: r.features ?? {},
    }));
  }

  // =================================================================
  // Intervencoes da IA
  // =================================================================

  async registrarIntervencao(i: IntervencaoIA): Promise<number | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('registrar_intervencao', {
      p_tipo: i.tipo,
      p_mensagem: i.mensagem,
      p_gatilho: i.gatilho ?? {},
    });
    if (error) {
      // Registro de telemetria comportamental: se falhar, a intervencao
      // ainda aparece para o aluno. Avisar sobre isso seria ruido.
      falhou('registrar_intervencao', error);
      return null;
    }
    return typeof data === 'number' ? data : null;
  }

  async responderIntervencao(id: number, aceita: boolean): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('responder_intervencao', { p_id: id, p_aceita: aceita });
    if (error) falhou('responder_intervencao', error);
  }

  async listarIntervencoes(limite = 50): Promise<IntervencaoIA[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('log_intervencoes_ia')
      .select('id, tipo, mensagem, gatilho, aceita, criado_em')
      .order('criado_em', { ascending: false })
      .limit(limite);

    if (error) {
      falhou('listarIntervencoes', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      mensagem: r.mensagem,
      gatilho: r.gatilho ?? {},
      aceita: r.aceita,
      criadoEm: r.criado_em,
    }));
  }

  // =================================================================
  // Relatorio semanal
  // =================================================================

  async salvarRelatorio(
    semanaInicio: string,
    texto: string,
    metricas: MetricasDescompressao,
  ): Promise<RelatorioSemanal | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('salvar_relatorio_semanal', {
      p_semana_inicio: semanaInicio,
      p_texto: texto,
      p_metricas: metricas,
    });
    if (error) exigir('salvar_relatorio_semanal', error);

    const r: any = Array.isArray(data) ? data[0] : data;
    return r
      ? {
          id: r.id,
          semanaInicio: r.semana_inicio,
          textoGerado: r.texto_gerado,
          metricas: r.metricas,
          lido: r.lido,
        }
      : null;
  }

  async listarRelatorios(limite = 8, alunoId?: string): Promise<RelatorioSemanal[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    let consulta = sb
      .from('relatorios_semanais')
      .select('id, semana_inicio, texto_gerado, metricas, lido, user_id')
      .order('semana_inicio', { ascending: false })
      .limit(limite);
    if (alunoId) consulta = consulta.eq('user_id', alunoId);

    const { data, error } = await consulta;
    if (error) {
      falhou('listarRelatorios', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      semanaInicio: r.semana_inicio,
      textoGerado: r.texto_gerado,
      metricas: r.metricas ?? {},
      lido: r.lido,
    }));
  }

  async marcarRelatorioLido(id: number): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb
      .from('relatorios_semanais')
      .update({ lido: true, lido_em: new Date().toISOString() })
      .eq('id', id);
    if (error) falhou('marcarRelatorioLido', error);
  }
}

export const bemEstarRepository = new BemEstarRepository();
