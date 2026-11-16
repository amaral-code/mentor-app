/**
 * SALA DE FOCO (body doubling) — logica pura.
 *
 * Estudar junto, em silencio: a presenca do outro sustenta a sua. A sala
 * mostra quem da sua escola esta focando AGORA, ha quanto tempo e em que
 * materia. Nada alem disso.
 *
 * O QUE A SALA NAO TEM, DE PROPOSITO
 *   - Chat. Nenhum. Combinar o estudo com a conversa e trocar uma
 *     distracao por outra, e o produto inteiro existe contra isso.
 *   - Ranking, nota, cobranca. Ninguem "perde" por focar menos.
 *   - Entrada automatica: so aparece na sala quem entrou nela.
 *
 * A presenca e por HEARTBEAT, nao por "sair da pagina": fechar a aba no
 * 4G nem sempre manda o adeus. Quem parou de pingar some sozinho da
 * lista em JANELA_PRESENCA_MS — assim ninguem fica estudando de mentira
 * para sempre na tela dos colegas.
 */

/** Sem ping nesta janela, a pessoa saiu da sala (2 min). */
export const JANELA_PRESENCA_MS = 120_000;

/** De quanto em quanto tempo o app avisa que continua ali (45s). */
export const PING_INTERVALO_MS = 45_000;

/** Uma pessoa na sala, como a RPC `listar_sala_foco` devolve. */
export interface PresencaSala {
  /** Primeiro nome + inicial — nunca o nome completo, nunca o id. */
  nome: string;
  avatarUrl: string | null;
  materia: string;
  /** Minutos de foco acumulados na sessao atual. */
  minutosFoco: number;
  /** ISO do ultimo heartbeat. */
  ultimoPing: string;
  entrouEm: string;
  ehVoce: boolean;
}

/**
 * Nome exibido: primeiro nome + inicial do sobrenome.
 *
 * "Ana Beatriz Moreira" vira "Ana M." — reconhecivel por quem senta ao
 * lado na sala de aula, inutil para quem quiser catalogar o horario de
 * estudo de alguem.
 */
export function nomeDeSala(nomeCompleto: string): string {
  const partes = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Colega';
  const primeiro = partes[0];
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : '';
  const inicial = ultimo ? ` ${ultimo[0].toUpperCase()}.` : '';
  return `${primeiro}${inicial}`;
}

/** Iniciais para o avatar quando a pessoa nao tem foto. */
export function iniciaisDeSala(nome: string): string {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Continua na sala? (heartbeat dentro da janela). */
export function estaPresente(p: PresencaSala, agora: number = Date.now()): boolean {
  const t = Date.parse(p.ultimoPing);
  if (Number.isNaN(t)) return false;
  // Tolera relogio do dispositivo adiantado: ping "no futuro" ainda vale.
  return agora - t <= JANELA_PRESENCA_MS;
}

/**
 * Lista exibivel: so quem esta presente, os colegas antes de voce.
 *
 * Voce vai para o fim porque a sala existe para mostrar os OUTROS — seu
 * proprio cartao e so a confirmacao de que voce entrou.
 */
export function colegasNaSala(
  presencas: readonly PresencaSala[],
  agora: number = Date.now(),
): PresencaSala[] {
  return presencas
    .filter((p) => estaPresente(p, agora))
    .slice()
    .sort((a, b) => {
      if (a.ehVoce !== b.ehVoce) return a.ehVoce ? 1 : -1;
      return b.minutosFoco - a.minutosFoco;
    });
}

/** Quantos colegas (sem contar voce) estao focando agora. */
export function totalColegas(
  presencas: readonly PresencaSala[],
  agora: number = Date.now(),
): number {
  return presencas.filter((p) => !p.ehVoce && estaPresente(p, agora)).length;
}

/** Frase do cabecalho da sala. */
export function resumoSala(colegas: number, voceEstaDentro: boolean): string {
  if (!voceEstaDentro) {
    if (colegas === 0) return 'A sala está silenciosa. Entre e abra o primeiro bloco de foco.';
    return `${colegas} ${colegas === 1 ? 'pessoa está' : 'pessoas estão'} focando agora. Entre e estude junto.`;
  }
  if (colegas === 0) return 'Você chegou primeiro. Mantenha o foco, logo alguém senta com você.';
  return `Você e mais ${colegas} ${colegas === 1 ? 'pessoa' : 'pessoas'} focando agora, em silêncio.`;
}

/** "45min" / "1h 20min" — tempo de foco de um cartao. */
export function formatarTempoFoco(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos));
  if (m < 1) return 'começou agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto === 0 ? `${h}h` : `${h}h ${resto}min`;
}

/** Rotulo da materia; sem materia declarada, a sala nao inventa uma. */
export function rotuloMateria(materia: string): string {
  const m = String(materia || '').trim();
  return m.length > 0 ? m : 'Estudo livre';
}

/**
 * Cronometro do proprio cartao, em `mm:ss`.
 *
 * O tempo dos COLEGAS e arredondado (`formatarTempoFoco`) de proposito —
 * segundo a segundo viraria placar. O seu proprio some com precisao,
 * porque ver o numero andar e o que segura quem esta comecando.
 */
export function formatarCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${String(m % 60).padStart(2, '0')}min`;
  }
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Minutos que o app deve reportar no proximo ping.
 *
 * Conta tempo de tela VISIVEL (o mesmo criterio do Modo Foco): quem
 * minimizou nao acumula minutos na sala. Sem isso, deixar a aba aberta a
 * noite toda renderia "8h de foco" na tela dos colegas — e a sala viraria
 * teatro.
 */
export function minutosDeFoco(segundosVisiveis: number): number {
  return Math.max(0, Math.floor(Math.max(0, segundosVisiveis) / 60));
}
