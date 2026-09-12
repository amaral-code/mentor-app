/**
 * CORRECAO DE REDACAO MANUSCRITA - esquema, prompt e normalizacao.
 *
 * Fonte unica compartilhada pelo worker (rota /api/essays/upload-and-grade)
 * e pelo app (caminho sem worker, com a chave do proprio aluno).
 *
 * O CONTRATO E ESTRITO DE PROPOSITO
 * A tela divide imagem e correcao lado a lado e mostra nota por
 * competencia. Se um campo vier faltando ou uma nota vier fora da grade,
 * a interface quebra na frente do aluno depois de ele ter esperado a
 * transcricao de uma folha inteira. Por isso sao TRES camadas:
 *   1. responseSchema enviado ao Gemini (o modelo ja produz o formato);
 *   2. responseMimeType application/json (sem markdown em volta);
 *   3. normalizarCorrecao() aqui, que conserta o que ainda escapar.
 */

/** As cinco competencias do ENEM, na ordem oficial do INEP. */
export const COMPETENCIAS = [
  {
    chave: 'competence_1',
    titulo: 'Domínio da norma culta',
    guia: 'Domínio da modalidade escrita formal. Avalie ortografia, pontuação, concordância, regência e registro.',
  },
  {
    chave: 'competence_2',
    titulo: 'Compreensão do tema',
    guia: 'Compreensão da proposta e desenvolvimento do tema dentro da estrutura dissertativo-argumentativa. Fuga ao tema zera a competência.',
  },
  {
    chave: 'competence_3',
    titulo: 'Argumentação',
    guia: 'Seleção, relação, organização e interpretação de informações em defesa de um ponto de vista. Avalie o projeto de texto e a autoria.',
  },
  {
    chave: 'competence_4',
    titulo: 'Coesão',
    guia: 'Mecanismos linguísticos de coesão: conectivos, referenciação, articulação entre parágrafos.',
  },
  {
    chave: 'competence_5',
    titulo: 'Proposta de intervenção',
    guia: 'Proposta de intervenção com os cinco elementos: agente, ação, meio/modo, efeito e detalhamento. Diga quais estão presentes e quais faltam.',
  },
];

/** A grade do INEP e discreta: cada competencia vale 0, 40, 80, 120, 160 ou 200. */
export const NOTAS_VALIDAS = [0, 40, 80, 120, 160, 200];

/**
 * responseSchema do Gemini (subconjunto do OpenAPI que a API aceita).
 *
 * `required` em tudo: campo opcional e campo que vem faltando no dia em
 * que a foto esta torta.
 */
const competenciaSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', description: 'Nota da competência: 0, 40, 80, 120, 160 ou 200.' },
    feedback: { type: 'string', description: 'Justificativa objetiva, citando trechos da redação.' },
  },
  required: ['score', 'feedback'],
};

export const ESQUEMA_CORRECAO = {
  type: 'object',
  properties: {
    transcription: { type: 'string', description: 'Transcrição fiel do texto manuscrito, preservando parágrafos.' },
    detected_theme: { type: 'string', description: 'Tema identificado da redação.' },
    scores: {
      type: 'object',
      properties: {
        competence_1: competenciaSchema,
        competence_2: competenciaSchema,
        competence_3: competenciaSchema,
        competence_4: competenciaSchema,
        competence_5: competenciaSchema,
      },
      required: ['competence_1', 'competence_2', 'competence_3', 'competence_4', 'competence_5'],
    },
    total_score: { type: 'integer', description: 'Soma das cinco competências (0 a 1000).' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Pontos fortes concretos do texto.' },
    actionable_improvements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ajustes práticos e específicos para a próxima redação.',
    },
  },
  required: ['transcription', 'detected_theme', 'scores', 'total_score', 'strengths', 'actionable_improvements'],
};

/**
 * Prompt da correcao.
 *
 * Duas tarefas numa chamada so - transcrever e corrigir - porque sao
 * duas passadas na MESMA imagem: separar em duas chamadas dobraria custo
 * e latencia sem ganho de qualidade, e ainda abriria a chance de a
 * correcao avaliar uma transcricao diferente da que o aluno le na tela.
 */
export function promptCorrecaoFoto(temaInformado) {
  const guias = COMPETENCIAS.map((c, i) => `${i + 1}. ${c.titulo} — ${c.guia}`).join('\n');

  return [
    'PAPEL: você é um Corretor Oficial do ENEM, aplicando a grade do INEP com o rigor da banca — sem benevolência, sem invenção.',
    '',
    'Você recebeu a FOTO de uma redação manuscrita, escrita à mão em folha de caderno por um estudante brasileiro do ensino médio.',
    '',
    'TAREFA 1 — TRANSCRIÇÃO',
    'Transcreva o texto manuscrito integralmente e com fidelidade, preservando a divisão em parágrafos.',
    'Mantenha os erros do aluno como estão: você é um escâner, não um revisor — a correção depende de enxergar os desvios reais.',
    'Se uma palavra estiver ilegível, escreva [ilegível] no lugar dela em vez de adivinhar.',
    'Se a foto estiver cortada, escura ou fora de foco a ponto de impedir a leitura, diga isso no campo transcription e atribua 0 a todas as competências.',
    '',
    'TAREFA 2 — CORREÇÃO PELA GRADE OFICIAL DO INEP',
    temaInformado
      ? `O tema proposto é: "${temaInformado}". Avalie a aderência a ele.`
      : 'O tema não foi informado: identifique-o a partir do próprio texto e registre em detected_theme.',
    '',
    'Avalie as cinco competências:',
    guias,
    '',
    'REGRAS DE PONTUAÇÃO',
    '- Cada competência vale exatamente 0, 40, 80, 120, 160 ou 200. Não use valores intermediários.',
    '- total_score é a soma das cinco (0 a 1000).',
    '- Seja rigoroso como um corretor do ENEM: 200 exige domínio excelente, não apenas ausência de erro grave.',
    '- ESTRUTURA OBRIGATÓRIA da resposta: nota final exata; pontuação detalhada das 5 competências; o que o aluno acertou (strengths); o que precisa melhorar em detalhe (actionable_improvements).',
    '',
    'FIM DAS ALUCINAÇÕES — regra de ouro:',
    '- Todo feedback de competência PRECISA citar pelo menos um trecho literal da transcrição entre aspas. Sem trecho citado, o feedback não vale.',
    '- PROIBIDO: inventar frases que o aluno não escreveu, elogiar ou criticar algo sem apontar onde está no texto, dar nota 200 sem justificar com exemplo concreto.',
    '- Se um trecho citado não existir na transcrição, a correção inteira é inválida: confira antes de responder.',
    '- Em cada feedback, cite um trecho concreto da redação. Feedback genérico não ensina nada.',
    '- Na competência 5, liste explicitamente quais dos cinco elementos (agente, ação, meio, efeito, detalhamento) estão presentes e quais faltam.',
    '',
    'strengths: 2 a 4 pontos fortes reais do texto, cada um ancorado num trecho citado.',
    'actionable_improvements: 2 a 4 ajustes práticos para a PRÓXIMA redação, no imperativo e específicos, mostrando como reescrever o trecho citado.',
    'Escreva todo o feedback em português brasileiro, falando com o estudante em segunda pessoa, sem ironia e sem elogio vazio.',
  ].join('\n');
}

/**
 * Ajusta uma nota qualquer para o valor mais proximo da grade do INEP.
 *
 * EMPATE DESCE. Um valor exatamente no meio (100, entre 80 e 120) vira
 * 80. E rede de seguranca para resposta malformada do modelo, e nota
 * inflada e pior que nota conservadora para quem se prepara para uma
 * prova que nao vai inflar nada.
 */
export function ajustarParaGrade(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const limitado = Math.max(0, Math.min(n, 200));
  return NOTAS_VALIDAS.reduce((melhor, atual) =>
    Math.abs(atual - limitado) < Math.abs(melhor - limitado) ? atual : melhor,
  );
}

function textoLimpo(valor, padrao = '') {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : padrao;
}

function listaDeTextos(valor, maximo = 4) {
  if (!Array.isArray(valor)) return [];
  return valor.map((v) => textoLimpo(v)).filter(Boolean).slice(0, maximo);
}

/**
 * Normaliza a resposta do modelo para o contrato publicado.
 *
 * O total e SEMPRE recalculado a partir das competencias: quando o
 * modelo erra a soma (acontece), a tela mostraria uma nota geral que nao
 * bate com o detalhamento logo abaixo - e e a soma que o aluno confere.
 */
export function normalizarCorrecao(bruto) {
  const dados = bruto && typeof bruto === 'object' ? bruto : {};
  const notas = dados.scores && typeof dados.scores === 'object' ? dados.scores : {};

  const scores = {};
  let total = 0;

  for (const { chave, titulo } of COMPETENCIAS) {
    const item = notas[chave] && typeof notas[chave] === 'object' ? notas[chave] : {};
    const score = ajustarParaGrade(item.score);
    total += score;
    scores[chave] = {
      score,
      feedback: textoLimpo(item.feedback, `Sem análise detalhada de ${titulo.toLowerCase()} nesta correção.`),
    };
  }

  return {
    transcription: textoLimpo(dados.transcription, ''),
    detected_theme: textoLimpo(dados.detected_theme, 'Tema não identificado'),
    scores,
    total_score: total,
    strengths: listaDeTextos(dados.strengths),
    actionable_improvements: listaDeTextos(dados.actionable_improvements),
  };
}

/**
 * A foto era legivel?
 *
 * Transcricao curta demais quase sempre significa foto ruim, nao redacao
 * curta - uma redacao de caderno tem centenas de caracteres. Serve para
 * a tela pedir outra foto em vez de exibir "0/1000" como se fosse
 * avaliacao do texto.
 */
export function pareceFotoIlegivel(correcao) {
  const t = correcao?.transcription || '';
  return t.replace(/\[ilegível\]/gi, '').trim().length < 180;
}

/** Tipos de imagem aceitos no upload. */
export const MIMES_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** Teto do upload: 8 MB ja cobre foto de celular com folga apos a compressao do cliente. */
export const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024;
