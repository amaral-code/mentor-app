/**
 * PILULAS DE AUDIO - modo "tela desligada".
 *
 * O caso de uso manda na engenharia: aluno do noturno, no onibus, depois
 * do trabalho, com o celular no bolso e o fone no ouvido. Disso saem
 * quatro exigencias que este arquivo atende:
 *
 *   1. TRES MINUTOS. E o tempo entre dois pontos de onibus e o limite de
 *      atencao auditiva sem apoio visual. O roteiro e escrito para caber
 *      nisso (cerca de 450 palavras a 150 ppm em portugues).
 *   2. LINGUAGEM FALADA. Texto de apostila lido em voz alta e
 *      insuportavel: sem "conforme a figura", sem formula soletrada, com
 *      frases curtas e uma unica ideia por paragrafo.
 *   3. AUDIO SERVIDO, NAO PROCESSADO NO APARELHO. O TTS roda no worker
 *      (chave fora do navegador) e o mp3 volta em base64 ou URL, para o
 *      player tocar com a tela apagada.
 *   4. RETOMADA. O progresso e salvo em segundos: o onibus chega antes
 *      do fim mais vezes do que nao chega.
 */

/** Palavras por minuto de uma locucao pt-BR confortavel. */
export const PALAVRAS_POR_MINUTO = 150;

/** Alvo de duracao de uma pilula. */
export const DURACAO_ALVO_SEGUNDOS = 180;

/** Limite de caracteres por requisicao do Google Cloud TTS. */
export const LIMITE_CARACTERES_TTS = 4800;

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function estimarDuracaoSegundos(texto: string): number {
  return Math.round((contarPalavras(texto) / PALAVRAS_POR_MINUTO) * 60);
}

/**
 * Quebra o roteiro em blocos que cabem numa chamada de TTS.
 *
 * O corte e por FRASE, nunca por caractere: cortar no meio de uma frase
 * produz uma emenda audivel entre os arquivos, e a pessoa percebe.
 */
export function dividirEmBlocos(roteiro: string, limite = LIMITE_CARACTERES_TTS): string[] {
  const frases = roteiro.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) ?? [roteiro];
  const blocos: string[] = [];
  let atual = '';

  for (const frase of frases) {
    if ((atual + frase).length > limite && atual) {
      blocos.push(atual.trim());
      atual = '';
    }
    atual += frase;
  }
  if (atual.trim()) blocos.push(atual.trim());
  return blocos;
}

/**
 * Prompt de geracao do roteiro.
 *
 * As restricoes estao no prompt porque sao de CONTEUDO, nao de
 * formatacao: um modelo que "resume bem" ainda escreve para os olhos se
 * ninguem pedir o contrario.
 */
export function promptRoteiroAudio(materia: string, topico: string, contexto?: string): string {
  return [
    `Escreva o roteiro de um micro-podcast de 3 minutos sobre "${topico}" (${materia}) para um estudante brasileiro do ensino medio noturno que vai ouvir no transporte publico, de olhos fechados.`,
    '',
    'Regras obrigatorias:',
    `• Entre 400 e 470 palavras (cerca de ${DURACAO_ALVO_SEGUNDOS} segundos falados).`,
    '• Portugues brasileiro falado, frases curtas, segunda pessoa ("voce").',
    '• Comece com uma pergunta ou cena concreta do cotidiano, nunca com "neste episodio".',
    '• Uma unica ideia por paragrafo; no maximo 3 conceitos no total.',
    '• Nada que dependa de ver: sem "observe a figura", sem formula soletrada, sem tabela.',
    '• Traga um exemplo de como o ENEM costuma cobrar esse tema.',
    '• Termine com uma frase de fechamento que caiba na memoria (um resumo de uma linha).',
    '• Nao use markdown, titulos, asteriscos nem marcacao de tempo. So o texto corrido para ser lido em voz alta.',
    contexto ? `\nContexto do aluno (adapte o exemplo, sem citar estes dados): ${contexto}` : '',
  ].join('\n');
}

/**
 * Vozes pt-BR do Google Cloud TTS que soam bem em fone de ouvido.
 * Neural2 custa mais que Standard, mas a diferenca em locucao longa e
 * grande o bastante para ser a escolha padrao.
 *
 * Ordem importa: VOZES[0] é a padrão — feminina (Ana, Neural2-A), que é
 * a voz pedida para as pílulas.
 */
export const VOZES = [
  { id: 'pt-BR-Neural2-A', nome: 'Ana', genero: 'feminina' },
  { id: 'pt-BR-Neural2-C', nome: 'Clara', genero: 'feminina' },
  { id: 'pt-BR-Neural2-B', nome: 'Bruno', genero: 'masculina' },
  { id: 'pt-BR-Wavenet-A', nome: 'Ana (leve)', genero: 'feminina' },
];

/** Velocidade padrão da locução: 1.1x — viva e rápida, sem atropelar. */
export const VELOCIDADE_PADRAO = 1.1;

export interface PedidoTTS {
  texto: string;
  voz: string;
  velocidade: number;
}

/**
 * Monta o corpo enviado ao worker (/tts). Velocidade padrão 1.1x: viva e
 * rápida, sem atropelar as frases.
 */
export function montarPedidoTTS(texto: string, voz = VOZES[0].id, velocidade = VELOCIDADE_PADRAO): PedidoTTS {
  return { texto, voz, velocidade: Math.max(0.5, Math.min(velocidade, 1.6)) };
}

/**
 * Escolhe a melhor voz pt-BR feminina entre as instaladas no aparelho
 * (modo sem servidor). Função pura — recebe a lista e devolve o índice.
 *
 * Preferência: pt-BR sobre pt-PT; nomes femininos conhecidos (Google,
 * Microsoft, Apple, Samsung); Natural/Neural online primeiro; nunca uma
 * voz de outro idioma.
 */
export interface VozDoSistema {
  name: string;
  lang: string;
}

const NOMES_FEMININOS = [
  'samantha', 'maria', 'francisca', 'helena', 'camila', 'vitoria', 'vitória',
  'fernanda', 'beatriz', 'luciana', 'patricia', 'patrícia', 'ana', 'clara',
  'female', 'feminina', 'mulher', 'woman',
];

export function escolherVozNativa(vozes: VozDoSistema[]): number {
  if (vozes.length === 0) return -1;
  const norm = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let melhor = -1;
  let melhorNota = -Infinity;
  vozes.forEach((v, i) => {
    const lang = norm(v.lang);
    const nome = norm(v.name);
    if (!lang.startsWith('pt')) return;
    let nota = 0;
    if (lang.startsWith('pt-br') || lang === 'pt_br') nota += 100;
    else if (lang.startsWith('pt')) nota += 40;
    if (NOMES_FEMININOS.some((n) => nome.includes(n))) nota += 50;
    if (/google|natural|neural|premium|enhanced/.test(nome)) nota += 20;
    if (/whisper|robot|eSpeak|espeak|compact/.test(nome)) nota -= 60;
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = i;
    }
  });
  // Sem pt-BR instalado: qualquer pt antes de cair no default do sistema.
  if (melhor === -1) {
    const qualquerPt = vozes.findIndex((v) => norm(v.lang).startsWith('pt'));
    return qualquerPt;
  }
  return melhor;
}

/**
 * Roteiro curto de bolso, 100% local, para quando a IA está fora do ar.
 *
 * Honesto por construção: avisa que é a versão curta e guia uma revisão
 * rápida usando o resumo na tela — nunca inventa conteúdo de estudo. Faz
 * TODA pílula tocar mesmo sem internet, sem chave e sem servidor.
 */
export function roteiroLocalEmergencia(materia: string, topico: string, resumo?: string): string {
  const pedacoResumo = resumo?.trim()
    ? ` O ponto central é este: ${resumo.trim().slice(0, 280)}`
    : '';
  return [
    `Pílula relâmpago de ${topico}, ${materia}.`,
    'A versão completa de três minutos precisa de internet, então vai aqui a versão de bolso, com a mesma voz.',
    `Primeiro: respire fundo duas vezes e foque só no essencial.${pedacoResumo}`,
    'Segundo: repita em voz alta, com suas palavras, a ideia principal que você acabou de ouvir.',
    'Terceiro: quando chegar em casa, abra este mesmo tema no Quiz e faça três questões para fixar.',
    'Pílula relâmpago concluída. Constância curta todo dia vale mais que maratona uma vez por mês.',
  ].join(' ');
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Considera concluido a partir de 90% - ninguem ouve o fade final. */
export const LIMIAR_CONCLUSAO = 0.9;

export function estaConcluido(segundosOuvidos: number, duracao: number): boolean {
  return duracao > 0 && segundosOuvidos / duracao >= LIMIAR_CONCLUSAO;
}
