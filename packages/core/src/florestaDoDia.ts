import type { MicroTask } from './types';

/**
 * Floresta do dia: o Plano do Dia desenhado como árvores, uma por tarefa.
 *
 * O sagui sobe a árvore da tarefa em que está, entra na toca do tronco e,
 * lá dentro, encontra os passos daquela tarefa. Fica no core porque o web
 * e o app desenham a mesma floresta e a mesma sequência de animação; só o
 * traço muda de plataforma.
 *
 * Dentro de cada árvore há uma missão de quiz (@mentor/core/missaoDaArvore);
 * só a missão aprovada conclui a tarefa e dá XP, e tarefa concluída
 * continua travada (o ciclo marcar e desmarcar dava XP infinito).
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

export const XP_DA_TAREFA = 20;

/**
 * Rótulo para leitor de tela. Tocar na árvore só leva o sagui até ela;
 * entrar na missão é sempre pelo botão "Iniciar missão", nunca pelo
 * toque na árvore (decisão do dono: entrar por engano ao rolar a tela
 * tirava o aluno da floresta).
 */
export function rotuloDaArvore(a: Arvore, total: number, comSagui = a.estado === 'atual'): string {
  const posicao = `Árvore ${a.indice + 1} de ${total}`;
  if (a.estado === 'feita') return `${posicao}: ${a.tarefa.titulo}. Concluída.`;
  if (comSagui) return `${posicao}: ${a.tarefa.titulo}. O sagui está aqui.`;
  return `${posicao}: ${a.tarefa.titulo}. Levar o sagui até esta árvore.`;
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
  /** Área preenchida; `contorno` desenha a borda (traço arredondado). */
  | { forma: 'caminho'; d: string; cor: string; contorno?: string; espessura?: number }
  /** Só traço, sem preenchimento: casca, grama. */
  | { forma: 'linha'; d: string; cor: string; espessura: number };

/* Paleta da floresta. A árvore tem contorno escuro como os botões e
   cartões "adesivo" do app (borda e lábio), para parecer parte do mesmo
   jogo. A que espera fica desbotada para o olho ir direto à da vez. */
interface Paleta {
  contorno: string;
  copaSombra: string;
  copa: string;
  brilho: string;
  tronco: string;
  troncoClaro: string;
  sombraTronco: string;
  madeiraToca: string;
}
const PALETAS: Record<EstadoArvore, Paleta> = {
  atual: {
    contorno: '#14532D',
    copaSombra: '#15803D',
    copa: '#22C55E',
    brilho: '#86EFAC',
    tronco: '#8B5A2B',
    troncoClaro: '#A9733D',
    sombraTronco: '#6B4220',
    madeiraToca: '#C08A52',
  },
  feita: {
    contorno: '#14532D',
    copaSombra: '#166534',
    copa: '#16A34A',
    brilho: '#4ADE80',
    tronco: '#8B5A2B',
    troncoClaro: '#A9733D',
    sombraTronco: '#6B4220',
    madeiraToca: '#C08A52',
  },
  esperando: {
    contorno: '#7C9A86',
    copaSombra: '#9DBDA7',
    copa: '#B7D3C0',
    brilho: '#D9EADF',
    tronco: '#B8977A',
    troncoClaro: '#C9AD94',
    sombraTronco: '#A08064',
    madeiraToca: '#D3BBA4',
  },
};
const FRUTA = '#F59E0B';
const BRILHO_FRUTA = '#FDE68A';
const GRAMA = '#BBF7D0';
const GRAMA_ESCURA = '#4ADE80';
const SOMBRA_CHAO = '#86EFAC';
const BORDA_TOCA = '#4A2C17';
const FUNDO_TOCA = '#24150A';
const BRILHO_ESTRELA = '#FCD34D';

const TOPO_TRONCO = 92;
const PE_TRONCO = 218;

/** Centro da toca no quadro: onde o sagui entra e de onde a toca abre. */
export function centroDaToca(alturaToca: number): { x: number; y: number } {
  return { x: 80, y: Math.round(PE_TRONCO - alturaToca * (PE_TRONCO - TOPO_TRONCO)) };
}

/* Copa em três camadas: contorno (as mesmas bolas, maiores, na cor da
   borda, o que dá um contorno só por fora), sombra embaixo e a copa
   clara um pouco acima, deixando a sombra aparecer como meia-lua. */
function copaDeBolas(bolas: { cx: number; cy: number; rx: number; ry: number }[], c: Paleta): Forma[] {
  const formas: Forma[] = [];
  for (const b of bolas) formas.push({ forma: 'elipse', cx: b.cx, cy: b.cy, rx: b.rx + 3, ry: b.ry + 3, cor: c.contorno });
  for (const b of bolas) formas.push({ forma: 'elipse', cx: b.cx, cy: b.cy, rx: b.rx, ry: b.ry, cor: c.copaSombra });
  for (const b of bolas) formas.push({ forma: 'elipse', cx: b.cx - 1, cy: b.cy - 5, rx: b.rx - 3, ry: b.ry - 4, cor: c.copa });
  for (const b of bolas) formas.push({ forma: 'elipse', cx: b.cx - b.rx * 0.35, cy: b.cy - b.ry * 0.45, rx: b.rx * 0.28, ry: b.ry * 0.2, cor: c.brilho });
  return formas;
}

function copa(especie: Especie, c: Paleta): Forma[] {
  if (especie === 'pinheiro') {
    // Três andares com contorno: a linha entre um andar e outro é o que
    // faz parecer pinheiro de desenho, e não um triângulo só.
    const andares = [
      { topo: 58, base: 118, meia: 64 },
      { topo: 30, base: 92, meia: 54 },
      { topo: 4, base: 64, meia: 42 },
    ];
    const formas: Forma[] = [];
    for (const a of andares) {
      formas.push({
        forma: 'caminho',
        d: `M80 ${a.topo} Q${80 + a.meia * 0.5} ${(a.topo + a.base) / 2} ${80 + a.meia} ${a.base} Q80 ${a.base + 8} ${80 - a.meia} ${a.base} Q${80 - a.meia * 0.5} ${(a.topo + a.base) / 2} 80 ${a.topo} Z`,
        cor: c.copa,
        contorno: c.contorno,
        espessura: 3,
      });
      formas.push({ forma: 'caminho', d: `M${80 + a.meia - 6} ${a.base - 4} Q80 ${a.base + 4} ${80 - a.meia + 6} ${a.base - 4} Q80 ${a.base - 2} ${80 + a.meia - 6} ${a.base - 4} Z`, cor: c.copaSombra });
      formas.push({ forma: 'caminho', d: `M78 ${a.topo + 10} Q${80 - a.meia * 0.25} ${a.topo + 22} ${80 - a.meia * 0.45} ${a.topo + 34} Q${80 - a.meia * 0.2} ${a.topo + 26} 78 ${a.topo + 10} Z`, cor: c.brilho });
    }
    return formas;
  }
  if (especie === 'nuvem') {
    return copaDeBolas(
      [
        { cx: 46, cy: 84, rx: 34, ry: 26 },
        { cx: 114, cy: 84, rx: 34, ry: 26 },
        { cx: 80, cy: 58, rx: 56, ry: 38 },
        { cx: 80, cy: 26, rx: 32, ry: 22 },
      ],
      c,
    );
  }
  return copaDeBolas(
    [
      { cx: 44, cy: 86, rx: 30, ry: 30 },
      { cx: 116, cy: 86, rx: 30, ry: 30 },
      { cx: 80, cy: 62, rx: 48, ry: 46 },
      { cx: 80, cy: 28, rx: 28, ry: 26 },
    ],
    c,
  );
}

/* Frutas só na árvore feita: o "prêmio" da tarefa fica visível na floresta. */
const POSICOES_FRUTA: Record<Especie, [number, number][]> = {
  redonda: [[50, 82], [110, 76], [90, 40], [68, 98]],
  pinheiro: [[58, 86], [104, 104], [94, 52], [50, 110]],
  nuvem: [[46, 82], [112, 78], [94, 42], [72, 92]],
};

/* Estrelinhas em volta da copa da árvore da vez: chamam o olho sem texto. */
function estrela(x: number, y: number, r: number): Forma {
  const k = r * 0.28;
  return {
    forma: 'caminho',
    d: `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`,
    cor: BRILHO_ESTRELA,
  };
}

export function formasDaArvore(a: Pick<Arvore, 'especie' | 'estado' | 'alturaToca'>): Forma[] {
  const c = PALETAS[a.estado];
  const toca = centroDaToca(a.alturaToca);
  const formas: Forma[] = [
    // Chão: grama e a sombra da copa.
    { forma: 'elipse', cx: 80, cy: 222, rx: 64, ry: 8, cor: GRAMA },
    { forma: 'elipse', cx: 82, cy: 220, rx: 34, ry: 4, cor: SOMBRA_CHAO },
    { forma: 'linha', d: 'M26 222 l3 -7 l2 7 M36 223 l2 -5 l2 5 M124 222 l3 -7 l2 7 M134 223 l2 -5 l2 5', cor: GRAMA_ESCURA, espessura: 2 },
    // Raízes.
    { forma: 'caminho', d: `M60 ${PE_TRONCO} Q50 ${PE_TRONCO + 2} 44 224 L66 224 Z`, cor: c.tronco, contorno: c.contorno, espessura: 2.5 },
    { forma: 'caminho', d: `M100 ${PE_TRONCO} Q110 ${PE_TRONCO + 2} 116 224 L94 224 Z`, cor: c.sombraTronco, contorno: c.contorno, espessura: 2.5 },
    // Galhos que entram na copa.
    { forma: 'caminho', d: 'M72 112 Q58 104 48 88 L54 85 Q63 98 74 104 Z', cor: c.tronco, contorno: c.contorno, espessura: 2.5 },
    { forma: 'caminho', d: 'M88 106 Q102 98 110 82 L116 85 Q107 104 90 114 Z', cor: c.sombraTronco, contorno: c.contorno, espessura: 2.5 },
    // Tronco: base mais larga, um lado claro e outro na sombra.
    {
      forma: 'caminho',
      d: `M58 ${PE_TRONCO + 2} C66 212 68 190 69 150 L70 ${TOPO_TRONCO} L90 ${TOPO_TRONCO} L91 150 C92 190 94 212 102 ${PE_TRONCO + 2} Z`,
      cor: c.tronco,
      contorno: c.contorno,
      espessura: 3,
    },
    { forma: 'caminho', d: `M84 ${TOPO_TRONCO} L90 ${TOPO_TRONCO} L91 150 C92 190 94 212 101 ${PE_TRONCO + 1} L88 ${PE_TRONCO + 1} C88 200 86 160 84 ${TOPO_TRONCO} Z`, cor: c.sombraTronco },
    { forma: 'caminho', d: `M72 ${TOPO_TRONCO + 4} L75 ${TOPO_TRONCO + 4} C74 150 73 190 68 ${PE_TRONCO - 4} L65 ${PE_TRONCO - 4} C69 190 71 150 72 ${TOPO_TRONCO + 4} Z`, cor: c.troncoClaro },
    // Casca.
    { forma: 'linha', d: 'M76 126 q3 7 0 14 M84 182 q-3 7 0 13 M74 196 q2 5 0 10', cor: c.contorno, espessura: 1.8 },
    ...copa(a.especie, c),
  ];
  if (a.estado === 'atual') {
    formas.push(estrela(20, 40, 7), estrela(142, 30, 6), estrela(136, 118, 5));
  }
  if (a.estado === 'feita') {
    for (const [cx, cy] of POSICOES_FRUTA[a.especie]) {
      formas.push({ forma: 'circulo', cx, cy, r: 9, cor: c.contorno });
      formas.push({ forma: 'circulo', cx, cy, r: 7, cor: FRUTA });
      formas.push({ forma: 'circulo', cx: cx - 2.5, cy: cy - 2.5, r: 2.5, cor: BRILHO_FRUTA });
    }
    // Flores no pé: a árvore feita floresceu.
    for (const [cx, cy] of [[34, 216], [128, 216], [118, 222]] as [number, number][]) {
      formas.push({ forma: 'circulo', cx, cy, r: 3.5, cor: '#F472B6' });
      formas.push({ forma: 'circulo', cx, cy, r: 1.4, cor: '#FEF3C7' });
    }
  }
  // Toca por último (o sagui entra por ela): moldura de madeira, borda
  // escura e o buraco.
  formas.push(
    { forma: 'elipse', cx: toca.x, cy: toca.y, rx: 16, ry: 18, cor: c.contorno },
    { forma: 'elipse', cx: toca.x, cy: toca.y, rx: 14, ry: 16, cor: c.madeiraToca },
    { forma: 'elipse', cx: toca.x, cy: toca.y + 1, rx: 11, ry: 13, cor: BORDA_TOCA },
    { forma: 'elipse', cx: toca.x, cy: toca.y + 2, rx: 9, ry: 11, cor: FUNDO_TOCA },
  );
  return formas;
}

/* ------------------------------------------------------------------ */

/**
 * Caminho de terra que liga o pé de uma árvore ao da seguinte, em curva
 * (as árvores alternam de lado, então sai um "S" suave). Os pontos vêm da
 * tela, em pixels; o web e o app desenham a mesma curva.
 */
export function caminhoEntreArvores(pontos: { x: number; y: number }[]): string {
  if (pontos.length < 2) return '';
  let d = `M${pontos[0].x} ${pontos[0].y}`;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    const meio = (a.y + b.y) / 2;
    d += ` C${a.x} ${meio} ${b.x} ${meio} ${b.x} ${b.y}`;
  }
  return d;
}
