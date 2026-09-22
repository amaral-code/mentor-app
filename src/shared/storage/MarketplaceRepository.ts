import { clienteAtivo, exigir, falhou, getSupabase, uidAtual } from './supabaseHelpers';
import { aiProxyToken, temBackendIA, urlBackendIA } from '../lib/runtimeConfig';
import { normalizarCodigo } from '../lib/vinculoCodigo';
import type {
  Agendamento,
  AlertaSaudeMental,
  JanelaDisponibilidade,
  Notificacao,
  Psicologo,
  ResponsavelVinculado,
  SlotAgenda,
  StatusAlerta,
  VinculoResponsavel,
} from '../types';

/**
 * MARKETPLACE DE PSICOLOGOS - acesso a dados.
 *
 * Tres coisas NAO passam por aqui, de proposito:
 *
 *   - o saldo do agendamento (status_pagamento) so muda por webhook do
 *     provedor, com service_role. Se o navegador pudesse marcar "pago",
 *     a consulta seria gratuita para quem abrisse o console;
 *   - o link da sala vem junto com essa confirmacao, pelo mesmo motivo;
 *   - a criacao do alerta e do banco (registrar_burnout), nao do cliente.
 *
 * O que o app faz e: listar, calcular horarios, PEDIR o agendamento e
 * acompanhar o estado.
 */



export interface RespostaCheckout {
  /** Para onde mandar o responsavel (Mercado Pago, Stripe...). */
  checkoutUrl?: string;
  /** Referencia do pagamento, guardada no agendamento. */
  ref: string;
  /** Em modo demonstracao o worker confirma na hora e devolve a sala. */
  confirmadoNaHora: boolean;
  meetingUrl?: string;
}

function linhaParaPsicologo(r: any): Psicologo {
  return {
    id: r.id,
    nome: r.perfis?.nome ?? r.nome ?? 'Profissional',
    crp: r.crp,
    bio: r.bio ?? '',
    especialidades: r.especialidades ?? [],
    abordagem: r.abordagem ?? '',
    valorCentavos: r.valor_centavos,
    duracaoMinutos: r.duracao_minutos,
    fotoUrl: r.foto_url,
    aceitaNovos: r.aceita_novos,
    notaMedia: Number(r.nota_media ?? 5),
    totalAtendimentos: r.total_atendimentos ?? 0,
  };
}

function linhaParaAgendamento(r: any): Agendamento {
  return {
    id: r.id,
    alunoId: r.aluno_id,
    alunoNome: r.aluno?.nome,
    responsavelId: r.responsavel_id,
    psicologoId: r.psicologo_id,
    psicologoNome: r.psicologo?.nome,
    alertaId: r.alerta_id,
    inicio: r.inicio,
    fim: r.fim,
    duracaoMinutos: r.duracao_minutos,
    meetingUrl: r.meeting_url,
    meetingProvider: r.meeting_provider ?? 'jitsi',
    valorCentavos: r.valor_centavos,
    statusPagamento: r.status_pagamento,
    status: r.status,
  };
}

export class MarketplaceRepository {
  // =================================================================
  // Catalogo
  // =================================================================

  async listarPsicologos(): Promise<Psicologo[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    /*
     * Le a VIEW catalogo_psicologos, nao a tabela.
     *
     * O nome do profissional vive em `perfis`, e a RLS de perfis - com
     * razao - nao deixa um aluno ler a linha de outra pessoa. Um embed
     * devolveria nome nulo (e, com !inner, catalogo vazio). A view roda
     * com privilegio do dono e expoe so nome e avatar, nunca e-mail.
     */
    const { data, error } = await sb
      .from('catalogo_psicologos')
      .select('id, nome, crp, bio, especialidades, abordagem, valor_centavos, duracao_minutos, foto_url, aceita_novos, nota_media, total_atendimentos')
      .eq('aceita_novos', true)
      .order('nota_media', { ascending: false });

    if (error) {
      falhou('listarPsicologos', error);
      return [];
    }
    return (data ?? []).map(linhaParaPsicologo);
  }

  async carregarDisponibilidade(psicologoId: string): Promise<JanelaDisponibilidade[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('psicologo_disponibilidade')
      .select('dia_semana, hora_inicio, hora_fim')
      .eq('psicologo_id', psicologoId)
      .order('dia_semana');

    if (error) {
      falhou('carregarDisponibilidade', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      diaSemana: r.dia_semana,
      horaInicio: String(r.hora_inicio).slice(0, 5),
      horaFim: String(r.hora_fim).slice(0, 5),
    }));
  }

  /**
   * Horarios livres calculados PELO BANCO.
   *
   * O cliente tambem sabe gerar slots (bookingEngine.gerarSlots), mas o
   * que ele gera pode estar velho: alguem marcou entre o carregamento da
   * tela e o clique. Esta consulta e a versao autoritativa usada na hora
   * de confirmar.
   */
  async slotsLivres(psicologoId: string, dias = 14): Promise<SlotAgenda[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const hoje = new Date();
    const ate = new Date(hoje.getTime() + dias * 86400000);

    const { data, error } = await sb.rpc('slots_livres', {
      p_psicologo: psicologoId,
      p_de: hoje.toISOString().slice(0, 10),
      p_ate: ate.toISOString().slice(0, 10),
    });

    if (error) {
      falhou('slots_livres', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({ inicio: r.inicio, fim: r.fim }));
  }

  // =================================================================
  // Agendamento e pagamento
  // =================================================================

  async agendar(psicologoId: string, alunoId: string, inicioISO: string, alertaId?: string | null): Promise<Agendamento> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;

    const { data, error } = await sb.rpc('agendar_consulta', {
      p_psicologo: psicologoId,
      p_aluno: alunoId,
      p_inicio: inicioISO,
      p_alerta: alertaId ?? null,
    });

    if (error) exigir('agendar_consulta', error);
    const row = Array.isArray(data) ? data[0] : data;
    return linhaParaAgendamento(row);
  }

  /**
   * Abre o pagamento no worker.
   *
   * O worker decide o provedor (Mercado Pago em producao, modo
   * simulado sem chave) e e ele quem, no webhook, chama
   * confirmar_pagamento_consulta com service_role. O app so recebe para
   * onde mandar o usuario.
   */
  async iniciarPagamento(agendamento: Agendamento, emailPagador: string): Promise<RespostaCheckout> {
    if (!temBackendIA()) {
      throw new Error(
        'Pagamento indisponível: o back-end não respondeu. Defina MP_ACCESS_TOKEN nas Environment Variables do projeto.',
      );
    }

    const sb = getSupabase();
    const { data: sessao } = (await sb?.auth.getSession()) ?? { data: { session: null } };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = aiProxyToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // O worker confere este JWT antes de criar a cobranca: sem ele,
    // qualquer um geraria checkout para o agendamento de outra pessoa.
    if (sessao?.session?.access_token) headers['X-Supabase-Auth'] = sessao.session.access_token;

    const resposta = await fetch(urlBackendIA('/pagamento'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agendamentoId: agendamento.id,
        valorCentavos: agendamento.valorCentavos,
        descricao: 'Consulta psicologica - Ampli-IA',
        emailPagador,
        inicio: agendamento.inicio,
      }),
    });

    if (!resposta.ok) {
      throw new Error(`Nao foi possivel abrir o pagamento (${resposta.status}).`);
    }
    return resposta.json();
  }

  async cancelar(agendamentoId: string, motivo?: string): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('cancelar_consulta', {
      p_id: agendamentoId,
      p_motivo: motivo ?? null,
    });
    if (error) exigir('cancelar_consulta', error);
  }

  /** Consultas em que o usuario logado e aluno, responsavel ou psicologo. */
  async listarAgendamentos(): Promise<Agendamento[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    /*
     * O nome do psicologo NAO vem embutido aqui: perfis dele nao e
     * legivel pelo aluno (e nem deveria ser, so pelo catalogo). Quem
     * preenche psicologoNome e o store, cruzando com o catalogo ja
     * carregado.
     */
    const { data, error } = await sb
      .from('agendamentos')
      .select('*, aluno:perfis!agendamentos_aluno_id_fkey(nome)')
      .order('inicio', { ascending: true });

    if (error) {
      falhou('listarAgendamentos', error);
      return [];
    }
    return (data ?? []).map(linhaParaAgendamento);
  }

  /** Recarrega uma consulta - usado no retorno do checkout. */
  async buscarAgendamento(id: string): Promise<Agendamento | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;
    const { data, error } = await sb.from('agendamentos').select('*').eq('id', id).maybeSingle();
    if (error) {
      falhou('buscarAgendamento', error);
      return null;
    }
    return data ? linhaParaAgendamento(data) : null;
  }

  // =================================================================
  // Alertas
  // =================================================================

  async listarAlertas(alunoId?: string): Promise<AlertaSaudeMental[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    let consulta = sb
      .from('alertas_saude_mental')
      .select('*, aluno:perfis!alertas_saude_mental_aluno_id_fkey(nome)')
      .order('criado_em', { ascending: false })
      .limit(50);
    if (alunoId) consulta = consulta.eq('aluno_id', alunoId);

    const { data, error } = await consulta;
    if (error) {
      falhou('listarAlertas', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      alunoId: r.aluno_id,
      alunoNome: r.aluno?.nome,
      tipo: r.tipo,
      severidade: r.severidade,
      score: r.score,
      gatilho: r.gatilho ?? {},
      mensagem: r.mensagem,
      status: r.status,
      criadoEm: r.criado_em,
    }));
  }

  async marcarAlerta(id: string, status: StatusAlerta): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('marcar_alerta', { p_id: id, p_status: status });
    if (error) exigir('marcar_alerta', error);
  }

  // =================================================================
  // Vinculo responsavel <-> aluno
  // =================================================================

  async solicitarVinculo(emailAluno: string, parentesco = 'responsavel'): Promise<VinculoResponsavel> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('solicitar_vinculo', {
      p_email_aluno: emailAluno,
      p_parentesco: parentesco,
    });
    if (error) exigir('solicitar_vinculo', error);
    const r: any = Array.isArray(data) ? data[0] : data;
    return {
      id: r.id,
      responsavelId: r.responsavel_id,
      alunoId: r.aluno_id,
      parentesco: r.parentesco,
      status: r.status,
      criadoEm: r.criado_em,
    };
  }

  async responderVinculo(id: string, aceitar: boolean): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('responder_vinculo', { p_id: id, p_aceitar: aceitar });
    if (error) exigir('responder_vinculo', error);
  }

  async listarVinculos(): Promise<VinculoResponsavel[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('vinculos_responsavel')
      .select('*, aluno:perfis!vinculos_responsavel_aluno_id_fkey(nome), responsavel:perfis!vinculos_responsavel_responsavel_id_fkey(nome)')
      .order('criado_em', { ascending: false });

    if (error) {
      falhou('listarVinculos', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      responsavelId: r.responsavel_id,
      alunoId: r.aluno_id,
      alunoNome: r.aluno?.nome,
      responsavelNome: r.responsavel?.nome,
      parentesco: r.parentesco,
      status: r.status,
      criadoEm: r.criado_em,
    }));
  }

  /** Alunos que o responsavel logado pode acompanhar. */
  async meusAlunos(): Promise<{ id: string; nome: string }[]> {
    const vinculos = await this.listarVinculos();
    const uid = await uidAtual();
    return vinculos
      .filter((v) => v.status === 'ativo' && v.responsavelId === uid)
      .map((v) => ({ id: v.alunoId, nome: v.alunoNome ?? 'Estudante' }));
  }

  // -----------------------------------------------------------------
  // Vinculo POR CODIGO (migration 024) - caminho principal
  //
  // Inverte quem comeca: em vez de o responsavel pedir pelo email do
  // aluno, o ALUNO gera um codigo e entrega a quem quiser. Entregar o
  // codigo ja e o consentimento, entao o vinculo nasce ativo.
  // -----------------------------------------------------------------

  /** Codigo do proprio aluno. `null` = banco sem a migration 024. */
  async meuCodigoVinculo(): Promise<string | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;
    const uid = await uidAtual();
    if (!uid) return null;
    const { data, error } = await sb
      .from('perfis')
      .select('codigo_vinculo')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      falhou('meuCodigoVinculo', error);
      return null;
    }
    return (data as { codigo_vinculo?: string } | null)?.codigo_vinculo ?? null;
  }

  /** Invalida o codigo vazado. Nao expulsa quem ja esta vinculado. */
  async regenerarCodigoVinculo(): Promise<string> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('regenerar_codigo_vinculo');
    if (error) exigir('regenerar_codigo_vinculo', error);
    return String(data ?? '');
  }

  /** Chamada pelo RESPONSAVEL, com o codigo que o aluno entregou. */
  async vincularPorCodigo(codigo: string, parentesco = 'responsavel'): Promise<VinculoResponsavel> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('vincular_por_codigo', {
      p_codigo: normalizarCodigo(codigo),
      p_parentesco: parentesco,
    });
    if (error) exigir('vincular_por_codigo', error);
    const r: any = Array.isArray(data) ? data[0] : data;
    return {
      id: r.id,
      responsavelId: r.responsavel_id,
      alunoId: r.aluno_id,
      parentesco: r.parentesco,
      status: r.status,
      criadoEm: r.criado_em,
    };
  }

  /**
   * Quem acompanha o aluno logado. Sem esta lista o codigo seria porta
   * sem olho magico: da para abrir, nao da para saber quem entrou.
   */
  async meusResponsaveis(): Promise<ResponsavelVinculado[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('meus_responsaveis');
    if (error) {
      falhou('meus_responsaveis', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.responsavel ?? 'Responsável',
      email: r.email ?? '',
      parentesco: r.parentesco ?? 'responsavel',
      status: r.status,
      desde: r.desde ?? null,
    }));
  }

  /** Encerra o vinculo. Os DOIS lados podem chamar (RLS confere). */
  async revogarVinculo(id: string): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('revogar_vinculo', { p_vinculo: id });
    if (error) exigir('revogar_vinculo', error);
  }

  // =================================================================
  // Notificacoes
  // =================================================================

  async listarNotificacoes(limite = 30): Promise<Notificacao[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('notificacoes')
      .select('id, canal, tipo, titulo, corpo, payload, lida, criado_em')
      .eq('canal', 'in_app')
      .order('criado_em', { ascending: false })
      .limit(limite);

    if (error) {
      falhou('listarNotificacoes', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      canal: r.canal,
      tipo: r.tipo,
      titulo: r.titulo,
      corpo: r.corpo,
      payload: r.payload ?? {},
      lida: r.lida,
      criadoEm: r.criado_em,
    }));
  }

  async marcarNotificacaoLida(id: string): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.from('notificacoes').update({ lida: true }).eq('id', id);
    if (error) exigir('marcarNotificacaoLida', error);
  }

  /**
   * Registra o navegador para receber push.
   *
   * A chave publica VAPID e publica por definicao (o nome nao mente); a
   * privada fica no worker. Sem ela configurada, o app simplesmente nao
   * oferece push e continua com e-mail e in-app.
   */
  async registrarPush(subscription: PushSubscription): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const uid = await uidAtual();
    if (!uid) return;

    const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    const { error } = await sb.from('push_assinaturas').upsert(
      {
        user_id: uid,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: 'endpoint' },
    );
    if (error) falhou('registrarPush', error);
  }
}

export const marketplaceRepository = new MarketplaceRepository();
