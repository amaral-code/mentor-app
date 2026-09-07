import { clienteAtivo, exigir, falhou, getSupabase, uidAtual } from './supabaseHelpers';
import type { ModuloAudio, ProgressoAudio, RevisaoEspacada } from '../types';

/**
 * CONTEUDO ADAPTATIVO - pilulas de audio e revisao espacada.
 *
 * Sobre o AUDIO: o mp3 nao e guardado no banco. Um arquivo de 3 minutos
 * tem ~1,5 MB, e sintetizar de novo custa fracoes de centavo - guardar
 * base64 em coluna de texto encareceria backup e leitura de catalogo
 * para sempre. O que fica gravado e o ROTEIRO (texto), que e o caro de
 * produzir; o audio vira cache local do aparelho.
 *
 * Sobre a REVISAO: o proximo intervalo e calculado por registrar_revisao()
 * no banco. srsEngine.ts existe para a previa e para funcionar offline,
 * mas a data que vale e a que volta daqui.
 */
export class ConteudoRepository {
  // =================================================================
  // Pilulas de audio
  // =================================================================

  async listarModulos(materia?: string): Promise<ModuloAudio[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    let consulta = sb
      .from('modulos_audio')
      .select('id, materia, topico, titulo, resumo, roteiro, audio_url, duracao_segundos, voz')
      .order('materia');
    if (materia) consulta = consulta.eq('materia', materia);

    const { data, error } = await consulta;
    if (error) {
      falhou('listarModulos', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      materia: r.materia,
      topico: r.topico,
      titulo: r.titulo,
      resumo: r.resumo ?? '',
      roteiro: r.roteiro,
      audioUrl: r.audio_url,
      duracaoSegundos: r.duracao_segundos,
      voz: r.voz ?? 'pt-BR-Neural2-A',
    }));
  }

  async carregarProgresso(): Promise<Record<string, ProgressoAudio>> {
    if (!clienteAtivo()) return {};
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('progresso_audio')
      .select('modulo_id, segundos_ouvidos, concluido');

    if (error) {
      falhou('carregarProgressoAudio', error);
      return {};
    }
    const mapa: Record<string, ProgressoAudio> = {};
    for (const r of data ?? []) {
      mapa[r.modulo_id] = {
        moduloId: r.modulo_id,
        segundosOuvidos: r.segundos_ouvidos,
        concluido: r.concluido,
      };
    }
    return mapa;
  }

  /**
   * Salva onde o aluno parou.
   *
   * Chamado em intervalos (a cada 15 s de reproducao) e ao pausar - nao
   * a cada timeupdate, que dispara 4 vezes por segundo.
   */
  async salvarProgresso(moduloId: string, segundos: number, concluido: boolean): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const uid = await uidAtual();
    if (!uid) return;

    const { error } = await sb.from('progresso_audio').upsert(
      {
        user_id: uid,
        modulo_id: moduloId,
        segundos_ouvidos: Math.max(0, Math.round(segundos)),
        concluido,
        ouvido_em: concluido ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'user_id,modulo_id' },
    );
    if (error) falhou('salvarProgressoAudio', error);
  }

  // =================================================================
  // Revisao espacada
  // =================================================================

  async listarRevisoes(): Promise<RevisaoEspacada[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('revisoes_espacadas')
      .select('id, topico_id, topico_nome, materia, nivel_memoria, intervalo_dias, facilidade, ultima_nota, revisoes_feitas, proxima_revisao, ultima_revisao')
      .order('proxima_revisao', { ascending: true });

    if (error) {
      falhou('listarRevisoes', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      topicoId: r.topico_id,
      topicoNome: r.topico_nome,
      materia: r.materia ?? '',
      nivelMemoria: r.nivel_memoria,
      intervaloDias: r.intervalo_dias,
      facilidade: Number(r.facilidade),
      ultimaNota: r.ultima_nota ?? undefined,
      revisoesFeitas: r.revisoes_feitas,
      proximaRevisao: r.proxima_revisao,
      ultimaRevisao: r.ultima_revisao,
    }));
  }

  /** Agenda (ou reagenda) um topico a partir da nota do ultimo quiz. */
  async registrarRevisao(
    topicoId: string,
    topicoNome: string,
    materia: string,
    nota: number,
  ): Promise<RevisaoEspacada | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;

    const { data, error } = await sb.rpc('registrar_revisao', {
      p_topico_id: topicoId,
      p_topico_nome: topicoNome,
      p_materia: materia,
      p_nota: Math.round(nota),
    });

    if (error) exigir('registrar_revisao', error);
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r) return null;

    return {
      id: r.id,
      topicoId: r.topico_id,
      topicoNome: r.topico_nome,
      materia: r.materia ?? '',
      nivelMemoria: r.nivel_memoria,
      intervaloDias: r.intervalo_dias,
      facilidade: Number(r.facilidade),
      ultimaNota: r.ultima_nota ?? undefined,
      revisoesFeitas: r.revisoes_feitas,
      proximaRevisao: r.proxima_revisao,
      ultimaRevisao: r.ultima_revisao,
    };
  }

  async removerRevisao(topicoId: string): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.from('revisoes_espacadas').delete().eq('topico_id', topicoId);
    if (error) exigir('removerRevisao', error);
  }
}

export const conteudoRepository = new ConteudoRepository();
