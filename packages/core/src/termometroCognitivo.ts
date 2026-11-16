/**
 * TERMOMETRO COGNITIVO — logica pura do mapa de calor do docente.
 *
 * O painel do professor responde uma pergunta so: "quem da minha escola
 * esta perto de quebrar hoje?". A resposta vem do indice de burnout que o
 * aluno ja calcula (burnoutModel + indice_burnout), agregado por turma
 * pela RPC `termometro_cognitivo` (migration 022).
 *
 * ANONIMATO E REGRA, NAO ENFEITE. A RPC nunca devolve user_id e este
 * modulo nunca recebe um. Turma com menos de AMOSTRA_MINIMA alunos
 * medidos e descartada em `turmasVisiveis`: com 2 ou 3 alunos, "67% em
 * exaustao" aponta para uma pessoa — vigilancia, nao pedagogia.
 *
 * Fica em shared/lib (e nao dentro do componente) porque e aqui que
 * existe teste: limiar errado num painel escolar vira intervencao errada
 * em cima de adolescente.
 */

/** Linha agregada de uma turma, como a RPC 022 devolve. */
export interface TurmaTermometro {
  turmaId: string;
  turmaNome: string;
  /** Alunos matriculados na turma (denominador institucional). */
  totalAlunos: number;
  /** Alunos com indice calculado na janela (denominador estatistico). */
  comIndice: number;
  /** Classe `fadiga` ou `esgotamento`. */
  exaustos: number;
  /** Classe `alerta`. */
  emAlerta: number;
  /** Media do score 0-100 do indice de burnout. */
  scoreMedio: number;
  /** Media de minutos focados por sessao (focus_metrics). */
  minutosFocoMedio: number;
  /** Media de perdas de foco por sessao (focus_metrics). */
  distracoesMedia: number;
  /** Proporcao 0-1 de estudo entre 0h e 5h (telemetria). */
  fracaoMadrugada: number;
}

/**
 * Piso de anonimato. Cinco e o menor grupo em que uma porcentagem ainda
 * descreve a turma em vez de denunciar um aluno.
 */
export const AMOSTRA_MINIMA = 5;

export type NivelCalor = 'calmo' | 'atencao' | 'alerta' | 'critico';

/** Percentual (0-100) de alunos medidos em fadiga/esgotamento. */
export function percentualExaustao(t: TurmaTermometro): number {
  if (t.comIndice <= 0) return 0;
  return Math.round((t.exaustos / t.comIndice) * 100);
}

/** Percentual (0-100) de alunos medidos em classe `alerta`. */
export function percentualAlerta(t: TurmaTermometro): number {
  if (t.comIndice <= 0) return 0;
  return Math.round((t.emAlerta / t.comIndice) * 100);
}

/**
 * Faixa de calor a partir do percentual de exaustao.
 *
 * Os cortes seguem os mesmos degraus do indice individual (burnoutModel):
 * ate 24% e o ruido normal de uma turma; 50% e o ponto em que a aula
 * planejada deixa de caber na turma que apareceu.
 */
export function nivelDeCalor(percentual: number): NivelCalor {
  if (percentual >= 75) return 'critico';
  if (percentual >= 50) return 'alerta';
  if (percentual >= 25) return 'atencao';
  return 'calmo';
}

export const ROTULO_CALOR: Record<NivelCalor, string> = {
  calmo: 'Turma respirando',
  atencao: 'Sinais de cansaço',
  alerta: 'Exaustão cognitiva',
  critico: 'Turma no limite',
};

/** Turma sem amostra suficiente nao vai para a tela (anonimato). */
export function temAmostraSuficiente(t: TurmaTermometro): boolean {
  return t.comIndice >= AMOSTRA_MINIMA;
}

/** Filtra o que pode ser exibido e ordena da turma mais quente para a mais fria. */
export function turmasVisiveis(turmas: readonly TurmaTermometro[]): TurmaTermometro[] {
  return turmas
    .filter(temAmostraSuficiente)
    .slice()
    .sort((a, b) => {
      const d = percentualExaustao(b) - percentualExaustao(a);
      return d !== 0 ? d : b.scoreMedio - a.scoreMedio;
    });
}

/** Quantas turmas ficaram de fora por amostra pequena (a tela avisa). */
export function turmasOcultas(turmas: readonly TurmaTermometro[]): number {
  return turmas.filter((t) => !temAmostraSuficiente(t)).length;
}

/** Frase do card: "65% da Turma 3º B está com exaustão cognitiva hoje". */
export function resumoTurma(t: TurmaTermometro, janela: 'hoje' | 'semana' = 'hoje'): string {
  const pct = percentualExaustao(t);
  const quando = janela === 'hoje' ? 'hoje' : 'nesta semana';
  if (pct === 0) {
    return `Nenhum aluno da ${t.turmaNome} apresentou exaustão cognitiva ${quando}.`;
  }
  return `${pct}% da ${t.turmaNome} está com exaustão cognitiva ${quando}.`;
}

export interface Intervencao {
  titulo: string;
  acao: string;
  /** O sinal que puxou a sugestao — o professor precisa saber o porquê. */
  motivo: string;
}

/**
 * Sugestao pedagogica automatica.
 *
 * A ordem importa: primeiro o sinal mais especifico (madrugada, telefone
 * na mao, sessao curta), depois a temperatura geral. Sugerir "reduza o
 * conteudo" para uma turma que so dorme mal seria resposta certa para a
 * pergunta errada.
 */
export function sugerirIntervencao(t: TurmaTermometro): Intervencao {
  const pct = percentualExaustao(t);
  const nivel = nivelDeCalor(pct);

  if (t.fracaoMadrugada >= 0.25) {
    return {
      titulo: 'Puxe o prazo para antes das 22h',
      acao: 'Combine entregas com corte no fim da tarde e abra 10 min de revisão guiada no início da aula.',
      motivo: `${Math.round(t.fracaoMadrugada * 100)}% do estudo da turma acontece entre 0h e 5h.`,
    };
  }

  if (t.distracoesMedia >= 4) {
    return {
      titulo: 'Abra a aula com um bloco de foco curto',
      acao: 'Proponha 15 min de Modo Foco coletivo antes do conteúdo novo: celular na mesa, cronômetro na tela.',
      motivo: `Média de ${t.distracoesMedia.toFixed(1)} saídas do app por sessão de estudo.`,
    };
  }

  if (t.minutosFocoMedio > 0 && t.minutosFocoMedio < 12) {
    return {
      titulo: 'Fatie o conteúdo em blocos de 10 minutos',
      acao: 'Troque a explicação longa por três blocos curtos com uma tarefa prática entre eles.',
      motivo: `A turma sustenta em média ${Math.round(t.minutosFocoMedio)} min de foco contínuo.`,
    };
  }

  if (nivel === 'critico' || nivel === 'alerta') {
    return {
      titulo: 'Troque a avaliação de hoje por revisão ativa',
      acao: 'Adie a prova, retome o conteúdo em dupla e feche a aula com 5 min de pausa consciente guiada.',
      motivo: `${pct}% da turma está em fadiga ou esgotamento.`,
    };
  }

  if (nivel === 'atencao') {
    return {
      titulo: 'Reduza a carga desta semana',
      acao: 'Corte uma lista de exercícios e confirme individualmente com quem faltou às duas últimas aulas.',
      motivo: `${pct}% da turma já mostra sinais de cansaço.`,
    };
  }

  return {
    titulo: 'Mantenha o ritmo',
    acao: 'A turma tem folga cognitiva: é a semana certa para introduzir o conteúdo mais denso.',
    motivo: `Apenas ${pct}% em fadiga, com média de ${Math.round(t.minutosFocoMedio)} min de foco contínuo.`,
  };
}

export interface ResumoRede {
  turmasMedidas: number;
  alunosMedidos: number;
  /** Percentual de exaustao da escola inteira (nao a media das medias). */
  percentualExaustao: number;
  nivel: NivelCalor;
}

/**
 * Agregado da escola. Soma os alunos antes de dividir de proposito: a
 * media das porcentagens daria o mesmo peso a uma turma de 6 e a uma de
 * 40, e o numero do topo do painel ficaria errado.
 */
export function resumoRede(turmas: readonly TurmaTermometro[]): ResumoRede {
  const visiveis = turmas.filter(temAmostraSuficiente);
  const alunos = visiveis.reduce((s, t) => s + t.comIndice, 0);
  const exaustos = visiveis.reduce((s, t) => s + t.exaustos, 0);
  const pct = alunos > 0 ? Math.round((exaustos / alunos) * 100) : 0;
  return {
    turmasMedidas: visiveis.length,
    alunosMedidos: alunos,
    percentualExaustao: pct,
    nivel: nivelDeCalor(pct),
  };
}
