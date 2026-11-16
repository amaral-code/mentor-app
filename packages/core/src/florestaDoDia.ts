import type { MicroTask } from './types';

/**
 * Floresta do dia: o Plano do Dia desenhado como árvores, uma por tarefa.
 *
 * O sagui sobe a árvore da tarefa em que está, entra na toca do tronco e,
 * lá dentro, encontra os passos daquela tarefa. Fica no core porque o web
 * e o app desenham a mesma floresta e a mesma sequência de animação; só o
 * traço muda de plataforma.
 *
 * A regra de XP NÃO mudou: só a comprovação (foto ou parágrafo) conclui a
 * tarefa, e tarefa concluída continua travada. Os dois primeiros passos da
 * toca são marcação do próprio aluno, sem XP: marcar e desmarcar não pode
 * render nada, senão volta o XP infinito que a trilha fechou.
 */

export type EstadoArvore = 'feita' | 'atual' | 'esperando';
export type Lado = 'esquerda' | 'direita';

/** Três formatos de copa, para a floresta não parecer carimbada. */
export type Especie = 'redonda' | 'pinheiro' | 'nuvem';
const ESPECIES: Especie[] = ['redonda', 'pinheiro', 'nuvem'];

export interface Arvore {
  tarefa: MicroTask;
  indice: number;
  estado: EstadoArvore;
  /** Zigue-zague: árvores alternam de lado, como a trilha alternava. */
  lado: Lado;
  especie: Especie;
  /** Altura relativa da toca no tronco (0 = pé da árvore, 1 = copa). */
  alturaToca: number;
}

export interface Floresta {
  arvores: Arvore[];
  /** Índice da árvore em que o sagui está (primeira tarefa aberta), ou -1. */
  indiceAtual: number;
  feitas: number;
  todasFeitas: boolean;
}

/* Hash estável do id: a mesma tarefa sempre ganha a mesma árvore, e a
   floresta não "pisca" outra espécie a cada recarga do plano. */
function hash(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function montarFloresta(tarefas: MicroTask[]): Floresta {
  const indiceAtual = tarefas.findIndex((t) => !t.completed);
  const arvores = tarefas.map<Arvore>((tarefa, indice) => {
    const h = hash(tarefa.id || String(indice));
    return {
      tarefa,
      indice,
      estado: tarefa.completed ? 'feita' : indice === indiceAtual ? 'atual' : 'esperando',
      lado: indice % 2 === 0 ? 'esquerda' : 'direita',
      especie: ESPECIES[h % ESPECIES.length],
      // Entre 35% e 55% do tronco: alta o bastante para "subir" ter graça,
      // baixa o bastante para a toca não sumir dentro da copa.
      alturaToca: 0.35 + ((h >> 3) % 5) * 0.05,
    };
  });
  const feitas = tarefas.filter((t) => t.completed).length;
  return { arvores, indiceAtual, feitas, todasFeitas: tarefas.length > 0 && feitas === tarefas.length };
}

/* ------------------------------------------------------------------ */

/**
 * Sequência da animação. Ao chegar numa árvore o sagui sobe sozinho até a
 * toca; tocar em "Entrar" faz ele entrar, e a toca abre por dentro. Na
 * saída ele volta para a porta da toca. Uma função pura para os dois apps
 * não divergirem sobre o que vem depois do quê.
 */
export type Fase = 'subindo' | 'pronto' | 'entrando' | 'dentro' | 'saindo';
export type Evento = 'tocar' | 'fimDaAnimacao' | 'fechar' | 'mudouDeArvore';

export function proximaFase(fase: Fase, evento: Evento): Fase {
  // Trocar de árvore (tarefa concluída ou toque em outra) recomeça a subida,
  // menos com a toca aberta: o aluno sai primeiro.
  if (evento === 'mudouDeArvore') return fase === 'dentro' ? fase : 'subindo';
  switch (fase) {
    case 'subindo':
      if (evento === 'fimDaAnimacao') return 'pronto';
      // Quem tem pressa não precisa esperar a subida terminar.
      return evento === 'tocar' ? 'entrando' : fase;
    case 'pronto':
      return evento === 'tocar' ? 'entrando' : fase;
    case 'entrando':
      if (evento === 'fimDaAnimacao') return 'dentro';
      return evento === 'fechar' ? 'pronto' : fase;
    case 'dentro':
      return evento === 'fechar' ? 'saindo' : fase;
    case 'saindo':
      return evento === 'fimDaAnimacao' ? 'pronto' : fase;
  }
}

/** Duração de cada fase em ms. Com movimento reduzido, tudo é instantâneo. */
export function duracaoDaFase(fase: Fase, reduzido: boolean): number {
  if (reduzido) return 0;
  switch (fase) {
    case 'subindo':
      return 1800; // três ciclos de escalada (animacaoSagui)
    case 'entrando':
      return 1100; // DURACAO_DA_ENTRADA
    case 'saindo':
      return 450;
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */

export interface PassoDaToca {
  id: 'entender' | 'fazer' | 'comprovar';
  titulo: string;
  texto: string;
  /** Só o último passo dá XP, e só pela comprovação. */
  daXp: boolean;
}

export const XP_DA_TAREFA = 20;

/** O que o aluno encontra dentro da toca: a tarefa quebrada em três passos. */
export function passosDaToca(tarefa: MicroTask): PassoDaToca[] {
  return [
    { id: 'entender', titulo: 'Entenda o desafio', texto: tarefa.descricao || tarefa.titulo, daXp: false },
    { id: 'fazer', titulo: 'Faça a tarefa', texto: 'Separe um tempo sem distração e faça agora. Marque quando terminar.', daXp: false },
    { id: 'comprovar', titulo: 'Comprove o que aprendeu', texto: 'Uma foto ou um parágrafo contando o que você aprendeu.', daXp: true },
  ];
}

/**
 * O passo de comprovar só abre depois dos dois anteriores marcados. Não
 * vale como trava de segurança (a comprovação é que vale); serve para
 * guiar quem entrou na toca sem saber por onde começar.
 */
export function podeComprovar(marcados: ReadonlySet<string>): boolean {
  return marcados.has('entender') && marcados.has('fazer');
}

/** Rótulo para leitor de tela: a árvore inteira é um botão. */
export function rotuloDaArvore(a: Arvore, total: number): string {
  const posicao = `Árvore ${a.indice + 1} de ${total}`;
  if (a.estado === 'feita') return `${posicao}: ${a.tarefa.titulo}. Concluída.`;
  if (a.estado === 'atual') return `${posicao}: ${a.tarefa.titulo}. O sagui está aqui. Entrar na toca.`;
  return `${posicao}: ${a.tarefa.titulo}. Entrar na toca.`;
}

/* ------------------------------------------------------------------ */

/**
 * Desenho da árvore em formas simples (círculo, elipse, caminho), num
 * quadro de 160 x 230. O web pinta com <svg>, o app com react-native-svg;
 * os dois leem daqui, então a floresta é igual nas duas telas.
 */
export const QUADRO_ARVORE = { largura: 160, altura: 230 } as const;

export type Forma =
  | { forma: 'circulo'; cx: number; cy: number; r: number; cor: string }
  | { forma: 'elipse'; cx: number; cy: number; rx: number; ry: number; cor: string }
  | { forma: 'caminho'; d: string; cor: string };

/* Cores da floresta. Verde da copa e âmbar da fruta seguem a paleta do
   produto (esmeralda e âmbar); a árvore que espera fica desbotada para o
   olho ir direto à atual. */
const CORES: Record<EstadoArvore, { copa: string; brilho: string; tronco: string; sombraTronco: string }> = {
  atual: { copa: '#16A34A', brilho: '#4ADE80', tronco: '#8B5A2B', sombraTronco: '#6B4220' },
  feita: { copa: '#15803D', brilho: '#22C55E', tronco: '#8B5A2B', sombraTronco: '#6B4220' },
  esperando: { copa: '#A3C9AE', brilho: '#C7DFCD', tronco: '#B8977A', sombraTronco: '#A08064' },
};
const FRUTA = '#F59E0B';
const BRILHO_FRUTA = '#FDE68A';
const GRAMA = '#BBF7D0';
const BORDA_TOCA = '#4A2C17';
const FUNDO_TOCA = '#24150A';

const TOPO_TRONCO = 88;
const PE_TRONCO = 218;

/** Centro da toca no quadro: onde o sagui entra e de onde a toca abre. */
export function centroDaToca(alturaToca: number): { x: number; y: number } {
  return { x: 80, y: Math.round(PE_TRONCO - alturaToca * (PE_TRONCO - TOPO_TRONCO)) };
}

function copa(especie: Especie, c: { copa: string; brilho: string }): Forma[] {
  if (especie === 'pinheiro') {
    return [
      { forma: 'caminho', d: 'M80 58 L142 114 L18 114 Z', cor: c.copa },
      { forma: 'caminho', d: 'M80 30 L134 90 L26 90 Z', cor: c.copa },
      { forma: 'caminho', d: 'M80 4 L124 62 L36 62 Z', cor: c.copa },
      { forma: 'caminho', d: 'M80 12 L96 34 L72 34 Z', cor: c.brilho },
    ];
  }
  if (especie === 'nuvem') {
    return [
      { forma: 'elipse', cx: 50, cy: 82, rx: 36, ry: 28, cor: c.copa },
      { forma: 'elipse', cx: 110, cy: 82, rx: 36, ry: 28, cor: c.copa },
      { forma: 'elipse', cx: 80, cy: 56, rx: 58, ry: 40, cor: c.copa },
      { forma: 'elipse', cx: 80, cy: 26, rx: 34, ry: 24, cor: c.copa },
      { forma: 'elipse', cx: 64, cy: 38, rx: 16, ry: 10, cor: c.brilho },
    ];
  }
  return [
    { forma: 'circulo', cx: 44, cy: 84, r: 30, cor: c.copa },
    { forma: 'circulo', cx: 116, cy: 84, r: 30, cor: c.copa },
    { forma: 'circulo', cx: 80, cy: 62, r: 48, cor: c.copa },
    { forma: 'circulo', cx: 80, cy: 28, r: 28, cor: c.copa },
    { forma: 'circulo', cx: 64, cy: 46, r: 14, cor: c.brilho },
  ];
}

/* Frutas só na árvore feita: o "prêmio" da tarefa fica visível na floresta. */
const POSICOES_FRUTA: Record<Especie, [number, number][]> = {
  redonda: [[50, 78], [108, 72], [86, 40], [70, 96]],
  pinheiro: [[60, 84], [104, 100], [92, 52], [48, 106]],
  nuvem: [[46, 80], [112, 76], [92, 42], [74, 92]],
};

export function formasDaArvore(a: Pick<Arvore, 'especie' | 'estado' | 'alturaToca'>): Forma[] {
  const c = CORES[a.estado];
  const toca = centroDaToca(a.alturaToca);
  const formas: Forma[] = [
    { forma: 'elipse', cx: 80, cy: 222, rx: 60, ry: 8, cor: GRAMA },
    { forma: 'caminho', d: `M64 ${PE_TRONCO} Q70 150 70 ${TOPO_TRONCO} L90 ${TOPO_TRONCO} Q90 150 96 ${PE_TRONCO} Z`, cor: c.tronco },
    { forma: 'caminho', d: `M84 ${PE_TRONCO} Q86 150 86 ${TOPO_TRONCO} L90 ${TOPO_TRONCO} Q90 150 96 ${PE_TRONCO} Z`, cor: c.sombraTronco },
    { forma: 'caminho', d: `M64 ${PE_TRONCO} Q56 ${PE_TRONCO} 52 222 L70 222 Z`, cor: c.tronco },
    { forma: 'caminho', d: `M96 ${PE_TRONCO} Q104 ${PE_TRONCO} 108 222 L90 222 Z`, cor: c.sombraTronco },
    ...copa(a.especie, c),
    { forma: 'elipse', cx: toca.x, cy: toca.y, rx: 13, ry: 15, cor: BORDA_TOCA },
    { forma: 'elipse', cx: toca.x, cy: toca.y + 1, rx: 9, ry: 11, cor: FUNDO_TOCA },
  ];
  if (a.estado === 'feita') {
    for (const [cx, cy] of POSICOES_FRUTA[a.especie]) {
      formas.push({ forma: 'circulo', cx, cy, r: 8, cor: FRUTA });
      formas.push({ forma: 'circulo', cx: cx - 2.5, cy: cy - 2.5, r: 2.5, cor: BRILHO_FRUTA });
    }
  }
  return formas;
}
