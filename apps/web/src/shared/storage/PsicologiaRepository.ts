import { clienteAtivo, exigir, falhou, getSupabase } from './supabaseHelpers';
import type { EscopoConsentimento } from '../lib/consentimento';

/**
 * ACOMPANHAMENTO PSICOLÓGICO (migration 027).
 *
 * Consentimento, prontuário, mensagens e avaliações. Três regras que a
 * RLS garante e que esta camada não tenta reimplementar:
 *
 *   - quem concede depende da idade (menor de 16: responsável; senão, o
 *     próprio aluno), e as pontas são exclusivas;
 *   - o prontuário só o autor lê, e ele só cresce: não há editar nem
 *     apagar, só retificar com uma nota nova;
 *   - cada conversa tem duas pontas. O responsável fala com o psicólogo
 *     numa conversa PRÓPRIA e não lê a do filho.
 */

export interface Consentimento {
  id: string;
  alunoId: string;
  alunoNome: string;
  psicologoId: string;
  psicologoNome: string;
  crp: string;
  escopo: EscopoConsentimento[];
  validoAte: string;
  concedidoPor: string;
  vigente: boolean;
}

export interface Paciente {
  alunoId: string;
  nome: string;
  menorDe16: boolean;
  escopo: EscopoConsentimento[] | null;
  validoAte: string | null;
  proxima: string | null;
}

export interface NotaProntuario {
  id: string;
  alunoId: string;
  tipo: 'evolucao' | 'retificacao';
  retificaId: string | null;
  texto: string;
  criadoEm: string;
}

export interface MensagemApoio {
  id: string;
  psicologoId: string;
  participanteId: string;
  autorId: string;
  texto: string;
  criadoEm: string;
  lidaEm: string | null;
}

export interface Conversa {
  psicologoId: string;
  participanteId: string;
  outroNome: string;
  ultimaTexto: string;
  ultimaEm: string;
  naoLidas: number;
  /** Sem vínculo vigente o histórico continua legível, mas não se envia. */
  ativa: boolean;
}

export interface PontoBemEstar {
  data: string;
  score: number;
  classe: string;
}

export interface AvaliacaoRecebida {
  nota: number;
  comentario: string | null;
  criadoEm: string;
}

export class PsicologiaRepository {
  // ------------------------------------------------------------ consentimento

  async meusConsentimentos(): Promise<Consentimento[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('meus_consentimentos');
    if (error) {
      falhou('meus_consentimentos', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      alunoId: r.aluno_id,
      alunoNome: r.aluno_nome,
      psicologoId: r.psicologo_id,
      psicologoNome: r.psicologo_nome,
      crp: r.crp ?? '',
      escopo: r.escopo ?? [],
      validoAte: r.valido_ate,
      concedidoPor: r.concedido_por ?? '',
      vigente: !!r.vigente,
    }));
  }

  /**
   * Quem pode conceder pelo aluno. Só responde ao próprio aluno e aos
   * responsáveis dele: a faixa de idade não é pública (027).
   */
  async quemAutoriza(alunoId: string): Promise<'aluno' | 'responsavel'> {
    if (!clienteAtivo()) return 'responsavel';
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('quem_autoriza', { p_aluno: alunoId });
    if (error) {
      falhou('quem_autoriza', error);
      // Na dúvida, o lado conservador: o mesmo que o banco faz com data
      // de nascimento ausente.
      return 'responsavel';
    }
    return data === 'aluno' ? 'aluno' : 'responsavel';
  }

  async conceder(alunoId: string, psicologoId: string, escopo: EscopoConsentimento[], dias: number): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.rpc('conceder_consentimento', {
      p_aluno: alunoId,
      p_psicologo: psicologoId,
      p_escopo: escopo,
      p_dias: dias,
    });
    if (error) exigir('conceder_consentimento', error);
  }

  async revogar(consentimentoId: string): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.rpc('revogar_consentimento', { p_id: consentimentoId });
    if (error) exigir('revogar_consentimento', error);
  }

  // ------------------------------------------------------------ lado do psicólogo

  async pacientes(): Promise<Paciente[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('pacientes');
    if (error) {
      falhou('pacientes', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      alunoId: r.aluno_id,
      nome: r.nome,
      menorDe16: !!r.menor_de_16,
      escopo: r.escopo ?? null,
      validoAte: r.valido_ate ?? null,
      proxima: r.proxima ?? null,
    }));
  }

  /** Lança sem consentimento de bem-estar: a tela mostra o motivo. */
  async bemEstarPaciente(alunoId: string, dias = 30): Promise<PontoBemEstar[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('bem_estar_paciente', { p_aluno: alunoId, p_dias: dias });
    if (error) exigir('bem_estar_paciente', error);
    return (data ?? []).map((r: any) => ({ data: r.data, score: Number(r.score) || 0, classe: r.classe }));
  }

  async notas(alunoId: string): Promise<NotaProntuario[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('prontuario_notas')
      .select('id, aluno_id, tipo, retifica_id, texto, criado_em')
      .eq('aluno_id', alunoId)
      .order('criado_em', { ascending: false });
    if (error) {
      falhou('prontuario_notas', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      alunoId: r.aluno_id,
      tipo: r.tipo,
      retificaId: r.retifica_id ?? null,
      texto: r.texto,
      criadoEm: r.criado_em,
    }));
  }

  /** Só acrescenta. Corrigir é `retificaId` apontando para a original. */
  async anotar(psicologoId: string, alunoId: string, texto: string, retificaId?: string): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.from('prontuario_notas').insert({
      psicologo_id: psicologoId,
      aluno_id: alunoId,
      texto: texto.trim(),
      tipo: retificaId ? 'retificacao' : 'evolucao',
      retifica_id: retificaId ?? null,
    });
    if (error) exigir('prontuario_notas', error);
  }

  async avaliacoesRecebidas(): Promise<AvaliacaoRecebida[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('avaliacoes_recebidas');
    if (error) {
      falhou('avaliacoes_recebidas', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      nota: Number(r.nota) || 0,
      comentario: r.comentario ?? null,
      criadoEm: r.criado_em,
    }));
  }

  // ------------------------------------------------------------ mensagens

  async conversas(): Promise<Conversa[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('minhas_conversas');
    if (error) {
      falhou('minhas_conversas', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      psicologoId: r.psicologo_id,
      participanteId: r.participante_id,
      outroNome: r.outro_nome ?? '',
      ultimaTexto: r.ultima_texto ?? '',
      ultimaEm: r.ultima_em,
      naoLidas: Number(r.nao_lidas) || 0,
      ativa: !!r.ativa,
    }));
  }

  async mensagens(psicologoId: string, participanteId: string): Promise<MensagemApoio[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('mensagens_apoio')
      .select('*')
      .eq('psicologo_id', psicologoId)
      .eq('participante_id', participanteId)
      .order('criado_em', { ascending: true });
    if (error) {
      falhou('mensagens_apoio', error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      psicologoId: r.psicologo_id,
      participanteId: r.participante_id,
      autorId: r.autor_id,
      texto: r.texto,
      criadoEm: r.criado_em,
      lidaEm: r.lida_em ?? null,
    }));
  }

  async enviar(psicologoId: string, participanteId: string, texto: string): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.rpc('enviar_mensagem_apoio', {
      p_psicologo: psicologoId,
      p_participante: participanteId,
      p_texto: texto,
    });
    if (error) exigir('enviar_mensagem_apoio', error);
  }

  async marcarLida(psicologoId: string, participanteId: string): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('marcar_conversa_lida', {
      p_psicologo: psicologoId,
      p_participante: participanteId,
    });
    if (error) falhou('marcar_conversa_lida', error);
  }

  // ------------------------------------------------------------ avaliação

  async consultasAvaliadas(): Promise<Set<string>> {
    if (!clienteAtivo()) return new Set();
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('consultas_avaliadas');
    if (error) {
      falhou('consultas_avaliadas', error);
      return new Set();
    }
    return new Set((data ?? []).map((r: any) => (typeof r === 'string' ? r : r.consultas_avaliadas)));
  }

  async avaliar(agendamentoId: string, nota: number, comentario?: string): Promise<void> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { error } = await sb.rpc('avaliar_consulta', {
      p_agendamento: agendamentoId,
      p_nota: nota,
      p_comentario: comentario ?? null,
    });
    if (error) exigir('avaliar_consulta', error);
  }
}

export const psicologiaRepository = new PsicologiaRepository();
