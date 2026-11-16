import type { LogEntry, MetricasDescompressao, QuizResult, SessaoOffline } from '../types';

/**
 * RELATORIO DE DESCOMPRESSAO SEMANAL.
 *
 * A diferenca em relacao ao relatorio antigo nao e de layout, e de
 * criterio: ele nao mede desempenho. Mede o que sustenta o desempenho -
 * sono, tempo longe da tela, constancia - e devolve isso como validacao.
 *
 * POR QUE ISSO E UMA FUNCIONALIDADE, E NAO ENFEITE
 * Painel de acertos e erros na sexta-feira, para quem teve uma semana
 * ruim, e mais uma nota baixa no fim de uma semana de notas baixas. A
 * evidencia de que a pessoa apareceu tres dias, dormiu melhor e ficou
 * quatro horas longe do celular e informacao real e e a unica que ela
 * consegue usar no sabado de manha.
 *
 * REGRAS DO TEXTO (aplicadas no prompt e no fallback):
 *   - no maximo 4 frases, sem lista;
 *   - cita PELO MENOS UM numero concreto da semana - elogio generico soa
 *     automatico e o adolescente identifica na hora;
 *   - nao cobra, nao compara com outros alunos, nao promete resultado;
 *   - quando a semana foi fraca, valida o pouco que houve sem fingir que
 *     foi muito.
 */

const MS_DIA = 86_400_000;

/** Segunda-feira da semana de uma data (a semana escolar comeca nela). */
export function inicioDaSemana(data: Date = new Date()): string {
  const d = new Date(data);
  const diaSemana = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - diaSemana);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * O relatorio nasce na sexta.
 *
 * Sexta a tarde e quando a semana ainda esta na memoria e o fim de
 * semana pode ser reorganizado. Sabado ja e tarde e segunda vira cobranca
 * retroativa. Se o aluno so abrir o app no domingo, ele ainda ve o
 * relatorio da semana - o que a funcao decide e quando GERAR.
 */
export function deveGerarRelatorio(
  ultimaSemanaGerada: string | null,
  agora: Date = new Date(),
): boolean {
  const ehSextaOuDepois = agora.getDay() === 5 || agora.getDay() === 6 || agora.getDay() === 0;
  if (!ehSextaOuDepois) return false;
  return ultimaSemanaGerada !== inicioDaSemana(agora);
}

export interface EntradaMetricas {
  logs: LogEntry[];
  sessoesOffline: SessaoOffline[];
  sessoesFoco: { tipo: string; minutos: number; data: string }[];
  quizzes: QuizResult[];
  /** Horas de sono informadas na semana (slider do dashboard). */
  registrosSono: number[];
  streak: number;
  /** Revisoes do calendario adaptativo feitas no prazo. */
  revisoesEmDia: number;
}

/** Agrega a semana. Funcao pura - a mesma entrada da o mesmo relatorio. */
export function calcularMetricas(
  entrada: EntradaMetricas,
  agora: Date = new Date(),
): MetricasDescompressao {
  const corte = agora.getTime() - 7 * MS_DIA;

  const logsSemana = entrada.logs.filter((l) => l.timestamp >= corte);
  const diasAtivos = new Set(logsSemana.map((l) => new Date(l.timestamp).toDateString())).size;

  const offlineSemana = entrada.sessoesOffline.filter(
    (s) => new Date(s.inicio).getTime() >= corte,
  );
  const minutosOffline = offlineSemana.reduce((a, s) => a + s.minutosOffline, 0);

  const focoSemana = entrada.sessoesFoco.filter(
    (s) => s.tipo === 'foco' && new Date(s.data).getTime() >= corte,
  );
  const minutosFoco = focoSemana.reduce((a, s) => a + s.minutos, 0);

  const quizSemana = entrada.quizzes.filter((q) => q.timestamp >= corte);
  const questoesRespondidas = quizSemana.reduce((a, q) => a + q.total, 0);
  const acertos = quizSemana.reduce((a, q) => a + q.acertos, 0);

  const sono = entrada.registrosSono.filter((h) => h > 0);
  const horasSonoMedia = sono.length
    ? Math.round((sono.reduce((a, b) => a + b, 0) / sono.length) * 10) / 10
    : 0;

  // "Madrugada" aqui e atividade registrada entre 0h e 5h: e o indicador
  // que o painel dos pais cruza com o indice de burnout.
  const sessoesMadrugada = new Set(
    logsSemana
      .filter((l) => {
        const h = new Date(l.timestamp).getHours();
        return h >= 0 && h < 5;
      })
      .map((l) => new Date(l.timestamp).toDateString()),
  ).size;

  return {
    diasAtivos,
    minutosOffline,
    minutosFoco,
    horasSonoMedia,
    questoesRespondidas,
    taxaAcerto: questoesRespondidas ? Math.round((acertos / questoesRespondidas) * 100) : 0,
    streak: entrada.streak,
    sessoesMadrugada,
    revisoesEmDia: entrada.revisoesEmDia,
  };
}

/**
 * Prompt de sistema do Gemini.
 *
 * Vai separado do prompt de usuario de proposito: o system e a POSTURA
 * (quem fala, o que nunca faz) e o user e o DADO da semana. Misturar os
 * dois faz o modelo tratar as regras como sugestao quando os numeros sao
 * ruins - justamente o caso em que elas mais importam.
 */
export const SYSTEM_PROMPT_DESCOMPRESSAO = [
  'Voce escreve o fechamento semanal de um app de estudos para adolescentes brasileiros do ensino medio noturno, que trabalham de dia.',
  'Seu papel e reconhecer esforco real com base em dados de bem-estar, nao avaliar desempenho.',
  '',
  'Sempre:',
  '• Escreva UM paragrafo, no maximo 4 frases, em portugues brasileiro.',
  '• Cite pelo menos um numero concreto da semana (dias, minutos, horas).',
  '• Fale direto com a pessoa ("voce"), em tom calmo e adulto.',
  '',
  'Nunca:',
  '• Cobrar, sugerir meta, dizer "mas" seguido de recomendacao.',
  '• Comparar com outros alunos ou com semanas anteriores em tom de queda.',
  '• Usar emoji, exclamacao dupla, "parabens!!" ou linguagem de coach.',
  '• Prometer aprovacao, nota ou resultado futuro.',
  '• Mencionar que voce e uma IA ou que recebeu dados.',
  '',
  'Se a semana teve pouca atividade, valide o que existiu sem exagerar: uma hora de estudo depois de um dia de trabalho e uma hora real.',
].join('\n');

/** Prompt de usuario: so os dados, ja em portugues legivel. */
export function promptDescompressao(m: MetricasDescompressao, primeiroNome?: string): string {
  const linhas = [
    primeiroNome ? `Estudante: ${primeiroNome}` : '',
    `Dias com estudo na semana: ${m.diasAtivos} de 7`,
    `Sequencia atual: ${m.streak} dias`,
    `Tempo longe da tela em modo foco: ${m.minutosOffline} minutos`,
    `Tempo em ciclos de foco no app: ${m.minutosFoco} minutos`,
    `Media de sono declarada: ${m.horasSonoMedia} horas por noite`,
    `Questoes respondidas: ${m.questoesRespondidas} (${m.taxaAcerto}% de acerto)`,
    `Revisoes feitas no prazo: ${m.revisoesEmDia}`,
    `Noites com estudo entre 0h e 5h: ${m.sessoesMadrugada}`,
  ].filter(Boolean);

  return [
    'Escreva o paragrafo de fechamento da semana com base nestes dados:',
    '',
    ...linhas,
    '',
    'Lembre: reforco positivo curto e direto, um paragrafo, com pelo menos um numero.',
  ].join('\n');
}

/**
 * Texto local, usado quando a IA nao esta configurada ou falha.
 *
 * Nao e um "erro bonitinho": o relatorio de sexta e uma promessa
 * semanal, e uma promessa que depende de rede fica quebrada justamente
 * na semana em que a pessoa mais precisa dela. Entao existe uma versao
 * que roda offline, escrita sob as mesmas regras.
 */
export function textoLocalDescompressao(m: MetricasDescompressao, primeiroNome?: string): string {
  const nome = primeiroNome ? `${primeiroNome}, ` : '';

  if (m.diasAtivos === 0) {
    return `${nome}esta semana o app ficou parado, e tudo bem, semana cheia acontece. A conta continua aqui do jeito que voce deixou, com ${m.streak} dia(s) de sequencia guardados. Quando der, dez minutos ja recomecam a curva.`;
  }

  const partes: string[] = [];
  partes.push(
    `${nome}voce apareceu em ${m.diasAtivos} dos 7 dias desta semana` +
      (m.streak > 1 ? `, mantendo ${m.streak} dias de sequencia.` : '.'),
  );

  if (m.minutosOffline >= 30) {
    partes.push(
      `Foram ${m.minutosOffline} minutos de tela bloqueada no modo foco, e esse tempo longe do celular e o que faz o resto render.`,
    );
  } else if (m.minutosFoco >= 25) {
    partes.push(`Deu para somar ${m.minutosFoco} minutos em ciclos de foco, o que ja e um bloco inteiro de concentracao.`);
  }

  if (m.horasSonoMedia >= 7) {
    partes.push(`E voce dormiu ${m.horasSonoMedia}h por noite em media, que e a parte do estudo que ninguem ve.`);
  } else if (m.questoesRespondidas > 0) {
    partes.push(`Ainda deu conta de ${m.questoesRespondidas} questoes no meio disso tudo.`);
  }

  return partes.slice(0, 4).join(' ');
}

/** Destaques mostrados como cartoes ao lado do texto. */
export function destaquesDaSemana(m: MetricasDescompressao): { rotulo: string; valor: string; nota: string }[] {
  return [
    {
      rotulo: 'Dias que voce apareceu',
      valor: `${m.diasAtivos}/7`,
      nota: m.diasAtivos >= 4 ? 'constancia acima da media' : 'cada dia conta',
    },
    {
      rotulo: 'Tempo longe da tela',
      valor: `${Math.floor(m.minutosOffline / 60)}h${String(m.minutosOffline % 60).padStart(2, '0')}`,
      nota: 'modo foco offline',
    },
    {
      rotulo: 'Sono medio',
      valor: m.horasSonoMedia ? `${m.horasSonoMedia}h` : 'sem registro',
      nota: m.horasSonoMedia >= 7 ? 'faixa saudavel' : 'da para melhorar sem culpa',
    },
    {
      rotulo: 'Sequencia',
      valor: `${m.streak} dias`,
      nota: m.sessoesMadrugada > 0 ? `${m.sessoesMadrugada} noite(s) de madrugada` : 'nenhuma virada',
    },
  ];
}
