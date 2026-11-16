import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker.js';

/**
 * Testes do worker.
 *
 * Ele e um modulo estilo Cloudflare - export default { fetch(req, env) } -
 * entao roda igual dentro do Vitest: Requests reais, `env` de mentira e
 * todo fetch de saida interceptado.
 *
 * O que se prova aqui e o que nenhum teste de front alcanca: quem pode
 * pagar, quem pode confirmar pagamento, o que e repassado ao Google e o
 * que acontece quando falta um segredo. Sao as tres operacoes que o
 * navegador NAO pode fazer.
 */

const AGENDAMENTO = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USUARIO = '11111111-2222-3333-4444-555555555555';

const ENV = {
  /*
   * Provedor DECLARADO de proposito.
   *
   * Os testes deste arquivo exercitam os caminhos do Gemini (ferramentas
   * de busca, badges de fonte, lista de modelos permitidos) e antes
   * dependiam de o padrao do worker ser Gemini. O padrao virou DeepSeek -
   * o mesmo que o wrangler.toml, o README e o api/config.js sempre
   * declararam - entao o provedor passa a ser dito aqui em vez de
   * herdado. O que cada teste prova continua identico.
   */
  AI_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'chave-gemini',
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_SERVICE_KEY: 'service-role-secreta',
  JITSI_BASE: 'https://meet.jit.si',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

let saidas = [];

/** Respostas do "mundo externo", sobrescreviveis por teste. */
function mundo({ agendamento = {}, usuario = { id: USUARIO }, pagamento } = {}) {
  return [
    ['/auth/v1/user', () => (usuario ? json(usuario) : json({}, 401))],
    ['/rest/v1/agendamentos', () =>
      json([{ id: AGENDAMENTO, aluno_id: USUARIO, responsavel_id: null,
              valor_centavos: 15000, status_pagamento: 'pendente', ...agendamento }])],
    ['/rest/v1/rpc/confirmar_pagamento_consulta', () => json({})],
    ['/rest/v1/notificacoes', () => json([{ id: 'n1', user_id: USUARIO, titulo: 'Alerta', corpo: 'texto' }])],
    ['/rest/v1/perfis', () => json([{ email: 'mae@test.br' }])],
    ['generativelanguage', () => json({ candidates: [{ content: { parts: [{ text: 'oi' }] } }] })],
    ['texttospeech', () => json({ audioContent: 'QUJD' })],
    ['api.mercadopago.com/checkout/preferences', () => json({ init_point: 'https://mp/checkout/xyz', id: 'pref-1' })],
    ['api.mercadopago.com/v1/payments', () =>
      json(pagamento ?? { status: 'approved', external_reference: AGENDAMENTO, id: 'pay-9' })],
    ['api.resend.com', () => json({ id: 'email-1' })],
  ];
}

async function chamar(caminho, { metodo = 'POST', corpo, cabecalhos = {}, env = ENV, respostas } = {}) {
  saidas = [];
  const rotas = respostas ?? mundo();
  vi.stubGlobal('fetch', async (url, init = {}) => {
    const u = String(url);
    saidas.push({ url: u, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    for (const [padrao, resposta] of rotas) if (u.includes(padrao)) return resposta();
    return json({});
  });

  const resposta = await worker.fetch(
    new Request('https://worker.dev' + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...cabecalhos },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }),
    env,
  );

  let dados = null;
  try { dados = JSON.parse(await resposta.clone().text()); } catch { /* nao-json */ }
  return { status: resposta.status, dados, headers: resposta.headers, saidas };
}

const saidaPara = (r, trecho) => r.saidas.find((s) => s.url.includes(trecho));

beforeEach(() => vi.unstubAllGlobals());

describe('rotas basicas', () => {
  it('health informa em que modo o worker esta', async () => {
    const r = await chamar('/health', { metodo: 'GET' });
    expect(r.status).toBe(200);
    // "simulado" = sem chave de pagamento. Publicar assim e dar consulta
    // de graca, por isso o modo aparece no health.
    expect(r.dados.pagamento).toBe('simulado');
    expect(r.dados.tts).toBe(false);

    const comMp = await chamar('/health', { metodo: 'GET', env: { ...ENV, MP_ACCESS_TOKEN: 'x' } });
    expect(comMp.dados.pagamento).toBe('mercadopago');
  });

  it('responde ao preflight liberando o cabecalho de sessao', async () => {
    const r = await chamar('/generate', { metodo: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('X-Supabase-Auth');
  });

  it('rota desconhecida da 404', async () => {
    expect((await chamar('/inexistente')).status).toBe(404);
  });
});

describe('/generate', () => {
  it('encaminha ao Gemini com a chave do servidor', async () => {
    const r = await chamar('/generate', { corpo: { contents: [{ parts: [{ text: 'oi' }] }] } });
    expect(r.status).toBe(200);
    expect(saidaPara(r, 'generativelanguage').url).toContain('key=chave-gemini');
  });

  it('nao deixa o cliente escolher um modelo fora da lista', async () => {
    const r = await chamar('/generate', { corpo: { model: 'gemini-1.5-pro-caro', contents: [] } });
    expect(saidaPara(r, 'generativelanguage').url).toContain('gemini-2.0-flash');
  });

  it('sem GEMINI_API_KEY responde 500 em vez de chamar o Google', async () => {
    const r = await chamar('/generate', { corpo: {}, env: { ...ENV, GEMINI_API_KEY: '' } });
    expect(r.status).toBe(500);
    expect(saidaPara(r, 'generativelanguage')).toBeUndefined();
  });

  it('respeita o API_TOKEN quando configurado', async () => {
    const env = { ...ENV, API_TOKEN: 'segredo' };
    expect((await chamar('/generate', { corpo: {}, env, cabecalhos: { Authorization: 'Bearer errado' } })).status).toBe(401);
    expect((await chamar('/generate', { corpo: { contents: [] }, env, cabecalhos: { Authorization: 'Bearer segredo' } })).status).toBe(200);
  });

  it('corpo invalido responde 400', async () => {
    expect((await chamar('/generate', { corpo: undefined })).status).toBe(400);
  });
});

describe('/tts', () => {
  const envTts = { ...ENV, GOOGLE_TTS_KEY: 'chave-tts' };

  it('sem chave responde 503 - o app cai na voz do sistema', async () => {
    expect((await chamar('/tts', { corpo: { texto: 'ola' } })).status).toBe(503);
  });

  it('texto vazio ou so com espacos nao vai para a API paga', async () => {
    expect((await chamar('/tts', { corpo: { texto: '   ' }, env: envTts })).status).toBe(400);
  });

  it('sintetiza com a voz pedida e perfil de fone', async () => {
    const r = await chamar('/tts', {
      corpo: { texto: 'Roteiro', voz: 'pt-BR-Neural2-A', velocidade: 1.1 }, env: envTts,
    });
    expect(r.dados).toEqual({ audioBase64: 'QUJD', mime: 'audio/mpeg' });

    const enviado = saidaPara(r, 'texttospeech').body;
    expect(enviado.voice).toEqual({ languageCode: 'pt-BR', name: 'pt-BR-Neural2-A' });
    expect(enviado.audioConfig.effectsProfileId).toEqual(['headphone-class-device']);
  });

  it('sanitiza voz, velocidade e tamanho do texto', async () => {
    const vozRuim = await chamar('/tts', { corpo: { texto: 'x', voz: 'en-US-Hacker; drop' }, env: envTts });
    // Fallback sanitizado: Ana (Neural2-A, feminina) — a voz padrão das pílulas.
    expect(saidaPara(vozRuim, 'texttospeech').body.voice.name).toBe('pt-BR-Neural2-A');

    const rapido = await chamar('/tts', { corpo: { texto: 'x', velocidade: 99 }, env: envTts });
    expect(saidaPara(rapido, 'texttospeech').body.audioConfig.speakingRate).toBe(1.6);

    const longo = await chamar('/tts', { corpo: { texto: 'a'.repeat(9000) }, env: envTts });
    expect(saidaPara(longo, 'texttospeech').body.input.text).toHaveLength(4800);
  });
});

describe('/pagamento', () => {
  const comSessao = { 'X-Supabase-Auth': 'jwt' };

  it('exige sessao do Supabase', async () => {
    const r = await chamar('/pagamento', { corpo: { agendamentoId: AGENDAMENTO }, respostas: mundo({ usuario: null }) });
    expect(r.status).toBe(401);
  });

  it('nao deixa pagar consulta de terceiro', async () => {
    const r = await chamar('/pagamento', {
      corpo: { agendamentoId: AGENDAMENTO }, cabecalhos: comSessao,
      respostas: mundo({ agendamento: { aluno_id: 'outro', responsavel_id: 'outro-ainda' } }),
    });
    expect(r.status).toBe(403);
  });

  it('nao cobra duas vezes a mesma consulta', async () => {
    const r = await chamar('/pagamento', {
      corpo: { agendamentoId: AGENDAMENTO }, cabecalhos: comSessao,
      respostas: mundo({ agendamento: { status_pagamento: 'pago' } }),
    });
    expect(r.status).toBe(409);
  });

  it('modo demonstracao confirma na hora e cria a sala', async () => {
    const r = await chamar('/pagamento', { corpo: { agendamentoId: AGENDAMENTO }, cabecalhos: comSessao });
    expect(r.dados.confirmadoNaHora).toBe(true);
    expect(r.dados.meetingUrl).toMatch(/^https:\/\//);

    const rpc = saidaPara(r, 'confirmar_pagamento_consulta');
    expect(rpc.body.p_agendamento).toBe(AGENDAMENTO);
    // A sala carrega o id do agendamento + sufixo aleatorio (nao adivinhavel).
    expect(rpc.body.p_meeting_url).toContain('ampli-aaaaaaaabbbb');
  });

  it('modo real devolve checkout e NAO confirma nada', async () => {
    const r = await chamar('/pagamento', {
      corpo: { agendamentoId: AGENDAMENTO, valorCentavos: 15000, emailPagador: 'mae@test.br' },
      cabecalhos: comSessao, env: { ...ENV, MP_ACCESS_TOKEN: 'mp-token' },
    });

    expect(r.dados.checkoutUrl).toBe('https://mp/checkout/xyz');
    expect(saidaPara(r, 'confirmar_pagamento_consulta')).toBeUndefined();

    const pref = saidaPara(r, 'preferences').body;
    expect(pref.external_reference).toBe(AGENDAMENTO);
    expect(pref.items[0].unit_price).toBe(150); // centavos -> reais
    expect(pref.notification_url).toMatch(/\/webhook\/pagamento$/);
  });
});

describe('/webhook/pagamento', () => {
  const env = { ...ENV, MP_ACCESS_TOKEN: 'mp-token', MP_WEBHOOK_SECRET: 'sh' };

  it('recusa webhook sem o segredo', async () => {
    const r = await chamar('/webhook/pagamento', { corpo: { data: { id: 'pay-9' } }, env });
    expect(r.status).toBe(401);
  });

  it('confere o pagamento na origem antes de liberar a sala', async () => {
    const r = await chamar('/webhook/pagamento?secret=sh', { corpo: { data: { id: 'pay-9' } }, env });
    expect(r.status).toBe(200);
    expect(saidaPara(r, '/v1/payments/pay-9')).toBeDefined();

    const rpc = saidaPara(r, 'confirmar_pagamento_consulta');
    expect(rpc.body.p_agendamento).toBe(AGENDAMENTO);
    expect(rpc.body.p_ref).toBe('pay-9');
  });

  it('pagamento pendente nao libera a sala', async () => {
    const r = await chamar('/webhook/pagamento?secret=sh', {
      corpo: { data: { id: 'pay-9' } }, env,
      respostas: mundo({ pagamento: { status: 'pending', external_reference: AGENDAMENTO } }),
    });
    expect(r.status).toBe(200);
    expect(saidaPara(r, 'confirmar_pagamento_consulta')).toBeUndefined();
  });
});

describe('/notify/drain', () => {
  it('envia a fila e marca como enviada', async () => {
    const env = { ...ENV, RESEND_API_KEY: 'resend', EMAIL_REMETENTE: 'Ampli <a@b.c>' };
    const r = await chamar('/notify/drain', { env });

    expect(r.dados.enviadas).toBe(1);
    expect(saidaPara(r, 'resend').body.to).toEqual(['mae@test.br']);
    expect(saidaPara(r, 'notificacoes?id=eq.n1').method).toBe('PATCH');
  });

  it('sem provedor de e-mail nao quebra a fila', async () => {
    const r = await chamar('/notify/drain');
    expect(r.status).toBe(200);
    expect(r.dados.enviadas).toBe(0);
  });
});

/* ===================================================================
   Rotas novas: chat tematico com grounding e correcao por foto.
   =================================================================== */

const respostaGeminiTexto = (texto, grounding) =>
  json({
    candidates: [
      {
        content: { parts: [{ text: texto }] },
        ...(grounding ? { groundingMetadata: grounding } : {}),
      },
    ],
  });

describe('/api/chat/completions', () => {
  const mundoChat = () => [
    ['generativelanguage', () =>
      respostaGeminiTexto('Vamos por partes: o que voce ja sabe sobre funcao afim?', {
        webSearchQueries: ['funcao afim enem 2019'],
        groundingChunks: [
          { web: { uri: 'https://download.inep.gov.br/prova.pdf', title: 'Prova ENEM 2019' } },
        ],
      })],
  ];

  it('monta o prompt no servidor a partir do modo e da hora', async () => {
    const r = await chamar('/api/chat/completions', {
      corpo: { modo: 'exatas', horaLocal: 2, mensagens: [{ role: 'user', text: 'como resolvo 2x=8?' }] },
      respostas: mundoChat(),
    });

    expect(r.status).toBe(200);
    const system = saidaPara(r, 'generativelanguage').body.systemInstruction.parts[0].text;

    // O cliente manda contexto; a INSTRUCAO e do servidor.
    expect(system).toContain('MODO ATIVO: Matemática');
    expect(system).toContain('Responda a duvida de forma COMPLETA');
    expect(system).toContain('120 palavras'); // densidade de madrugada
  });

  it('liga a busca e devolve as fontes que viram badges', async () => {
    const r = await chamar('/api/chat/completions', {
      corpo: { modo: 'vestibulares', horaLocal: 20, mensagens: [{ role: 'user', text: 'questao de fuvest' }] },
      respostas: mundoChat(),
    });

    expect(saidaPara(r, 'generativelanguage').body.tools).toBeDefined();
    expect(r.dados.groundingUsado).toBe(true);
    expect(r.dados.fontes[0].dominio).toBe('download.inep.gov.br');
    expect(r.dados.consultas).toEqual(['funcao afim enem 2019']);
  });

  it('usa a ferramenta de busca certa para cada familia de modelo', async () => {
    const r15 = await chamar('/api/chat/completions', {
      corpo: { mensagens: [{ role: 'user', text: 'oi' }] },
      respostas: mundoChat(),
    });
    expect(saidaPara(r15, 'generativelanguage').body.tools[0]).toHaveProperty('google_search_retrieval');

    const r20 = await chamar('/api/chat/completions', {
      corpo: { mensagens: [{ role: 'user', text: 'oi' }] },
      env: { ...ENV, GEMINI_MODEL_CHAT: 'gemini-2.0-flash' },
      respostas: mundoChat(),
    });
    expect(saidaPara(r20, 'generativelanguage').body.tools[0]).toHaveProperty('google_search');
  });

  it('sem busca disponivel, responde sem fonte em vez de derrubar a conversa', async () => {
    let primeira = true;
    const r = await chamar('/api/chat/completions', {
      corpo: { mensagens: [{ role: 'user', text: 'oi' }] },
      respostas: [
        ['generativelanguage', () => {
          if (primeira) {
            primeira = false;
            return json({ error: { message: 'Search Grounding is not supported' } }, 400);
          }
          return respostaGeminiTexto('Resposta sem busca.');
        }],
      ],
    });

    expect(r.status).toBe(200);
    expect(r.dados.texto).toBe('Resposta sem busca.');
    expect(r.dados.groundingUsado).toBe(false);
    const chamadas = r.saidas.filter((s) => s.url.includes('generativelanguage'));
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].body.tools).toBeUndefined();
  });

  it('marca quando a resposta cita banca e ano', async () => {
    const r = await chamar('/api/chat/completions', {
      corpo: { mensagens: [{ role: 'user', text: 'oi' }] },
      respostas: [['generativelanguage', () => respostaGeminiTexto('Isso caiu no ENEM 2019, questao 136.')]],
    });
    expect(r.dados.citouProva).toBe(true);
  });

  it('modo invalido cai no geral; conversa vazia e recusada', async () => {
    const r = await chamar('/api/chat/completions', {
      corpo: { modo: 'hackeado', mensagens: [{ role: 'user', text: 'oi' }] },
      respostas: mundoChat(),
    });
    expect(r.dados.modo).toBe('enem_geral');

    const vazia = await chamar('/api/chat/completions', { corpo: { mensagens: [] } });
    expect(vazia.status).toBe(400);
  });

  it('nunca combina saida estruturada com busca (a API recusa as duas juntas)', async () => {
    const r = await chamar('/api/chat/completions', {
      corpo: { mensagens: [{ role: 'user', text: 'oi' }] },
      respostas: mundoChat(),
    });
    expect(saidaPara(r, 'generativelanguage').body.generationConfig.responseMimeType).toBeUndefined();
  });
});

describe('/api/essays/upload-and-grade', () => {
  const CORRECAO = {
    transcription: 'A '.repeat(200),
    detected_theme: 'Inclusão digital',
    scores: {
      competence_1: { score: 160, feedback: 'x' },
      competence_2: { score: 200, feedback: 'x' },
      competence_3: { score: 160, feedback: 'x' },
      competence_4: { score: 200, feedback: 'x' },
      competence_5: { score: 160, feedback: 'x' },
    },
    total_score: 999,
    strengths: ['a'],
    actionable_improvements: ['b'],
  };

  const mundoVisao = (correcao = CORRECAO) => [
    ['/auth/v1/user', () => json({ id: USUARIO })],
    ['/storage/v1/object/sign/', () => json({ signedURL: '/object/sign/essay_scans/x?token=y' })],
    ['/storage/v1/object/', () => json({ Key: 'essay_scans/x' })],
    ['/rest/v1/redacoes', () => json([{ id: 77 }])],
    ['generativelanguage', () => respostaGeminiTexto(JSON.stringify(correcao))],
  ];

  /** JPEG mínimo válido (magic-bytes FF D8 FF): o worker valida bytes reais. */
  function bytesJpeg() {
    const b = new Uint8Array(1024).fill(120);
    b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
    return b;
  }

  async function enviarFoto(opcoes = {}) {
    const form = new FormData();
    const bytes = opcoes.bytes ?? bytesJpeg();
    form.append('imagem', new File([bytes], 'redacao.jpg', { type: opcoes.tipo ?? 'image/jpeg' }));
    if (opcoes.tema) form.append('tema', opcoes.tema);

    saidas = [];
    const rotas = opcoes.respostas ?? mundoVisao();
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const u = String(url);
      let corpo = null;
      try {
        corpo = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      } catch {
        corpo = null;
      }
      saidas.push({ url: u, method: init.method || 'GET', body: corpo });
      for (const [padrao, resposta] of rotas) if (u.includes(padrao)) return resposta();
      return json({});
    });

    const resposta = await worker.fetch(
      new Request('https://worker.dev/api/essays/upload-and-grade', {
        method: 'POST',
        headers: opcoes.semSessao ? {} : { 'X-Supabase-Auth': 'jwt' },
        body: form,
      }),
      opcoes.env ?? ENV,
    );

    let dados = null;
    try {
      dados = JSON.parse(await resposta.clone().text());
    } catch {
      /* nao-json */
    }
    return { status: resposta.status, dados, saidas };
  }

  it('exige sessao: a foto e material escolar de um menor', async () => {
    const r = await enviarFoto({ semSessao: true });
    expect(r.status).toBe(401);
    expect(saidaPara(r, 'generativelanguage')).toBeUndefined();
  });

  it('recusa arquivo que nao seja imagem', async () => {
    const r = await enviarFoto({ tipo: 'application/pdf', bytes: new Uint8Array(1024).fill(120) });
    expect(r.status).toBe(415);
  });

  it('recusa imagem declarada com bytes falsos (vale o magic-byte, nao o tipo)', async () => {
    const r = await enviarFoto({ tipo: 'image/jpeg', bytes: new Uint8Array(1024).fill(120) });
    expect(r.status).toBe(415);
    expect(r.dados.error).toBe('tipo_invalido');
  });

  it('sobe a foto no bucket privado, dentro da pasta do dono', async () => {
    const r = await enviarFoto({ tema: 'Inclusão digital' });
    const upload = r.saidas.find((s) => s.url.includes('/storage/v1/object/essay_scans/'));
    expect(upload).toBeDefined();
    expect(upload.url).toContain('essay_scans/' + USUARIO + '/');
    expect(upload.method).toBe('POST');
  });

  it('faz OCR e correcao numa unica chamada, com JSON estruturado', async () => {
    const r = await enviarFoto();
    const chamadas = r.saidas.filter((s) => s.url.includes('generativelanguage'));
    expect(chamadas).toHaveLength(1);

    const corpo = chamadas[0].body;
    expect(corpo.generationConfig.responseMimeType).toBe('application/json');
    expect(corpo.generationConfig.responseSchema.required).toContain('transcription');
    expect(corpo.contents[0].parts[0].text).toContain('TRANSCRIÇÃO');
    expect(corpo.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    expect(corpo.contents[0].parts[1].inlineData.data.length).toBeGreaterThan(100);
  });

  it('devolve o contrato completo e recalcula a soma errada do modelo', async () => {
    const r = await enviarFoto();
    expect(r.status).toBe(200);
    expect(Object.keys(r.dados)).toEqual(
      expect.arrayContaining([
        'transcription', 'detected_theme', 'scores', 'total_score',
        'strengths', 'actionable_improvements', 'essay_id', 'image_url',
      ]),
    );
    expect(r.dados.total_score).toBe(880); // 160+200+160+200+160, nao os 999 do modelo
    expect(r.dados.essay_id).toBe(77);
    expect(r.dados.image_url).toContain('/storage/v1/object/sign/');
  });

  it('grava no historico marcando a origem foto', async () => {
    const r = await enviarFoto({ tema: 'Inclusão digital' });
    const insert = saidaPara(r, '/rest/v1/redacoes');
    expect(insert.body.origem).toBe('foto');
    expect(insert.body.user_id).toBe(USUARIO);
    expect(insert.body.nota_final).toBe(880);
    expect(insert.body.imagem_path).toContain(USUARIO);
    expect(insert.body.transcricao.length).toBeGreaterThan(100);
  });

  it('foto ilegivel nao vira nota zero no historico', async () => {
    const r = await enviarFoto({ respostas: mundoVisao({ ...CORRECAO, transcription: 'nao da para ler' }) });
    expect(r.dados.ilegivel).toBe(true);
    // Zero seria avaliacao do texto; o problema foi a imagem.
    expect(saidaPara(r, '/rest/v1/redacoes')).toBeUndefined();
  });

  it('se o historico falhar, a correcao ainda chega ao aluno', async () => {
    const r = await enviarFoto({
      respostas: [
        ['/auth/v1/user', () => json({ id: USUARIO })],
        ['/storage/v1/object/sign/', () => json({ signedURL: '/object/sign/x' })],
        ['/storage/v1/object/', () => json({ Key: 'x' })],
        ['/rest/v1/redacoes', () => json({ message: 'coluna origem nao existe' }, 400)],
        ['generativelanguage', () => respostaGeminiTexto(JSON.stringify(CORRECAO))],
      ],
    });
    expect(r.status).toBe(200);
    expect(r.dados.total_score).toBe(880);
    expect(r.dados.essay_id).toBeNull();
  });
});

describe('/api/turmas/import', () => {
  const ESCOLA = '22222222-3333-4444-5555-666666666666';
  const TURMA = '33333333-4444-5555-6666-777777777777';
  const EDUCADOR = '44444444-5555-6666-7777-888888888888';

  const mundoImport = (papel = 'educator') => [
    ['/auth/v1/user', () => json({ id: EDUCADOR })],
    ['/rest/v1/perfis', () => json([{ papel, escola_id: ESCOLA }])],
    ['/rest/v1/escolas', () => json([{ id: ESCOLA, nome: 'Escola Sol', codigo_instituicao: 'SOL2026A' }])],
    ['/rest/v1/turmas', () => json([{ id: TURMA, nome: '3A', codigo: 'ABC123' }])],
    ['/auth/v1/admin/users', () => json({ id: '55555555-6666-7777-8888-999999999999' })],
    ['/auth/v1/admin/generate_link', () => json({ action_link: 'https://projeto.supabase.co/auth/v1/verify?token=magico' })],
    ['api.resend.com', () => json({ id: 'email-1' })],
  ];

  const corpo = {
    alunos: [{ nome: 'Ana Silva', sala: '3A', email: 'mae@test.br', telefone: '(11) 99999-8888' }],
  };
  const cabecalhos = { 'X-Supabase-Auth': 'jwt' };
  // Sem DEEPSEEK_API_KEY: segue com dados crus (ia: false), sem custo.
  const envImport = { ...ENV, RESEND_API_KEY: 'chave-resend' };

  it('exige sessao', async () => {
    expect((await chamar('/api/turmas/import', { corpo, respostas: mundoImport() })).status).toBe(401);
  });

  it('barra quem nao e secretaria', async () => {
    const r = await chamar('/api/turmas/import', { corpo, cabecalhos, respostas: mundoImport('student') });
    expect(r.status).toBe(403);
    expect(saidaPara(r, '/auth/v1/admin/users')).toBeUndefined();
  });

  it('cria aluno + responsavel, vincula turma e envia convite sem expor senha', async () => {
    const r = await chamar('/api/turmas/import', { corpo, cabecalhos, respostas: mundoImport(), env: envImport });
    expect(r.status).toBe(200);
    expect(r.dados.criados).toBe(1);
    expect(r.dados.codigoInstituicao).toBe('SOL2026A');
    expect(r.dados.emailsEnviados).toBe(1);

    const [res] = r.dados.resultados;
    expect(res.ok).toBe(true);
    expect(res.turma).toBe('3A');
    expect(res.codigoTurma).toBe('ABC123');
    // Com email enviado, a senha temporária NÃO volta no relatório.
    expect(res.senhaTemporaria).toBeUndefined();
    expect(res.login).toContain('@alunos.');

    const criacoes = r.saidas.filter((s) => s.url.includes('/auth/v1/admin/users'));
    expect(criacoes).toHaveLength(2); // aluno + responsável
    expect(criacoes[0].body.email_confirm).toBe(true);

    const email = saidaPara(r, 'api.resend.com');
    expect(email.body.to).toEqual(['mae@test.br']);
    expect(email.body.text).toContain('SOL2026A');
    expect(email.body.text).toContain('ABC123');
    expect(email.body.text).toContain('token=magico');
  });

  it('sem Resend, credenciais voltam no relatorio para repasse manual', async () => {
    const r = await chamar('/api/turmas/import', { corpo, cabecalhos, respostas: mundoImport(), env: ENV });
    expect(r.status).toBe(200);
    expect(r.dados.emailConfigurado).toBe(false);
    const [res] = r.dados.resultados;
    expect(res.ok).toBe(true);
    expect(res.senhaTemporaria).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(res.loginResponsavel).toBe('mae@test.br');
  });

  it('IA normaliza e associa a turma quando ha DEEPSEEK_API_KEY', async () => {
    const normalizado = {
      alunos: [{
        nome: 'Ana Souza',
        sala: '3A',
        turmaId: '33333333-4444-5555-6666-777777777777',
        email: 'mae@test.br',
        telefone: '(11) 99999-8888',
        tipo: 'student',
        problemas: [],
      }],
    };
    const respostas = [
      ...mundoImport(),
      ['api.deepseek.com', () => json({ choices: [{ message: { content: JSON.stringify(normalizado) } }] })],
    ];
    const r = await chamar('/api/turmas/import', {
      corpo: { alunos: [{ nome: 'ana souza', sala: '3a', email: 'mae@test.br', telefone: '(11) 99999-8888' }] },
      cabecalhos,
      respostas,
      env: { ...envImport, DEEPSEEK_API_KEY: 'ds-teste' },
    });
    expect(r.status).toBe(200);
    expect(r.dados.normalizadoPorIA).toBe(true);
    const [res] = r.dados.resultados;
    expect(res.ok).toBe(true);
    expect(res.nome).toBe('Ana Souza');
    expect(res.codigoTurma).toBe('ABC123');
  });

  it('linha invalida nao cria conta e explica o motivo', async () => {
    const r = await chamar('/api/turmas/import', {
      corpo: { alunos: [{ nome: 'Sem Email', sala: '3A', email: 'errado', telefone: '' }] },
      cabecalhos,
      respostas: mundoImport(),
      env: envImport,
    });
    expect(r.status).toBe(200);
    expect(r.dados.criados).toBe(0);
    expect(r.dados.resultados[0].ok).toBe(false);
    expect(r.dados.resultados[0].erro).toContain('email');
    expect(saidaPara(r, '/auth/v1/admin/users')).toBeUndefined();
  });
});
