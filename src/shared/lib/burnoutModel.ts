import type { ClasseBurnout, EventoTelemetria } from '../types';

/**
 * MOTOR DE PREDICAO DE FADIGA - regressao logistica em JS puro.
 *
 * POR QUE REGRESSAO LOGISTICA E NAO RANDOM FOREST
 * Uma floresta acerta mais quando ha dezenas de milhares de exemplos, e
 * nao e o caso: cada aluno gera algumas dezenas de dias rotulados. Com
 * poucos dados a floresta decora, e pior - ela nao explica. Aqui a
 * explicacao E o produto: o painel dos pais precisa dizer "o que pesou
 * foi madrugada + queda de rendimento", nao "o modelo achou". Cada peso
 * abaixo se le direto como contribuicao, e a mesma matematica cabe em
 * poucas linhas rodando no navegador, sem servico de inferencia.
 *
 * A porta para a floresta fica aberta: treinarLogistica devolve pesos no
 * mesmo formato de PESOS_PADRAO, entao trocar o estimador depois nao
 * muda nada do lado de fora.
 *
 * O QUE O MODELO CRUZA (o pedido original: taxa de erro x horario)
 *   f1 taxaErro             - erros / total no periodo
 *   f2 excessoTempoFacil    - tempo em questoes FACEIS sobre o esperado.
 *                             Travar numa questao facil e o sinal mais
 *                             precoce de exaustao: a pessoa le tres vezes
 *                             e nao processa.
 *   f3 quedaRendimento      - inclinacao da acuracia ao longo dos dias
 *   f4 fracaoMadrugada      - proporcao de respostas entre 0h e 5h
 *   f5 horasEstudoDia       - volume medio diario
 *   f6 diasSemPausa         - dias CONSECUTIVOS com atividade, extraidos
 *                             da telemetria (nunca do streak de acesso:
 *                             abrir o app todo dia e saudavel e nao pode
 *                             empurrar o score sozinho). Teto de 7: rotina
 *                             de semanas seguidas e normal no ENEM, o
 *                             sinal agudo e uma semana sem descanso.
 *   f7 deficitSono          - horas abaixo de 8 (slider do dashboard)
 */

export const NOMES_FEATURES = [
  'taxaErro',
  'excessoTempoFacil',
  'quedaRendimento',
  'fracaoMadrugada',
  'horasEstudoDia',
  'diasSemPausa',
  'deficitSono',
] as const;

export type NomeFeature = (typeof NOMES_FEATURES)[number];
export type VetorFeatures = Record<NomeFeature, number>;

export interface PesosModelo {
  /** Intercepto (log-odds com todas as features na media). */
  bias: number;
  /** Peso por feature, na ordem de NOMES_FEATURES. */
  pesos: number[];
  /** Media usada na padronizacao (z-score). */
  media: number[];
  /** Desvio padrao usado na padronizacao. */
  desvio: number[];
  versao: string;
}

/**
 * Pesos iniciais.
 *
 * Origem honesta: nao existe base rotulada de producao ainda. Estes
 * valores vem de um ajuste sobre dados sinteticos construidos a partir
 * da literatura de burnout academico (Maslach: exaustao, cinismo, baixa
 * eficacia) somada ao que o app ja media (SSC, sono, cansaco). Servem
 * para o sistema funcionar no dia 1 e devem ser SUBSTITUIDOS por
 * treinarLogistica assim que houver rotulos reais - o formato e o mesmo,
 * entao a troca e uma constante.
 *
 * Leitura dos sinais: todos positivos empurram para fadiga, exceto
 * horasEstudoDia, que sozinha e ambigua (estudar muito nao e doenca) e
 * por isso pesa pouco - ela so faz diferenca somada a sono ruim e
 * madrugada.
 */
export const PESOS_PADRAO: PesosModelo = {
  bias: -0.85,
  pesos: [1.15, 0.95, 0.8, 1.05, 0.25, 0.7, 0.9],
  media: [0.35, 1.0, 0.0, 0.1, 1.5, 3.0, 1.0],
  desvio: [0.18, 0.55, 0.25, 0.18, 1.1, 2.5, 1.4],
  versao: 'logit-v1-sintetico',
};

export function sigmoide(z: number): number {
  // Duas formas da mesma funcao: para z muito negativo, exp(-z) estoura.
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

function padronizar(x: number[], modelo: PesosModelo): number[] {
  return x.map((v, i) => (v - (modelo.media[i] ?? 0)) / (modelo.desvio[i] || 1));
}

export function vetorParaArray(f: VetorFeatures): number[] {
  return NOMES_FEATURES.map((n) => f[n] ?? 0);
}

export interface PrevisaoBurnout {
  probabilidade: number; // 0-1
  score: number; // 0-100
  classe: ClasseBurnout;
  /** Contribuicao de cada feature no log-odds, ordenada por peso absoluto. */
  contribuicoes: { feature: NomeFeature; valor: number; contribuicao: number }[];
  /** As duas features que mais empurraram para cima, em portugues. */
  motivos: string[];
}

const ROTULO: Record<NomeFeature, string> = {
  taxaErro: 'taxa de erro alta',
  excessoTempoFacil: 'tempo demais em questões fáceis',
  quedaRendimento: 'queda de rendimento nas últimas sessões',
  fracaoMadrugada: 'estudo de madrugada',
  horasEstudoDia: 'volume diário elevado',
  diasSemPausa: 'dias seguidos sem pausa',
  deficitSono: 'poucas horas de sono',
};

/**
 * Chave do índice de cansaço. LIGADO (false) desde 2026-09-24.
 *
 * O dono desligou o índice porque o número incomodava; religou quando
 * ficou claro o custo: com a flag em true nada chega a `indice_burnout`,
 * e ficam vazios o termômetro do professor e da secretaria, o índice que
 * o psicólogo vê e o escopo `bem_estar` do consentimento. Com true, o
 * store devolve 0 / "saudável" em todo lugar e não grava nada; o modelo
 * puro (preverBurnout/classificar) segue testado nos dois casos.
 */
export const FADIGA_ZERADA = false;

/** Previsão neutra usada em todo lugar quando FADIGA_ZERADA. */
export const PREVISAO_ZERADA: PrevisaoBurnout = {
  probabilidade: 0,
  score: 0,
  classe: 'saudavel',
  contribuicoes: [],
  motivos: [],
};

export function classificar(score: number): ClasseBurnout {
  if (score >= 80) return 'esgotamento';
  if (score >= 60) return 'fadiga';
  if (score >= 35) return 'alerta';
  return 'saudavel';
}

/** Aplica o modelo. Funcao pura: mesma entrada, mesma saida. */
export function preverBurnout(
  features: VetorFeatures,
  modelo: PesosModelo = PESOS_PADRAO,
): PrevisaoBurnout {
  const bruto = vetorParaArray(features);
  const z = padronizar(bruto, modelo);

  let logit = modelo.bias;
  const contribuicoes = z.map((zi, i) => {
    const c = (modelo.pesos[i] ?? 0) * zi;
    logit += c;
    return { feature: NOMES_FEATURES[i], valor: bruto[i], contribuicao: c };
  });

  const probabilidade = sigmoide(logit);
  const score = Math.round(probabilidade * 100);

  const motivos = contribuicoes
    .filter((c) => c.contribuicao > 0.15)
    .sort((a, b) => b.contribuicao - a.contribuicao)
    .slice(0, 2)
    .map((c) => ROTULO[c.feature]);

  return {
    probabilidade,
    score,
    classe: classificar(score),
    contribuicoes: [...contribuicoes].sort(
      (a, b) => Math.abs(b.contribuicao) - Math.abs(a.contribuicao),
    ),
    motivos,
  };
}

// =====================================================================
// Extracao de features a partir da telemetria bruta
// =====================================================================

/**
 * Tempo esperado por dificuldade, em segundos. Referencia: o ENEM da
 * 180 minutos para 90 questoes (120 s por questao em media); as faixas
 * abrem em torno disso. Serve de denominador do excesso de tempo.
 */
export const TEMPO_ESPERADO: Record<string, number> = { facil: 60, media: 120, dificil: 210 };

export interface ContextoAluno {
  /** Horas de sono informadas no dashboard (slider). */
  horasSono?: number;
}

/** Teto de dias sem pausa: rotina longa e normal, o agudo e 1 semana. */
export const TETO_DIAS_SEM_PAUSA = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Dias consecutivos com atividade, contando para tras a partir de hoje
 * (ou de ontem, se hoje ainda nao tem evento). Um dia de descanso zera.
 * As chaves vêm em UTC (mesma base do agrupamento por dia).
 */
export function diasConsecutivosComEstudo(diasISO: string[]): number {
  if (diasISO.length === 0) return 0;
  const set = new Set(diasISO);
  const agora = new Date();
  const hojeUTC = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  const chave = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  let cursor = set.has(chave(hojeUTC)) ? hojeUTC : hojeUTC - DIA_MS;
  let n = 0;
  while (set.has(chave(cursor))) {
    n++;
    cursor -= DIA_MS;
  }
  return Math.min(n, TETO_DIAS_SEM_PAUSA);
}

/**
 * Converte eventos brutos em features.
 *
 * Janela padrao: 7 dias. Menos que isso e ruido de um dia ruim; mais
 * demora a reagir, e a graca esta em chegar ANTES do colapso.
 */
export function extrairFeatures(
  eventos: EventoTelemetria[],
  contexto: ContextoAluno = {},
  janelaDias = 7,
): VetorFeatures {
  const corte = Date.now() - janelaDias * 24 * 60 * 60 * 1000;
  const janela = eventos.filter((e) => e.timestamp >= corte);

  if (janela.length === 0) {
    return {
      taxaErro: 0,
      excessoTempoFacil: 1,
      quedaRendimento: 0,
      fracaoMadrugada: 0,
      horasEstudoDia: 0,
      diasSemPausa: 0,
      deficitSono: Math.max(0, 8 - (contexto.horasSono ?? 8)),
    };
  }

  const erros = janela.filter((e) => !e.acertou).length;
  const taxaErro = erros / janela.length;

  // Excesso de tempo nas FACEIS. Sem questao facil na janela o indicador
  // nao se aplica: devolve 1 (neutro) em vez de inventar um numero.
  const faceis = janela.filter((e) => e.dificuldade === 'facil');
  const excessoTempoFacil = faceis.length
    ? Math.min(
        3,
        faceis.reduce((a, e) => a + e.tempoGastoSegundos, 0) / (faceis.length * TEMPO_ESPERADO.facil),
      )
    : 1;

  // Acuracia por dia -> inclinacao. Sinal invertido para que "positivo"
  // signifique "piorando", como as demais features.
  const porDia = new Map<string, { certos: number; total: number }>();
  for (const e of janela) {
    const dia = new Date(e.timestamp).toISOString().slice(0, 10);
    const d = porDia.get(dia) ?? { certos: 0, total: 0 };
    d.total += 1;
    if (e.acertou) d.certos += 1;
    porDia.set(dia, d);
  }
  const serie = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v.certos / v.total);
  const quedaRendimento = -inclinacao(serie);

  const madrugada = janela.filter((e) => e.horaLocal >= 0 && e.horaLocal < 5).length;
  const fracaoMadrugada = madrugada / janela.length;

  const segundosTotais = janela.reduce((a, e) => a + e.tempoGastoSegundos, 0);
  const diasComEstudo = Math.max(1, porDia.size);
  const horasEstudoDia = segundosTotais / 3600 / diasComEstudo;

  return {
    taxaErro,
    excessoTempoFacil,
    quedaRendimento,
    fracaoMadrugada,
    horasEstudoDia,
    diasSemPausa: diasConsecutivosComEstudo([...porDia.keys()]),
    deficitSono: Math.max(0, 8 - (contexto.horasSono ?? 8)),
  };
}

/** Inclinacao por minimos quadrados de uma serie indexada por posicao. */
export function inclinacao(serie: number[]): number {
  const n = serie.length;
  if (n < 2) return 0;
  const mediaX = (n - 1) / 2;
  const mediaY = serie.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mediaX) * (serie[i] - mediaY);
    den += (i - mediaX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// =====================================================================
// Treino (gradiente descendente com regularizacao L2)
// =====================================================================

export interface AmostraTreino {
  features: VetorFeatures;
  /** 1 = houve burnout confirmado (aluno relatou ou parou), 0 = nao. */
  rotulo: 0 | 1;
}

export interface OpcoesTreino {
  taxaAprendizado?: number;
  epocas?: number;
  /** Forca da regularizacao L2. Segura os pesos quando ha poucos dados. */
  l2?: number;
}

/**
 * Reajusta o modelo com dados reais.
 *
 * Roda em segundos para milhares de amostras, entao cabe num job noturno
 * (ou num teste) sem infra de ML. A padronizacao sai do proprio conjunto
 * - por isso os pesos so fazem sentido junto com a media e o desvio
 * devolvidos aqui.
 */
export function treinarLogistica(
  amostras: AmostraTreino[],
  opcoes: OpcoesTreino = {},
): PesosModelo {
  const { taxaAprendizado = 0.1, epocas = 400, l2 = 0.01 } = opcoes;
  const n = amostras.length;
  const k = NOMES_FEATURES.length;
  if (n === 0) return PESOS_PADRAO;

  const X = amostras.map((a) => vetorParaArray(a.features));
  const y = amostras.map((a) => a.rotulo);

  const media = Array.from({ length: k }, (_, j) => X.reduce((s, x) => s + x[j], 0) / n);
  const desvio = Array.from({ length: k }, (_, j) => {
    const v = X.reduce((s, x) => s + (x[j] - media[j]) ** 2, 0) / n;
    // Feature constante: divisor 1 em vez de NaN silencioso.
    return Math.sqrt(v) || 1;
  });
  const Z = X.map((x) => x.map((v, j) => (v - media[j]) / desvio[j]));

  let bias = 0;
  const pesos: number[] = new Array(k).fill(0);

  for (let epoca = 0; epoca < epocas; epoca++) {
    const gradPesos: number[] = new Array(k).fill(0);
    let gradBias = 0;

    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < k; j++) z += pesos[j] * Z[i][j];
      const erro = sigmoide(z) - y[i];
      gradBias += erro;
      for (let j = 0; j < k; j++) gradPesos[j] += erro * Z[i][j];
    }

    bias -= (taxaAprendizado * gradBias) / n;
    for (let j = 0; j < k; j++) {
      pesos[j] -= taxaAprendizado * (gradPesos[j] / n + l2 * pesos[j]);
    }
  }

  return { bias, pesos, media, desvio, versao: 'logit-treinado-' + n };
}

/** Acuracia num conjunto rotulado - para acompanhar o reajuste. */
export function avaliar(amostras: AmostraTreino[], modelo: PesosModelo, limiar = 0.5): number {
  if (amostras.length === 0) return 0;
  const acertos = amostras.filter(
    (a) => (preverBurnout(a.features, modelo).probabilidade >= limiar ? 1 : 0) === a.rotulo,
  ).length;
  return acertos / amostras.length;
}

// =====================================================================
// Decisoes de produto derivadas da classe
// =====================================================================

/**
 * Conteudo denso (simulado completo, redacao cronometrada, aula longa)
 * fica bloqueado em fadiga e esgotamento. Nao e censura: revisao leve,
 * audio e quiz curto continuam abertos. O que sai de cena e o que exige
 * duas horas de concentracao de quem hoje nao tem duas horas de
 * concentracao.
 */
export function deveBloquearConteudoDenso(classe: ClasseBurnout): boolean {
  return classe === 'fadiga' || classe === 'esgotamento';
}

export function sugestaoPausa(classe: ClasseBurnout): { minutos: number; texto: string } {
  switch (classe) {
    case 'esgotamento':
      return {
        minutos: 1440,
        texto: 'Hoje o melhor estudo é dormir. Volte amanhã: seu lugar continua aqui.',
      };
    case 'fadiga':
      return {
        minutos: 120,
        texto: 'Duas horas longe da tela agora rendem mais que duas horas insistindo.',
      };
    case 'alerta':
      return { minutos: 20, texto: 'Vinte minutos de pausa e uma revisão curta depois. Só isso.' };
    default:
      return { minutos: 5, texto: 'Ritmo saudável. Uma pausa curta a cada bloco mantém assim.' };
  }
}

export const ROTULO_CLASSE: Record<ClasseBurnout, string> = {
  saudavel: 'Ritmo saudável',
  alerta: 'Sinal amarelo',
  fadiga: 'Fadiga acumulada',
  esgotamento: 'Risco de esgotamento',
};

export const COR_CLASSE: Record<ClasseBurnout, string> = {
  saudavel: '#10b981',
  alerta: '#f59e0b',
  fadiga: '#f97316',
  esgotamento: '#ef4444',
};
