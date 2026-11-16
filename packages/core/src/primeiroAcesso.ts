/**
 * Primeiro acesso do aluno em passos (#33), sem tela.
 *
 * Cada passo diz se pode avançar; o rascunho fica no aparelho a cada
 * passo, então fechar o app no meio não obriga a recomeçar (a meta da
 * issue é terminar em menos de 2 minutos, e recomeçar estoura isso).
 */
import { safeGet, safeRemove, safeSet } from './safeStorage';
import { dataBrParaIso, validarDataNascimento } from './vinculoCodigo';

export const PASSOS = ['boasVindas', 'metas', 'objetivo', 'rotina', 'nascimento'] as const;
export type Passo = (typeof PASSOS)[number];

export interface RascunhoPrimeiroAcesso {
  passo: number;
  metas: string[];
  curso: string;
  universidade: string;
  /** Como o aluno digitou: DD/MM/AAAA. */
  dataProva: string;
  tempo: string | null;
  turno: string | null;
  nascimento: string;
}

export const RASCUNHO_VAZIO: RascunhoPrimeiroAcesso = {
  passo: 0,
  metas: [],
  curso: '',
  universidade: '',
  dataProva: '',
  tempo: null,
  turno: null,
  nascimento: '',
};

/** Erro da data da prova (vazia é permitida: o passo é opcional). */
export function erroDataProva(texto: string, hoje: Date = new Date()): string {
  if (!texto.trim()) return '';
  const iso = dataBrParaIso(texto);
  if (!iso) return 'Use dia, mês e ano: 08/11/2027.';
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(a, m - 1, d, 12);
  if (data.getMonth() !== m - 1) return 'Essa data não existe.';
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1, 12);
  const fim = new Date(hoje.getFullYear() + 3, hoje.getMonth(), hoje.getDate(), 12);
  if (data < inicio) return 'A data já passou.';
  if (data > fim) return 'Confira o ano: ficou longe demais.';
  return '';
}

export function erroNascimento(texto: string, hoje: Date = new Date()): string {
  if (!texto.trim()) return '';
  const iso = dataBrParaIso(texto);
  if (!iso) return 'Use dia, mês e ano: 31/12/2008.';
  const v = validarDataNascimento(iso, hoje);
  return v.ok ? '' : v.erro;
}

export function podeAvancar(r: RascunhoPrimeiroAcesso, hoje: Date = new Date()): boolean {
  switch (PASSOS[r.passo]) {
    case 'metas':
      return r.metas.length > 0;
    case 'objetivo':
      return !erroDataProva(r.dataProva, hoje);
    case 'rotina':
      return !!r.tempo && !!r.turno;
    case 'nascimento':
      return !erroNascimento(r.nascimento, hoje);
    default:
      return true;
  }
}

/** Dias até a prova (0 no dia; negativo se já passou). */
export function diasAteAProva(iso: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return null;
  const alvo = Date.UTC(a, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}

const chave = (uid: string) => `mm_primeiro_acesso_${uid}`;

export function carregarRascunho(uid: string): RascunhoPrimeiroAcesso {
  try {
    const lido = JSON.parse(safeGet(chave(uid)) ?? 'null');
    return lido && typeof lido === 'object' ? { ...RASCUNHO_VAZIO, ...lido } : RASCUNHO_VAZIO;
  } catch {
    return RASCUNHO_VAZIO;
  }
}

export function salvarRascunho(uid: string, r: RascunhoPrimeiroAcesso): void {
  safeSet(chave(uid), JSON.stringify(r));
}

export function apagarRascunho(uid: string): void {
  safeRemove(chave(uid));
}
