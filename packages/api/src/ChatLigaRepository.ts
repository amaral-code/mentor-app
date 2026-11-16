/**
 * Chats ao vivo: liga (032) e mural da turma.
 *
 * Mensagem nova chega pelo Supabase Realtime (postgres_changes), e não
 * recarregando a lista: é o que leva a mensagem aos outros membros em
 * menos de 1 s (#45). A RLS vale também para o Realtime: quem não é
 * membro da liga não recebe nada, mesmo assinando o canal.
 */
import { getSupabase } from './supabase';
import { clienteAtivo, exigir, falhou } from './supabaseHelpers';
import { apelidoDe } from './rankingEngine';

export type OrigemChat = 'liga' | 'turma';

export interface MensagemAoVivo {
  id: string;
  autorId: string;
  /** Apelido estável, nunca o nome real de um colega (o próprio aluno vê "Você"). */
  autor: string;
  texto: string;
  criadoEm: number;
  /** Escondida por 3 denúncias: só o autor ainda vê. */
  oculta: boolean;
}

function paraMensagem(r: Record<string, any>, uid: string | null): MensagemAoVivo {
  return {
    id: String(r.id),
    autorId: r.autor_id,
    autor: r.autor_id === uid ? 'Você' : apelidoDe(String(r.autor_id)),
    texto: r.conteudo,
    criadoEm: new Date(r.criado_em).getTime(),
    oculta: r.oculta === true || r.moderada === false,
  };
}

async function meuId(): Promise<string | null> {
  const sb = getSupabase();
  const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.user.id ?? null;
}

export class ChatLigaRepository {
  /** Últimas mensagens, da mais antiga para a mais nova. */
  async listar(origem: OrigemChat, alvoId: string | null, limite = 60): Promise<MensagemAoVivo[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const uid = await meuId();
    const consulta =
      origem === 'liga'
        ? sb.from('mensagens_liga').select('id, autor_id, conteudo, oculta, criado_em').eq('liga_id', alvoId ?? '')
        : alvoId
          ? sb.from('mensagens_comunidade').select('id, autor_id, conteudo, moderada, criado_em').eq('turma_id', alvoId)
          : sb.from('mensagens_comunidade').select('id, autor_id, conteudo, moderada, criado_em');
    const { data, error } = await consulta.order('criado_em', { ascending: false }).limit(limite);
    if (error) {
      falhou(`listar ${origem}`, error);
      return [];
    }
    return (data ?? []).map((r) => paraMensagem(r as Record<string, any>, uid)).reverse();
  }

  async enviar(origem: OrigemChat, alvoId: string | null, texto: string): Promise<MensagemAoVivo> {
    const sb = getSupabase();
    if (!sb) throw new Error('Sem conexão com o banco.');
    const uid = await meuId();
    const { data, error } =
      origem === 'liga'
        ? await sb.from('mensagens_liga').insert({ liga_id: alvoId ?? '', conteudo: texto }).select('id, autor_id, conteudo, oculta, criado_em').single()
        : await sb
            .from('mensagens_comunidade')
            .insert({ autor_id: uid ?? '', conteudo: texto, turma_id: alvoId })
            .select('id, autor_id, conteudo, moderada, criado_em')
            .single();
    if (error) {
      // A tranca do servidor (032) fala com a mesma voz da moderação do app.
      if (/moderacao/i.test(error.message)) throw new Error('Mensagem bloqueada pela moderação.');
      exigir(`enviar ${origem}`, error);
    }
    return paraMensagem(data as Record<string, any>, uid);
  }

  /**
   * Assina as mensagens novas. Devolve quem cancela a assinatura (chamar
   * ao sair da tela: canal esquecido aberto gasta bateria e conexão).
   */
  assinar(origem: OrigemChat, alvoId: string | null, aoChegar: (m: MensagemAoVivo) => void): () => void {
    const sb = getSupabase();
    if (!sb) return () => {};
    const tabela = origem === 'liga' ? 'mensagens_liga' : 'mensagens_comunidade';
    const coluna = origem === 'liga' ? 'liga_id' : 'turma_id';
    let uid: string | null = null;
    void meuId().then((u) => (uid = u));
    const canal = sb
      .channel(`chat:${origem}:${alvoId ?? 'escola'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: tabela, ...(alvoId ? { filter: `${coluna}=eq.${alvoId}` } : {}) },
        (payload) => aoChegar(paraMensagem(payload.new as Record<string, any>, uid)),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }

  async denunciar(origem: OrigemChat, mensagemId: string, motivo: 'ofensiva' | 'bullying' | 'spam' | 'outro' = 'ofensiva'): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('Sem conexão com o banco.');
    const { error } = await sb.from('denuncias_mensagem').insert({ origem, mensagem_id: Number(mensagemId), motivo });
    // Denúncia repetida da mesma pessoa: já valeu, não é erro para a tela.
    if (error && !/duplicate|unique/i.test(error.message)) exigir('denunciar', error);
  }

  /**
   * Ids das ligas em que o aluno está DE FATO (`liga_membros`). O
   * `joinedBy` dentro de `ligas.dados` é cópia mantida pelo web e pode
   * ficar velho; quem decide quem lê o chat é esta tabela.
   */
  async minhasLigas(): Promise<string[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const uid = await meuId();
    if (!uid) return [];
    const { data, error } = await sb.from('liga_membros').select('liga_id').eq('user_id', uid);
    if (error) {
      falhou('minhasLigas', error);
      return [];
    }
    return (data ?? []).map((r) => String(r.liga_id));
  }

  async entrarPorCodigo(codigo: string): Promise<string> {
    const sb = getSupabase();
    if (!sb) throw new Error('Sem conexão com o banco.');
    const { data, error } = await sb.rpc('entrar_na_liga_por_codigo', { p_codigo: codigo });
    if (error) throw new Error(/codigo invalido/i.test(error.message) ? 'Código não encontrado. Confira com quem te passou.' : 'Não foi possível entrar agora.');
    return String(data);
  }
}

export const chatLigaRepository = new ChatLigaRepository();
