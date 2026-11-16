import { clienteAtivo, exigir, falhou, getSupabase } from './supabaseHelpers';
import type { PresencaSala } from '../lib/salaFoco';

/**
 * SALA DE FOCO — presenca por heartbeat (migration 023).
 *
 * Tudo passa por RPC: a tabela `sala_foco_presenca` so deixa o dono ler a
 * propria linha, e ver os colegas e privilegio de `listar_sala_foco`, que
 * devolve nome curto e nunca o id de ninguem.
 *
 * Contrato de erro do repositorio: LEITURA vira lista vazia com aviso no
 * console (a sala sem rede fica silenciosa, nao quebrada); ESCRITA de
 * ENTRADA propaga, porque o aluno precisa saber que nao entrou. O ping e
 * a saida sao a excecao deliberada — sao best-effort, e um toast de erro
 * no meio do estudo seria a distracao que a tela combate.
 */
export class SalaFocoRepository {
  /** Entra (ou reentra, zerando o cronometro) na sala. Erro PROPAGA. */
  async entrar(materia: string): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('entrar_sala_foco', { p_materia: materia.slice(0, 40) });
    if (error) exigir('entrarSalaFoco', error);
  }

  /** Heartbeat: "continuo aqui, com N minutos de foco". Best-effort. */
  async pingar(minutos: number): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('pingar_sala_foco', { p_minutos: Math.max(0, Math.floor(minutos)) });
    if (error) falhou('pingarSalaFoco', error);
  }

  /** Saida explicita. Best-effort: sem ela, a janela de 2 min resolve. */
  async sair(): Promise<void> {
    if (!clienteAtivo()) return;
    const sb = getSupabase()!;
    const { error } = await sb.rpc('sair_sala_foco');
    if (error) falhou('sairSalaFoco', error);
  }

  /** Quem esta focando agora (mesma escola). Leitura: nunca joga. */
  async listar(): Promise<PresencaSala[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('listar_sala_foco');
    if (error) {
      falhou('listarSalaFoco', error);
      return [];
    }
    return (Array.isArray(data) ? data : []).map((r) => ({
      nome: String(r.nome ?? 'Colega'),
      avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
      materia: String(r.materia ?? ''),
      minutosFoco: Number(r.minutos_foco ?? 0),
      entrouEm: String(r.entrou_em ?? new Date().toISOString()),
      ultimoPing: String(r.ultimo_ping ?? new Date().toISOString()),
      ehVoce: r.eh_voce === true,
    }));
  }
}

export const salaFocoRepository = new SalaFocoRepository();
