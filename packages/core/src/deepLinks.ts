import type { TabId } from './types';

/**
 * Deep links (issue #57).
 *
 * Os endereços são os MESMOS no site e no app nativo: no M2 o domínio
 * vira App Link (Android) e Universal Link (iOS), e o Expo Router mapeia
 * as mesmas rotas. Por isso o formato mora aqui, no núcleo, e não na tela.
 *
 *   /liga/<uuid>          convite de liga
 *   /turma/<código>       entrar na turma (código do professor)
 *   /vinculo/<código>     responsável acompanhando um estudante
 *   /?aba=<tela>          abrir uma tela (push, atalho do app instalado)
 *
 * Nada aqui EXECUTA a ação: entrar em turma ou se vincular a um
 * estudante pede confirmação na tela. Link aberto sem querer (ou mandado
 * por alguém mal-intencionado) não pode mudar a conta de ninguém.
 */
export type DestinoLink =
  | { tipo: 'aba'; aba: TabId }
  | { tipo: 'liga'; id: string }
  | { tipo: 'turma'; codigo: string }
  | { tipo: 'vinculo'; codigo: string };

/** Telas que um link pode abrir. Fica de fora o que exige contexto. */
const ABAS_PERMITIDAS: TabId[] = [
  'dashboard', 'chat', 'essay', 'notebook', 'quiz', 'profile', 'ranking',
  'foco', 'comunidade', 'store', 'sala', 'escudo', 'audio', 'calendario', 'cuidado',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[A-Z0-9]{4,12}$/;

/** Só letras, números e hífen; qualquer outro caractere invalida o link. */
const limparCodigo = (bruto: string): string => {
  let texto: string;
  try {
    texto = decodeURIComponent(bruto);
  } catch {
    return '';
  }
  return /^[A-Za-z0-9-]+$/.test(texto) ? texto.toUpperCase().replace(/-/g, '') : '';
};

export function interpretarLink(url: string, origemPermitida?: string): DestinoLink | null {
  let u: URL;
  try {
    u = new URL(url, 'https://local.invalid');
  } catch {
    return null;
  }
  // Link de outro site não vira ação aqui dentro.
  if (origemPermitida && u.origin !== 'https://local.invalid' && u.origin !== origemPermitida) return null;

  const partes = u.pathname.split('/').filter(Boolean);
  if (partes.length === 2) {
    const [rota, valor] = partes;
    if (rota === 'liga' && UUID.test(valor)) return { tipo: 'liga', id: valor.toLowerCase() };
    if (rota === 'turma') {
      const codigo = limparCodigo(valor);
      if (CODIGO.test(codigo)) return { tipo: 'turma', codigo };
    }
    if (rota === 'vinculo') {
      const codigo = limparCodigo(valor);
      if (CODIGO.test(codigo)) return { tipo: 'vinculo', codigo };
    }
    return null;
  }

  const aba = u.searchParams.get('aba');
  if (partes.length === 0 && aba && (ABAS_PERMITIDAS as string[]).includes(aba)) return { tipo: 'aba', aba: aba as TabId };
  return null;
}

/** Monta o endereço público de um destino (para compartilhar). */
export function montarLink(origem: string, destino: DestinoLink): string {
  const base = origem.replace(/\/+$/, '');
  switch (destino.tipo) {
    case 'liga':
      return `${base}/liga/${destino.id}`;
    case 'turma':
      return `${base}/turma/${destino.codigo}`;
    case 'vinculo':
      return `${base}/vinculo/${destino.codigo}`;
    case 'aba':
      return `${base}/?aba=${destino.aba}`;
  }
}
