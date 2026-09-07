import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { hashEnunciado } from '../lib/quizHistory';
import type {
  ChallengeResult,
  ChatMessage,
  ChatPersona,
  CommunityMessage,
  Conversa,
  DailyPlan,
  EssayCorrection,
  GamificationState,
  LogEntry,
  LogEventType,
  MoodType,
  Nota,
  QuizResult,
} from '../types';

/**
 * Acesso a dados - escrito contra o schema REAL do projeto
 * (003_schema_completo.sql), nao contra o 001 que nunca foi aplicado.
 *
 * Duas mudancas estruturais em relacao a versao anterior:
 *
 * 1. POSSE VIA auth.uid()
 * Antes o dono era um `uid text`lido do localStorage - ou seja, o
 * proprio usuario escolhia de quem eram os dados. Agora o `user_id`sai
 * da sessao e a RLS confere contra o JWT; forjar nao adianta.
 *
 * 2. XP SO PELO SERVIDOR
 * `gamificacao`nao tem policy de escrita e o privilegio foi revogado.
 * XP entra unicamente por registrar_xp(), que limita o valor por evento
 * e recalcula nivel e streak. Sem isso o ranking seria ficcao.
 */

/** Erro do PostgREST logado com contexto, em vez de engolido. */
function falhou(op: string, error: unknown): void {
  if (error) console.warn(`[supabase] ${op} falhou:`, error);
}

/**
 * Registra E propaga a falha.
 *
 * `falhou` apenas escreve no console e o metodo segue retornando null ou
 * void. Para LEITURA isso e aceitavel: a tela mostra o que conseguiu. Para
 * ESCRITA nao: quem chamou precisa saber que o dado nao foi gravado, senao
 * a interface confirma para o aluno algo que nao aconteceu.
 *
 * O tipo `never` deixa explicito para o TypeScript que nada depois disto
 * executa, e por isso os `return null` seguintes puderam ser removidos.
 */
function exigir(op: string, error: unknown): never {
  console.warn(`[supabase] ${op} falhou:`, error);
  throw new Error(`${op} falhou`);
}

/** Placar de acertos/erros de um topico (tela de Estatisticas). */
export interface DesempenhoTopico {
  materia: string;
  topico: string;
  acertos: number;
  erros: number;
}

export class SupabaseRepository {
  private async uid(): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  }

  private ativo(): boolean {
    return isSupabaseConfigured() && !!getSupabase();
  }

  // ===================================================================
  // Gamificacao
  // ===================================================================

  async loadGamification(): Promise<GamificationState | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return null;

    const { data, error } = await sb
      .from('gamificacao')
      .select('xp, level, streak, ultimo_acesso')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      falhou('loadGamification', error);
      return null;
    }
    if (!data) return null;

    return {
      xp: data.xp,
      level: data.level,
      streak: data.streak,
      lastAccessDate: data.ultimo_acesso ?? '',
    };
  }

  /**
   * Registra um evento e devolve o estado AUTORITATIVO de gamificacao.
   *
   * O cliente propoe o XP; o servidor decide. Um valor absurdo e cortado
   * no teto por evento, e o nivel volta calculado pelo banco - por isso o
   * retorno deve substituir o estado local, nunca ser somado a ele.
   */
  async registrarXp(tipo: LogEventType, descricao: string, xp = 0): Promise<GamificationState | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;

    const { data, error } = await sb.rpc('registrar_xp', {
      p_tipo: tipo,
      p_descricao: descricao,
      p_xp: xp,
    });

    if (error) {
      exigir('registrar_xp', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      xp: row.xp,
      level: row.level,
      streak: row.streak,
      lastAccessDate: row.ultimo_acesso ?? '',
    };
  }

  // ===================================================================
  // Logs
  // ===================================================================

  async loadLogs(limite = 200): Promise<LogEntry[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    const { data, error } = await sb
      .from('logs')
      .select('tipo, descricao, xp, criado_em')
      .eq('user_id', uid)
      .order('criado_em', { ascending: false })
      .limit(limite);

    if (error) {
      falhou('loadLogs', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      timestamp: new Date(r.criado_em).getTime(),
      type: r.tipo as LogEventType,
      description: r.descricao,
      xp: r.xp,
    }));
  }

  // ===================================================================
  // Notas
  // ===================================================================

  async loadNotas(): Promise<Nota[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    const { data, error } = await sb
      .from('notas')
      .select('id, texto, tag, criado_em')
      .eq('user_id', uid)
      .order('criado_em', { ascending: false });

    if (error) {
      falhou('loadNotas', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r.id),
      text: r.texto,
      data: r.criado_em,
      tag: r.tag ?? undefined,
    }));
  }

  /** Devolve a nota com o id gerado pelo banco (o local era provisorio). */
  async saveNota(nota: Nota): Promise<Nota | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return null;

    const { data, error } = await sb
      .from('notas')
      .insert({ user_id: uid, texto: nota.text, tag: nota.tag ?? null })
      .select('id, texto, tag, criado_em')
      .single();

    if (error) {
      exigir('saveNota', error);
      return null;
    }
    return { id: String(data.id), text: data.texto, data: data.criado_em, tag: data.tag ?? undefined };
  }

  async updateNota(id: string, texto: string): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('notas').update({ texto }).eq('id', id).eq('user_id', uid);
    if (error) exigir('updateNota', error);
  }

  async deleteNota(id: string): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('notas').delete().eq('id', id).eq('user_id', uid);
    if (error) exigir('deleteNota', error);
  }

  // ===================================================================
  // Chat
  // ===================================================================

  async loadChat(limite = 100, conversaId?: string | null): Promise<ChatMessage[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    let q = sb
      .from('chat_mensagens')
      .select('id, papel, texto, humor, imagem, criado_em')
      .eq('user_id', uid)
      .order('criado_em', { ascending: true })
      .limit(limite);
    // conversaId ausente/null = fluxo legado anterior as threads.
    q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
    const { data, error } = await q;

    if (error) {
      falhou('loadChat', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r.id),
      role: r.papel as ChatMessage['role'],
      text: r.texto,
      timestamp: new Date(r.criado_em).getTime(),
      mood: (r.humor as MoodType) ?? undefined,
      image: r.imagem ?? undefined,
    }));
  }

  async saveChatMessage(msg: ChatMessage, conversaId?: string | null): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;

    const { error } = await sb.from('chat_mensagens').insert({
      user_id: uid,
      papel: msg.role,
      texto: msg.text,
      humor: msg.mood ?? null,
      imagem: msg.image ?? null,
      // tmp_ = conversa so-local (offline): cai no balde legado, sem
      // quebrar a FK. Ao voltar, a thread sincronizada recebe as novas.
      conversa_id: conversaId && !conversaId.startsWith('tmp_') ? conversaId : null,
    });
    if (error) exigir('saveChatMessage', error);

    // Mantem a thread no topo do historico. Best-effort de proposito:
    // se falhar, a mensagem JA foi salva - reclamar aqui mostraria um
    // erro falso ("nao salvou") para algo que salvou.
    const cid = String(conversaId ?? '');
    if (cid !== '' && !cid.startsWith('tmp_')) {
      const alvo: string = cid;
      const { error: touchError } = await sb
        .from('conversas_chat')
        .update({ atualizado_em: new Date().toISOString() })
        .eq('id', alvo)
        .eq('user_id', uid);
      falhou('touchConversa', touchError);
    }
  }

  // ===================================================================
  // Conversas do Mentor (tabela conversas_chat, migration 016)
  // ===================================================================

  async loadConversas(): Promise<Conversa[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    const { data, error } = await sb
      .from('conversas_chat')
      .select('id, titulo, modo, criado_em')
      .eq('user_id', uid)
      .order('atualizado_em', { ascending: false });
    if (error) {
      falhou('loadConversas', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r.id),
      titulo: r.titulo,
      modo: r.modo,
      criadoEm: new Date(r.criado_em).getTime(),
    }));
  }

  /** Cria a thread e devolve o id definitivo do banco. */
  async createConversa(titulo = 'Nova conversa', modo = 'enem_geral'): Promise<Conversa | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return null;
    const { data, error } = await sb
      .from('conversas_chat')
      .insert({ user_id: uid, titulo, modo })
      .select('id, titulo, modo, criado_em')
      .single();
    if (error || !data) exigir('createConversa', error ?? 'sem retorno');
    const row = data as { id: string; titulo: string; modo: string; criado_em: string };
    return {
      id: String(row.id),
      titulo: row.titulo,
      modo: row.modo,
      criadoEm: new Date(row.criado_em).getTime(),
    };
  }

  async renameConversa(id: string, titulo: string): Promise<void> {
    if (!this.ativo() || id.startsWith('tmp_')) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('conversas_chat').update({ titulo }).eq('id', id).eq('user_id', uid);
    if (error) exigir('renameConversa', error);
  }

  /** Apaga a thread; as mensagens caem juntas pelo cascade do banco. */
  async deleteConversa(id: string): Promise<void> {
    if (!this.ativo() || id.startsWith('tmp_')) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('conversas_chat').delete().eq('id', id).eq('user_id', uid);
    if (error) exigir('deleteConversa', error);
  }

  async clearChat(): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('chat_mensagens').delete().eq('user_id', uid);
    falhou('clearChat', error);
  }

  // ===================================================================
  // Personas
  // ===================================================================

  async loadPersonas(): Promise<ChatPersona[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    const { data, error } = await sb.from('personas').select('id, nome, icone, cor, instrucao, criado_em').eq('user_id', uid);

    if (error) {
      falhou('loadPersonas', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r.id),
      name: r.nome,
      icon: r.icone ?? '',
      color: r.cor ?? '#f59e0b',
      instruction: r.instrucao,
      createdAt: new Date(r.criado_em).getTime(),
    }));
  }

  async savePersona(p: ChatPersona): Promise<ChatPersona | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return null;

    const { data, error } = await sb
      .from('personas')
      .insert({ user_id: uid, nome: p.name, icone: p.icon, cor: p.color, instrucao: p.instruction })
      .select('id, nome, icone, cor, instrucao, criado_em')
      .single();

    if (error) {
      exigir('savePersona', error);
      return null;
    }
    return {
      id: String(data.id),
      name: data.nome,
      icon: data.icone,
      color: data.cor,
      instruction: data.instrucao,
      createdAt: new Date(data.criado_em).getTime(),
    };
  }

  async deletePersona(id: string): Promise<void> {
    if (!this.ativo()) return;
    // Personas embutidas do app (mentor_enem, prof_*) nao existem no banco.
    if (!/^\d+$/.test(id)) return;
    const sb = getSupabase()!;
    const { error } = await sb.from('personas').delete().eq('id', id);
    if (error) exigir('deletePersona', error);
  }

  // ===================================================================
  // Quiz
  // ===================================================================

  async loadQuizResults(): Promise<QuizResult[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    const { data, error } = await sb
      .from('quiz_resultados')
      .select('materia, acertos, total, xp_ganho, criado_em')
      .eq('user_id', uid)
      .order('criado_em', { ascending: false });

    if (error) {
      falhou('loadQuizResults', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      materia: r.materia,
      acertos: r.acertos,
      total: r.total,
      xpGanho: r.xp_ganho,
      timestamp: new Date(r.criado_em).getTime(),
    }));
  }

  async saveQuizResult(r: QuizResult): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('quiz_resultados').insert({
      user_id: uid,
      materia: r.materia,
      acertos: r.acertos,
      total: r.total,
      xp_ganho: r.xpGanho,
    });
    if (error) exigir('saveQuizResult', error);
  }

  // ===================================================================
  // Quiz antirrepeticao (tabela quiz_questoes_exibidas, migration 014)
  // ===================================================================

  /** Hashes + previews recentes da materia, para o prompt e o filtro. */
  async loadHistoricoQuiz(
    materia: string,
    limite = 30,
  ): Promise<{ hash: string; preview: string }[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return [];
    const { data, error } = await sb
      .from('quiz_questoes_exibidas')
      .select('enunciado_hash, enunciado_preview')
      .eq('user_id', uid)
      .eq('materia', materia)
      .order('criado_em', { ascending: false })
      .limit(limite);
    if (error) {
      falhou('loadHistoricoQuiz', error);
      return [];
    }
    return (data ?? []).map((r) => ({ hash: r.enunciado_hash, preview: r.enunciado_preview }));
  }

  /**
   * Registra as questoes exibidas. Upsert pelo conflito
   * (user_id, enunciado_hash): duplo-clique, retry ou duas abas nao
   * duplicam nem falham - a unique do banco decide.
   */
  async saveQuestoesExibidas(
    materia: string,
    questoes: { topico?: string; enunciado: string; dificuldade?: string }[],
  ): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid || questoes.length === 0) return;
    const linhas = questoes.map((q) => ({
      user_id: uid,
      materia,
      topico: q.topico ?? null,
      enunciado_hash: hashEnunciado(q.enunciado),
      enunciado_preview: q.enunciado.slice(0, 160),
      dificuldade: q.dificuldade ?? 'media',
    }));
    const { error } = await sb
      .from('quiz_questoes_exibidas')
      .upsert(linhas, { onConflict: 'user_id,enunciado_hash' });
    if (error) exigir('saveQuestoesExibidas', error);
  }

  // ===================================================================
  // Quiz desempenho por topico (tabela quiz_desempenho_topicos, migration 015)
  // ===================================================================

  /** Soma 1 no placar do topico via RPC (atomico, dono pelo JWT). */
  async registrarDesempenhoTopico(materia: string, topico: string, acertou: boolean): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('registrar_desempenho_topico', {
      p_materia: materia,
      p_topico: topico,
      p_acertou: acertou,
    });
    if (error) exigir('registrarDesempenhoTopico', error);
  }

  /** Placar por topico do dono, para a tela de Estatisticas. */
  async loadDesempenhoTopicos(): Promise<DesempenhoTopico[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('quiz_desempenho_topicos')
      .select('materia, topico, acertos, erros')
      .order('atualizado_em', { ascending: false });
    if (error) {
      falhou('loadDesempenhoTopicos', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      materia: r.materia,
      topico: r.topico,
      acertos: r.acertos,
      erros: r.erros,
    }));
  }

  // ===================================================================
  // Redacoes e desafios
  // ===================================================================

  async saveRedacao(c: EssayCorrection, tema?: string): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('redacoes').insert({
      user_id: uid,
      tema: tema ?? null,
      nota_final: c.notaFinal,
      competencia1: c.competencia1,
      competencia2: c.competencia2,
      competencia3: c.competencia3,
      competencia4: c.competencia4,
      competencia5: c.competencia5,
      pontos_fortes: c.pontosFortes,
      pontos_melhorar: c.pontosMelhorar,
      texto_original: c.originalText,
    });
    if (error) exigir('saveRedacao', error);
  }

  async loadDesafios(): Promise<ChallengeResult[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('desafios_redacao')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(20);

    if (error) {
      falhou('loadDesafios', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r.id),
      tema: r.tema,
      notaFinal: r.nota_final,
      competencia1: r.competencia1,
      competencia2: r.competencia2,
      competencia3: r.competencia3,
      competencia4: r.competencia4,
      competencia5: r.competencia5,
      xpGanho: r.xp_ganho,
      tempoUsadoSegundos: r.tempo_usado_segundos,
      finalizado: r.finalizado,
      timestamp: new Date(r.criado_em).getTime(),
    }));
  }

  async saveDesafio(r: ChallengeResult): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('desafios_redacao').insert({
      user_id: uid,
      tema: r.tema,
      nota_final: r.notaFinal,
      competencia1: r.competencia1,
      competencia2: r.competencia2,
      competencia3: r.competencia3,
      competencia4: r.competencia4,
      competencia5: r.competencia5,
      xp_ganho: r.xpGanho,
      tempo_usado_segundos: r.tempoUsadoSegundos,
      finalizado: r.finalizado,
    });
    if (error) exigir('saveDesafio', error);
  }

  // ===================================================================
  // Humor e foco
  // ===================================================================

  async saveHumor(humor: MoodType, texto?: string): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('humor_historico').insert({ user_id: uid, humor, texto: texto ?? null });
    if (error) exigir('saveHumor', error);
  }

  async loadHumor(limite = 24): Promise<{ mood: MoodType; timestamp: number }[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('humor_historico')
      .select('humor, criado_em')
      .order('criado_em', { ascending: false })
      .limit(limite);

    if (error) {
      falhou('loadHumor', error);
      return [];
    }
    return (data ?? [])
      .map((r) => ({ mood: r.humor as MoodType, timestamp: new Date(r.criado_em).getTime() }))
      .reverse();
  }

  async saveSessaoFoco(tipo: 'foco' | 'pausa', minutos: number): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb.from('sessoes_foco').insert({ user_id: uid, tipo, duracao_minutos: minutos });
    if (error) exigir('saveSessaoFoco', error);
  }

  async loadSessoesFoco(): Promise<{ tipo: string; minutos: number; data: string }[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('sessoes_foco')
      .select('tipo, duracao_minutos, criado_em')
      .order('criado_em', { ascending: false })
      .limit(100);

    if (error) {
      falhou('loadSessoesFoco', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      tipo: r.tipo,
      minutos: r.duracao_minutos,
      data: r.criado_em,
    }));
  }

  // ===================================================================
  // Plano diario
  // ===================================================================

  async loadPlano(data: string): Promise<DailyPlan | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const { data: row, error } = await sb
      .from('planos_diarios')
      .select('data, humor, tarefas')
      .eq('data', data)
      .maybeSingle();

    if (error) {
      falhou('loadPlano', error);
      return null;
    }
    if (!row) return null;
    return { date: row.data, mood: row.humor as MoodType, tasks: row.tarefas ?? [] };
  }

  async savePlano(plano: DailyPlan): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb
      .from('planos_diarios')
      .upsert(
        { user_id: uid, data: plano.date, humor: plano.mood, tarefas: plano.tasks },
        { onConflict: 'user_id,data' },
      );
    if (error) exigir('savePlano', error);
  }

  /**
   * Conclui a tarefa no servidor. Devolve a gamificacao autoritativa.
   * Idempotente: chamar de novo para a mesma tarefa nao credita outra vez.
   */
  async concluirTarefa(data: string, taskId: string): Promise<GamificationState | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const { data: row, error } = await sb.rpc('concluir_tarefa', {
      p_data: data,
      p_task_id: taskId,
    });
    if (error) { exigir('concluir_tarefa', error); throw error; }
    const g = Array.isArray(row) ? row[0] : row;
    if (!g) return null;
    return { xp: g.xp, level: g.level, streak: g.streak, lastAccessDate: g.ultimo_acesso ?? '' };
  }

  // ===================================================================
  // Inventario da loja
  // ===================================================================

  async loadInventario(): Promise<Record<string, { purchased: boolean; equipped: boolean }>> {
    if (!this.ativo()) return {};
    const sb = getSupabase()!;
    const { data, error } = await sb.from('inventario').select('item_id, equipado');
    if (error) {
      falhou('loadInventario', error);
      return {};
    }

    const inv: Record<string, { purchased: boolean; equipped: boolean }> = {};
    for (const r of data ?? []) inv[r.item_id] = { purchased: true, equipped: r.equipado };
    return inv;
  }

  /** Catalogo com os precos oficiais (o do cliente e so para exibir). */
  async loadCatalogo(): Promise<{ id: string; nome: string; preco: number }[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.from('loja_itens').select('id, nome, preco').eq('ativo', true);
    if (error) {
      falhou('loadCatalogo', error);
      return [];
    }
    return data ?? [];
  }

  /**
   * Compra via RPC.
   *
   * O preco NAO vai daqui: o servidor le do catalogo, confere o saldo com
   * a linha travada e debita, tudo numa transacao. Se o cliente mandasse o
   * custo, bastaria enviar zero para levar tudo de graca.
   *
   * Devolve a gamificacao ja debitada, ou uma mensagem de erro.
   */
  async comprarItem(itemId: string): Promise<{ gamificacao?: GamificationState; erro?: string }> {
    if (!this.ativo()) return { erro: 'Sem conexao com o banco.' };
    const sb = getSupabase()!;

    const { data, error } = await sb.rpc('comprar_item', { p_item_id: itemId });
    if (error) {
      falhou('comprar_item', error);
      return {
        erro: /saldo insuficiente/i.test(error.message) ? 'XP insuficiente.' : 'Nao foi possivel comprar.',
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { erro: 'Resposta vazia do servidor.' };

    return {
      gamificacao: {
        xp: row.xp,
        level: row.level,
        streak: row.streak,
        lastAccessDate: row.ultimo_acesso ?? '',
      },
    };
  }

  async equiparItem(itemId: string): Promise<boolean> {
    if (!this.ativo()) return false;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('equipar_item', { p_item_id: itemId });
    falhou('equipar_item', error);
    return !error;
  }

  // ===================================================================
  // Preferencias
  // ===================================================================

  async loadPreferencias(): Promise<Record<string, unknown> | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('preferencias')
      .select('daltonismo, tutorial_completo, desafio_tutorial, persona_ativa_id, mudo')
      .maybeSingle();
    if (error) {
      falhou('loadPreferencias', error);
      return null;
    }
    return data ?? null;
  }

  async savePreferencias(patch: Record<string, unknown>): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const { error } = await sb
      .from('preferencias')
      .upsert({ user_id: uid, ...patch }, { onConflict: 'user_id' });
    if (error) exigir('savePreferencias', error);
  }

  // ===================================================================
  // Escolas e turmas
  // ===================================================================

  async loadEscolas(): Promise<{ id: string; nome: string; cidade?: string; cor?: string; codigo_instituicao?: string }[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.from('escolas').select('id, nome, cidade, cor, codigo_instituicao').order('nome');
    if (error) {
      falhou('loadEscolas', error);
      return [];
    }
    return data ?? [];
  }

  async loadTurmas(): Promise<{ id: string; nome: string; escolaId: string; ano?: string; codigo?: string }[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.from('turmas').select('id, nome, escola_id, ano, codigo').order('nome');
    if (error) {
      falhou('loadTurmas', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      nome: r.nome,
      escolaId: r.escola_id,
      ano: r.ano ?? undefined,
      codigo: r.codigo ?? undefined,
    }));
  }

  /**
   * Entra numa turma pelo codigo do professor.
   *
   * escola_id e turma_id sao bloqueados para escrita direta: eles definem
   * qual ranking e qual mural o aluno enxerga. Quem faz a associacao e o
   * servidor, depois de conferir o codigo.
   */
  async entrarNaTurma(codigo: string): Promise<{ ok: boolean; erro?: string }> {
    if (!this.ativo()) return { ok: false, erro: 'Sem conexao com o banco.' };
    const sb = getSupabase()!;
    const { error } = await sb.rpc('entrar_na_turma', { p_codigo: codigo });
    if (error) {
      falhou('entrar_na_turma', error);
      return {
        ok: false,
        erro: /codigo invalido/i.test(error.message)
          ? 'Código inválido.'
          : 'Não foi possível entrar na turma.',
      };
    }
    return { ok: true };
  }

  /**
   * Vincula a escola pelo CODIGO DA INSTITUICAO (8 letras, confidencial).
   *
   * A turma entra depois, pelo codigo da turma. Mesma regra: o servidor
   * confere e associa; o app nunca grava escola direto.
   */
  async vincularInstituicao(codigo: string): Promise<{ ok: boolean; erro?: string }> {
    if (!this.ativo()) return { ok: false, erro: 'Sem conexao com o banco.' };
    const sb = getSupabase()!;
    const { error } = await sb.rpc('vincular_instituicao', { p_codigo: codigo });
    if (error) {
      falhou('vincular_instituicao', error);
      return {
        ok: false,
        erro: /codigo invalido/i.test(error.message)
          ? 'Código inválido. Confira com a secretaria.'
          : 'Não foi possível vincular. Tente de novo.',
      };
    }
    return { ok: true };
  }

  /** Apaga a flag de troca obrigatoria apos a senha definitiva. */
  async limparTrocaSenha(): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = (await sb.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { error } = await sb.from('perfis').update({ deve_trocar_senha: false }).eq('id', uid);
    if (error) exigir('limparTrocaSenha', error);
  }

  /**
   * Secretaria: invalida um codigo de turma vazado e gera outro.
   * O servidor confere se a turma e da sua escola.
   */
  async regenerarCodigoTurma(turmaId: string): Promise<string> {
    if (!this.ativo()) throw new Error('Sem conexao com o banco.');
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('regenerar_codigo_turma', { p_turma_id: turmaId });
    if (error || !data) {
      falhou('regenerar_codigo_turma', error);
      throw new Error('Não foi possível gerar um novo código.');
    }
    return String(data);
  }

  /** Secretaria: invalida o codigo da instituicao e gera outro. */
  async regenerarCodigoInstituicao(escolaId: string): Promise<string> {
    if (!this.ativo()) throw new Error('Sem conexao com o banco.');
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('regenerar_codigo_instituicao', { p_escola_id: escolaId });
    if (error || !data) {
      falhou('regenerar_codigo_instituicao', error);
      throw new Error('Não foi possível gerar um novo código.');
    }
    return String(data);
  }

  // ===================================================================
  // Importacao de turma (secretaria, pos-pagamento no site)
  // ===================================================================

  /**
   * Envia a lista ao worker, que normaliza com IA, cria as contas
   * (aluno/responsavel/docente) e dispara os convites por email.
   *
   * Exige o worker publicado (VITE_AI_BASE_URL): as senhas temporarias
   * e os links magicos so nascem no servidor, nunca no navegador.
   */
  async importarTurma(alunos: {
    nome: string;
    sala: string;
    email: string;
    telefone: string;
    tipo?: 'student' | 'teacher';
  }[]): Promise<{
    ok: boolean;
    escola?: string;
    codigoInstituicao?: string;
    criados?: number;
    emailsEnviados?: number;
    emailConfigurado?: boolean;
    normalizadoPorIA?: boolean;
    resultados?: { linha: number; nome: string; tipo: string; ok: boolean; login?: string; turma?: string | null; codigoTurma?: string | null; erro?: string; emailEnviado?: boolean; senhaTemporaria?: string; loginResponsavel?: string; senhaResponsavel?: string }[];
    erro?: string;
  }> {
    const base = ((import.meta.env.VITE_AI_BASE_URL as string) || '').replace(/\/+$/, '');
    if (!base) return { ok: false, erro: 'Importação automática indisponível: publique o worker e defina VITE_AI_BASE_URL.' };
    if (!this.ativo()) return { ok: false, erro: 'Sem conexao com o banco.' };
    const sb = getSupabase()!;
    const { data: sessao } = await sb.auth.getSession();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = (import.meta.env.VITE_AI_PROXY_TOKEN as string) || '';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sessao?.session?.access_token) headers['X-Supabase-Auth'] = sessao.session.access_token;

    try {
      const resposta = await fetch(`${base}/api/turmas/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ alunos }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) return { ok: false, erro: dados?.message || dados?.error || `Falha na importação (${resposta.status}).` };
      return { ok: true, ...dados };
    } catch (e: any) {
      return { ok: false, erro: e?.message || 'Falha de rede na importação.' };
    }
  }

  // ===================================================================
  // Ligas de estudo
  //
  // O corpo da liga vive em `dados`(jsonb). As colunas soltas existem
  // porque a policy e os filtros precisam delas em SQL.
  // ===================================================================

  async loadLigas(): Promise<Record<string, unknown>[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('ligas')
      .select('id, nome, codigo, disciplina, xp_premio, privada, dados, criador_id');
    if (error) {
      falhou('loadLigas', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      ...(r.dados as Record<string, unknown>),
      id: r.id,
      title: r.nome,
      inviteCode: r.codigo,
      discipline: r.disciplina,
      xpReward: r.xp_premio,
      private: r.privada,
    }));
  }

  async saveLiga(liga: Record<string, any>): Promise<string | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return null;

    const { id: _ignorado, title, inviteCode, discipline, xpReward, private: privada, ...resto } = liga;
    const { data, error } = await sb
      .from('ligas')
      .insert({
        nome: title,
        criador_id: uid,
        disciplina: discipline ?? null,
        xp_premio: xpReward ?? 0,
        privada: !!privada,
        ...(inviteCode ? { codigo: inviteCode } : {}),
        dados: resto,
      })
      .select('id')
      .single();

    if (error) {
      exigir('saveLiga', error);
      return null;
    }
    return String(data.id);
  }

  async entrarNaLiga(ligaId: string): Promise<boolean> {
    if (!this.ativo()) return false;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return false;
    const { error } = await sb.from('liga_membros').insert({ liga_id: ligaId, user_id: uid });
    if (error) exigir('entrarNaLiga', error);
    return true;
  }

  async atualizarLiga(ligaId: string, dados: Record<string, unknown>): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.from('ligas').update({ dados }).eq('id', ligaId);
    if (error) exigir('atualizarLiga', error);
  }

  // ===================================================================
  // Mural da turma
  // ===================================================================

  async loadMensagensTurma(): Promise<CommunityMessage[]> {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('mensagens_comunidade')
      .select(
        'id, escola_id, turma_id, autor_id, conteudo, materia, moderada, motivo_mod, responde_a, curtido_por, criado_em, perfis!inner(nome)',
      )
      .order('criado_em', { ascending: false })
      .limit(200);

    if (error) {
      falhou('loadMensagensTurma', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      escolaId: r.escola_id ?? '',
      turmaId: r.turma_id ?? '',
      userId: r.autor_id,
      userName: r.perfis?.nome ?? 'Colega',
      text: r.conteudo,
      timestamp: new Date(r.criado_em).getTime(),
      moderated: r.moderada,
      moderatedReason: r.motivo_mod ?? undefined,
      replyTo: r.responde_a ? String(r.responde_a) : undefined,
      materia: r.materia ?? undefined,
      likes: (r.curtido_por ?? []).length,
      likedBy: r.curtido_por ?? [],
    })) as CommunityMessage[];
  }

  async enviarMensagemTurma(
    texto: string,
    turmaId: string | null,
    materia?: string,
  ): Promise<CommunityMessage | null> {
    if (!this.ativo()) return null;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return null;

    const { data, error } = await sb
      .from('mensagens_comunidade')
      .insert({ autor_id: uid, conteudo: texto, turma_id: turmaId, materia: materia ?? null })
      .select('id, escola_id, turma_id, autor_id, conteudo, materia, criado_em')
      .single();

    if (error) {
      falhou('enviarMensagemTurma', error);
      return null;
    }
    return {
      id: String(data.id),
      escolaId: data.escola_id ?? '',
      turmaId: data.turma_id ?? '',
      userId: data.autor_id,
      userName: (data as any).perfis?.nome ?? '',
      text: data.conteudo,
      timestamp: new Date(data.criado_em).getTime(),
      moderated: true,
      materia: data.materia ?? undefined,
      likes: 0,
      likedBy: [],
    } as CommunityMessage;
  }

  /** Curte ou descurte. O trigger no banco impede alterar o texto alheio. */
  async alternarCurtida(msgId: string, curtidoPor: string[]): Promise<void> {
    if (!this.ativo()) return;
    const sb = getSupabase()!;
    const uid = await this.uid();
    if (!uid) return;
    const novo = curtidoPor.includes(uid) ? curtidoPor.filter((u) => u !== uid) : [...curtidoPor, uid];
    const { error } = await sb.from('mensagens_comunidade').update({ curtido_por: novo }).eq('id', msgId);
    falhou('alternarCurtida', error);
  }

  // ===================================================================
  // Ranking (view escopada por escola/liga no proprio banco)
  // ===================================================================

  async loadRanking(limite = 50) {
    if (!this.ativo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('ranking')
      .select('id, nome, escola_nome, turma_nome, xp, level, streak')
      .order('xp', { ascending: false })
      .limit(limite);
    if (error) {
      falhou('loadRanking', error);
      return [];
    }
    return data ?? [];
  }
}

export const supabaseRepository = new SupabaseRepository();
