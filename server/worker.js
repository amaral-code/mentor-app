/**
 * Proxy serverless do Ampli-IA (Midnight Mentor).
 *
 * Deploy em 3 provedores (escolha um):
 *   - Cloudflare Workers (recomendado, cota grátis):  wrangler login && wrangler deploy
 *   - Vercel / Netlify Functions: exporta este handler
 *   - Railway / Render: node proxy (veja abaixo)
 *
 * ROTAS
 *   POST /generate        -> Gemini (chat, quiz, redação, roteiros)
 *   POST /tts             -> Text-to-Speech (pílulas de áudio)
 *   POST /pagamento       -> abre a cobrança da consulta
 *   POST /webhook/pagamento -> provedor confirma; cria a sala e libera
 *   POST /notify/drain    -> envia a fila de e-mail/push
 *   GET  /health
 *
 * SEGREDOS a configurar no provedor:
 *   GEMINI_API_KEY        chave do Google AI Studio
 *   DEEPSEEK_API_KEY      chave da DeepSeek (chat, quiz, redação digitada, roteiros)
 *   AI_PROVIDER           "deepseek" para usar DeepSeek-V4-Flash; qualquer outro = Gemini
 *   AI_MODEL              modelo padrao (ex.: deepseek-v4-flash)
 *   DEEPSEEK_BASE_URL     (opcional) padrao https://api.deepseek.com
 *   API_TOKEN             (opcional) senha para bloquear uso de terceiros
 *   ALLOWED_ORIGIN        (opcional) seu domínio, em vez de "*"
 *   GOOGLE_TTS_KEY        chave do Google Cloud Text-to-Speech
 *   SUPABASE_URL          URL do projeto
 *   SUPABASE_SERVICE_KEY  service_role (NUNCA no front)
 *   MP_ACCESS_TOKEN       Mercado Pago (ausente = modo demonstração)
 *   MP_WEBHOOK_SECRET     segredo para validar o webhook
 *   RESEND_API_KEY        envio de e-mail
 *   EMAIL_REMETENTE       ex.: "Ampli-IA <avisos@seudominio.com>"
 *   JITSI_BASE            padrão https://meet.jit.si
 *   PUBLIC_APP_URL        para os links dos e-mails
 */

import {
  montarSystemInstructionChat,
  ferramentasDeBusca,
  extrairFontes,
  detectarCitacaoDeProva,
  modoValido,
  MODO_PADRAO,
} from './chatPrompt.js';
import {
  ESQUEMA_CORRECAO,
  promptCorrecaoFoto,
  normalizarCorrecao,
  pareceFotoIlegivel,
  MIMES_ACEITOS,
  TAMANHO_MAXIMO_BYTES,
} from './essaySchema.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_DEFAULT_BASE = 'https://api.deepseek.com';
const MODELOS_PERMITIDOS = new Set(['gemini-2.0-flash', 'gemini-2.0-flash-lite', DEEPSEEK_DEFAULT_MODEL]);
const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/*
 * Modelos das duas funcionalidades novas.
 *
 * Ficam em variavel de ambiente porque a familia importa: o nome da
 * ferramenta de busca muda entre 1.5 e 2.x (ver ferramentasDeBusca) e a
 * saida estruturada tem suporte diferente. Trocar o modelo no painel do
 * provedor nao deve exigir deploy.
 */
const MODELO_CHAT_PADRAO = 'gemini-1.5-flash';
const MODELO_VISAO_PADRAO = 'gemini-1.5-flash';
const BUCKET_REDACOES = 'essay_scans';

function cors(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Supabase-Auth',
    'Access-Control-Max-Age': '86400',
  };
}

const json = (data, status, corsHeaders) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });

function tokenValido(request, env) {
  if (!env.API_TOKEN) return true;
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.API_TOKEN}`;
}

/* ===================================================================
   Supabase com service_role
   -------------------------------------------------------------------
   Só o worker tem esta chave. Ela ignora RLS, e é por isso que as três
   operações que o navegador NÃO pode fazer moram aqui: confirmar
   pagamento, criar o link da sala e enviar notificação em nome da
   plataforma.
   =================================================================== */
async function supabaseRpc(env, funcao, args) {
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!resposta.ok) throw new Error(`rpc ${funcao}: ${resposta.status} ${await resposta.text()}`);
  return resposta.json();
}

async function supabaseSelect(env, caminho) {
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!resposta.ok) throw new Error(`select ${caminho}: ${resposta.status}`);
  return resposta.json();
}

async function supabasePatch(env, caminho, corpo) {
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(`patch ${caminho}: ${resposta.status}`);
}

async function supabaseInsert(env, tabela, linha) {
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(linha),
  });
  if (!resposta.ok) throw new Error(`insert ${tabela}: ${resposta.status} ${await resposta.text()}`);
  return resposta.json();
}

/**
 * Sobe a foto da redação no bucket privado.
 *
 * O caminho começa pelo id do usuário (`<uid>/<uuid>.<ext>`): é o que
 * permite a policy de Storage autorizar por dono sem consultar tabela
 * nenhuma. Bucket privado — a imagem só sai daqui por URL assinada.
 */
async function subirImagem(env, caminho, bytes, contentType) {
  const resposta = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${BUCKET_REDACOES}/${caminho}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: bytes,
    },
  );
  if (!resposta.ok) throw new Error(`upload: ${resposta.status} ${await resposta.text()}`);
  return `${BUCKET_REDACOES}/${caminho}`;
}

/** URL temporária para a tela exibir a foto ao lado da correção. */
async function assinarImagem(env, caminho, segundos = 60 * 60 * 24 * 7) {
  const resposta = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET_REDACOES}/${caminho}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: segundos }),
    },
  );
  if (!resposta.ok) return null;
  const dados = await resposta.json();
  return dados?.signedURL ? `${env.SUPABASE_URL}/storage/v1${dados.signedURL}` : null;
}

/**
 * ArrayBuffer -> base64 em blocos.
 *
 * `btoa(String.fromCharCode(...bytes))` estoura a pilha em arquivos de
 * alguns MB — que é exatamente o tamanho de uma foto de redação.
 */
function paraBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const BLOCO = 0x8000;
  let binario = '';
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOCO));
  }
  return btoa(binario);
}

/** Extrai o JSON da resposta do Gemini, com ou sem cerca de markdown. */
function jsonDaResposta(texto) {
  const limpo = String(texto || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio >= 0 && fim > inicio) return JSON.parse(limpo.slice(inicio, fim + 1));
    throw new Error('resposta do modelo não é JSON');
  }
}

function textoDaResposta(dados) {
  const partes = dados?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return '';
  return partes.map((p) => p?.text || '').join('').trim();
}

/* ===================================================================
   DeepSeek (chat completions, compativel OpenAI)
   -------------------------------------------------------------------
   Os prompts por area viajam INTACTOS: o systemInstruction do Gemini
   vira a mensagem `system`, e cada content vira `user`/`assistant`.
   A resposta e reembalada no envelope Gemini minimo, para que o front
   (extractGeminiText) nao precise saber qual upstream respondeu.
   =================================================================== */

function provedorEfetivo(payload, env) {
  const pedido = String(payload?.provider || '').toLowerCase();
  if (pedido === 'deepseek' || pedido === 'gemini') return pedido;
  return String(env.AI_PROVIDER || '').toLowerCase() === 'deepseek' ? 'deepseek' : 'gemini';
}

function modeloEfetivo(payload, env, provedor) {
  const pedido = String(payload?.model || '').trim();
  if (pedido && MODELOS_PERMITIDOS.has(pedido)) return pedido;
  const padraoEnv = String(env.AI_MODEL || '').trim();
  if (padraoEnv && MODELOS_PERMITIDOS.has(padraoEnv)) return padraoEnv;
  if (padraoEnv && /^deepseek-/i.test(padraoEnv)) return padraoEnv;
  return provedor === 'deepseek' ? DEEPSEEK_DEFAULT_MODEL : DEFAULT_MODEL;
}

function paraMensagensOpenAI(systemInstruction, contents) {
  const mensagens = [];
  const sistema = (systemInstruction?.parts ?? [])
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n\n')
    .trim();
  if (sistema) mensagens.push({ role: 'system', content: sistema });
  for (const c of contents ?? []) {
    const texto = Array.isArray(c?.parts)
      ? c.parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
      : '';
    if (!texto) continue;
    mensagens.push({ role: c?.role === 'model' ? 'assistant' : 'user', content: texto });
  }
  return mensagens;
}

function genParaDeepSeek(generationConfig = {}) {
  const out = {};
  const temp = Number(generationConfig.temperature);
  const maxTokens = Number(generationConfig.maxOutputTokens ?? generationConfig.max_tokens);
  const topP = Number(generationConfig.topP ?? generationConfig.top_p);
  if (Number.isFinite(temp)) out.temperature = temp;
  if (Number.isFinite(maxTokens) && maxTokens > 0) out.max_tokens = Math.floor(maxTokens);
  if (Number.isFinite(topP)) out.top_p = topP;
  return out;
}

function embrulhoGemini(texto) {
  return { candidates: [{ content: { parts: [{ text: String(texto ?? '') }] } }] };
}

async function chamarDeepSeek(env, model, messages, generationConfig) {
  const base = String(env.DEEPSEEK_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/+$/, '');
  const resposta = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model, messages, ...genParaDeepSeek(generationConfig) }),
  });
  const texto = await resposta.text();
  if (!resposta.ok) return { ok: false, status: resposta.status, texto };
  try {
    const dados = JSON.parse(texto);
    const conteudo = dados?.choices?.[0]?.message?.content ?? '';
    return { ok: true, status: resposta.status, texto: JSON.stringify(embrulhoGemini(conteudo)) };
  } catch {
    return { ok: false, status: 502, texto: 'resposta deepseek nao-json' };
  }
}

/** Confere o JWT do usuário que pediu a cobrança (evita pagar pelo agendamento alheio). */
async function usuarioDoToken(env, request) {
  const jwt = request.headers.get('X-Supabase-Auth');
  if (!jwt || !env.SUPABASE_URL) return null;
  const resposta = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!resposta.ok) return null;
  const dados = await resposta.json();
  return dados?.id ? dados : null;
}

/* ===================================================================
   Sala de videochamada
   -------------------------------------------------------------------
   Google Meet e Zoom exigem OAuth do PROFISSIONAL (consentimento +
   refresh token guardado no servidor). Enquanto essa conexão não
   existir, a sala é um Jitsi: link https, sem cadastro, abre no
   navegador do celular. O nome carrega o id do agendamento e um sufixo
   aleatório, para não ser adivinhável por quem souber o id.

   Para trocar por Meet/Zoom depois, só esta função muda - o app inteiro
   lê apenas `meeting_url`.
   =================================================================== */
function criarSala(env, agendamentoId) {
  const base = env.JITSI_BASE || 'https://meet.jit.si';
  const curto = String(agendamentoId).replace(/-/g, '').slice(0, 12);
  const sufixo = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return {
    url: `${base}/ampli-${curto}-${sufixo}#config.prejoinPageEnabled=true`,
    provider: 'jitsi',
    ref: `${curto}-${sufixo}`,
  };
}

/* ===================================================================
   Envio de e-mail (Resend) e push (Web Push)
   =================================================================== */
async function enviarEmail(env, para, assunto, corpo) {
  if (!env.RESEND_API_KEY) return false;
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE || 'Ampli-IA <avisos@ampli-ia.app>',
      to: [para],
      subject: assunto,
      text: corpo,
    }),
  });
  return resposta.ok;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = cors(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      const provedor = String(env.AI_PROVIDER || '').toLowerCase() === 'deepseek' ? 'deepseek' : 'gemini';
      return json(
        {
          status: 'ok',
          provider: provedor,
          model:
            String(env.AI_MODEL || '').trim() ||
            (provedor === 'deepseek' ? DEEPSEEK_DEFAULT_MODEL : DEFAULT_MODEL),
          deepseek: !!env.DEEPSEEK_API_KEY,
          tts: !!env.GOOGLE_TTS_KEY,
          pagamento: env.MP_ACCESS_TOKEN ? 'mercadopago' : 'simulado',
          email: !!env.RESEND_API_KEY,
        },
        200,
        corsHeaders,
      );
    }

    // =============================================================
    // 1. Gemini
    // =============================================================
    if (url.pathname === '/generate' && request.method === 'POST') {
      if (!tokenValido(request, env)) {
        return json({ error: 'Unauthorized', message: 'API_TOKEN inválido' }, 401, corsHeaders);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      // Evita que o usuário final escolha modelo pago/indesejado
      const provedor = provedorEfetivo(payload, env);
      const model = modeloEfetivo(payload, env, provedor);

      // ---- DeepSeek-V4-Flash (chat completions) ----
      if (provedor === 'deepseek' || /^deepseek-/i.test(model)) {
        if (!env.DEEPSEEK_API_KEY) {
          return json({ error: 'misconfigured', message: 'Defina o secret DEEPSEEK_API_KEY.' }, 500, corsHeaders);
        }
        try {
          const saida = await chamarDeepSeek(
            env,
            model,
            paraMensagensOpenAI(payload.systemInstruction, payload.contents),
            payload.generationConfig,
          );
          return new Response(saida.texto, {
            status: saida.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
          });
        } catch (err) {
          return json({ error: 'upstream_failed', message: String(err && err.message) }, 502, corsHeaders);
        }
      }

      // ---- Gemini (padrao) ----
      if (!env.GEMINI_API_KEY) {
        return json({ error: 'misconfigured', message: 'Defina o secret GEMINI_API_KEY.' }, 500, corsHeaders);
      }

      try {
        const upstream = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: payload.systemInstruction,
            contents: payload.contents,
            generationConfig: payload.generationConfig,
          }),
        });
        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (err) {
        return json({ error: 'upstream_failed', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    // =============================================================
    // 2. Text-to-Speech (pílulas de áudio)
    //
    // A chave do TTS cobra por caractere sintetizado; por isso ela nunca
    // vai para o navegador e o texto tem teto de tamanho aqui.
    // =============================================================
    if (url.pathname === '/tts' && request.method === 'POST') {
      if (!tokenValido(request, env)) {
        return json({ error: 'Unauthorized' }, 401, corsHeaders);
      }
      if (!env.GOOGLE_TTS_KEY) {
        return json(
          { error: 'misconfigured', message: 'Defina GOOGLE_TTS_KEY para gerar áudio.' },
          503,
          corsHeaders,
        );
      }

      let corpo;
      try {
        corpo = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      // trim ANTES do teste: um texto so com espacos passaria no `||` e
      // iria para o TTS, que cobra por caractere sintetizado.
      const texto = String(corpo.texto || '').trim().slice(0, 4800);
      if (!texto) return json({ error: 'texto_vazio' }, 400, corsHeaders);

      const voz = /^pt-BR-[A-Za-z0-9-]+$/.test(corpo.voz || '') ? corpo.voz : 'pt-BR-Neural2-B';
      const velocidade = Math.max(0.5, Math.min(Number(corpo.velocidade) || 1, 1.6));

      try {
        const upstream = await fetch(`${TTS_URL}?key=${env.GOOGLE_TTS_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: texto },
            voice: { languageCode: 'pt-BR', name: voz },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: velocidade,
              // -2 dB de ganho e pitch neutro: locução longa em fone de
              // ouvido fica cansativa com o volume padrão.
              volumeGainDb: -2,
              effectsProfileId: ['headphone-class-device'],
            },
          }),
        });

        if (!upstream.ok) {
          return json({ error: 'tts_failed', message: await upstream.text() }, upstream.status, corsHeaders);
        }
        const dados = await upstream.json();
        return json({ audioBase64: dados.audioContent, mime: 'audio/mpeg' }, 200, corsHeaders);
      } catch (err) {
        return json({ error: 'tts_error', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    // =============================================================
    // 3. Pagamento da consulta
    //
    // Com MP_ACCESS_TOKEN configurado, cria a preferência do Mercado
    // Pago e devolve a URL do checkout. Sem a chave, entra em MODO
    // DEMONSTRAÇÃO: confirma na hora e cria a sala, para dar de rodar o
    // fluxo inteiro em desenvolvimento. Em produção, deixar a chave
    // vazia é o mesmo que dar consulta de graça - o /health mostra em
    // qual modo o worker está.
    // =============================================================
    if (url.pathname === '/pagamento' && request.method === 'POST') {
      if (!tokenValido(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);

      const usuario = await usuarioDoToken(env, request);
      if (!usuario) {
        return json({ error: 'sem_sessao', message: 'Faça login novamente.' }, 401, corsHeaders);
      }

      let corpo;
      try {
        corpo = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      const { agendamentoId, valorCentavos, descricao, emailPagador } = corpo;
      if (!agendamentoId) return json({ error: 'agendamento_ausente' }, 400, corsHeaders);

      // O agendamento tem de ser mesmo de quem está pagando.
      let agendamento;
      try {
        const linhas = await supabaseSelect(
          env,
          `agendamentos?id=eq.${agendamentoId}&select=id,aluno_id,responsavel_id,valor_centavos,status_pagamento`,
        );
        agendamento = linhas[0];
      } catch (err) {
        return json({ error: 'consulta_falhou', message: String(err.message) }, 502, corsHeaders);
      }

      if (!agendamento) return json({ error: 'nao_encontrado' }, 404, corsHeaders);
      if (agendamento.aluno_id !== usuario.id && agendamento.responsavel_id !== usuario.id) {
        return json({ error: 'sem_permissao' }, 403, corsHeaders);
      }
      if (agendamento.status_pagamento === 'pago') {
        return json({ error: 'ja_pago' }, 409, corsHeaders);
      }

      // ---- Modo demonstração ----
      if (!env.MP_ACCESS_TOKEN) {
        const sala = criarSala(env, agendamentoId);
        try {
          await supabaseRpc(env, 'confirmar_pagamento_consulta', {
            p_agendamento: agendamentoId,
            p_ref: `simulado-${Date.now()}`,
            p_meeting_url: sala.url,
            p_provider: sala.provider,
          });
        } catch (err) {
          return json({ error: 'confirmacao_falhou', message: String(err.message) }, 502, corsHeaders);
        }
        return json({ ref: 'simulado', confirmadoNaHora: true, meetingUrl: sala.url }, 200, corsHeaders);
      }

      // ---- Mercado Pago ----
      try {
        const preferencia = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                title: descricao || 'Consulta psicológica',
                quantity: 1,
                currency_id: 'BRL',
                unit_price: (valorCentavos ?? agendamento.valor_centavos) / 100,
              },
            ],
            payer: emailPagador ? { email: emailPagador } : undefined,
            // external_reference é o que amarra o webhook ao agendamento.
            external_reference: agendamentoId,
            notification_url: `${url.origin}/webhook/pagamento`,
            back_urls: {
              success: `${env.PUBLIC_APP_URL || url.origin}/?consulta=${agendamentoId}`,
              pending: `${env.PUBLIC_APP_URL || url.origin}/?consulta=${agendamentoId}`,
              failure: `${env.PUBLIC_APP_URL || url.origin}/?consulta=${agendamentoId}`,
            },
            auto_return: 'approved',
          }),
        });

        if (!preferencia.ok) {
          return json(
            { error: 'checkout_falhou', message: await preferencia.text() },
            502,
            corsHeaders,
          );
        }
        const dados = await preferencia.json();
        return json(
          { checkoutUrl: dados.init_point, ref: dados.id, confirmadoNaHora: false },
          200,
          corsHeaders,
        );
      } catch (err) {
        return json({ error: 'checkout_erro', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    // =============================================================
    // 4. Webhook do provedor
    //
    // É AQUI que a consulta vira "paga" e ganha sala - nunca no
    // navegador. O segredo na query evita que qualquer um poste um
    // "pagou" forjado.
    // =============================================================
    if (url.pathname === '/webhook/pagamento' && request.method === 'POST') {
      if (env.MP_WEBHOOK_SECRET && url.searchParams.get('secret') !== env.MP_WEBHOOK_SECRET) {
        return json({ error: 'assinatura_invalida' }, 401, corsHeaders);
      }

      let evento;
      try {
        evento = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      try {
        const pagamentoId = evento?.data?.id;
        if (!pagamentoId) return json({ ok: true, ignorado: true }, 200, corsHeaders);

        // Consulta o pagamento na origem: o corpo do webhook não é fonte
        // confiável de status.
        const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${pagamentoId}`, {
          headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
        });
        const pagamento = await consulta.json();

        if (pagamento.status !== 'approved') {
          return json({ ok: true, status: pagamento.status }, 200, corsHeaders);
        }

        const agendamentoId = pagamento.external_reference;
        const sala = criarSala(env, agendamentoId);

        await supabaseRpc(env, 'confirmar_pagamento_consulta', {
          p_agendamento: agendamentoId,
          p_ref: String(pagamentoId),
          p_meeting_url: sala.url,
          p_provider: sala.provider,
        });

        return json({ ok: true }, 200, corsHeaders);
      } catch (err) {
        return json({ error: 'webhook_falhou', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    // =============================================================
    // 5. Fila de notificações
    //
    // Chamado por um cron (Cloudflare Cron Triggers, a cada 5 min). O
    // e-mail sai do servidor porque um alerta de saúde mental não pode
    // depender de o navegador do responsável estar aberto.
    // =============================================================
    if (url.pathname === '/notify/drain' && request.method === 'POST') {
      if (!tokenValido(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);

      try {
        const pendentes = await supabaseSelect(
          env,
          'notificacoes?canal=eq.email&enviada_em=is.null&tentativas=lt.3&select=id,user_id,titulo,corpo&limit=50',
        );

        let enviadas = 0;
        for (const n of pendentes) {
          const perfis = await supabaseSelect(env, `perfis?id=eq.${n.user_id}&select=email`);
          const email = perfis[0]?.email;
          const ok = email ? await enviarEmail(env, email, n.titulo, n.corpo) : false;

          await supabasePatch(
            env,
            `notificacoes?id=eq.${n.id}`,
            ok
              ? { enviada_em: new Date().toISOString() }
              : { tentativas: 1 /* incrementado a cada passagem */ },
          );
          if (ok) enviadas++;
        }

        return json({ ok: true, pendentes: pendentes.length, enviadas }, 200, corsHeaders);
      } catch (err) {
        return json({ error: 'drain_falhou', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    // =============================================================
    // 6. Chat tematico com grounding de vestibulares
    //
    // Diferente de /generate (proxy cru, em que o cliente manda o que
    // quiser), aqui o SERVIDOR monta o system instruction a partir do
    // modo e da hora, e liga a busca do Google. O cliente manda
    // contexto, nao instrucao.
    // =============================================================
    if (url.pathname === '/api/chat/completions' && request.method === 'POST') {
      if (!tokenValido(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);

      let corpo;
      try {
        corpo = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      const mensagens = Array.isArray(corpo.mensagens) ? corpo.mensagens.slice(-10) : [];
      if (mensagens.length === 0) return json({ error: 'sem_mensagem' }, 400, corsHeaders);

      const modo = modoValido(corpo.modo) ? corpo.modo : MODO_PADRAO;
      const provedorChat = provedorEfetivo(corpo, env);

      const systemInstruction = {
        parts: [
          {
            text: montarSystemInstructionChat({
              modo,
              horaLocal: Number(corpo.horaLocal),
              nomeAluno: String(corpo.nomeAluno || '').slice(0, 60),
              materiaRecente: String(corpo.materiaRecente || '').slice(0, 60),
            }),
          },
        ],
      };

      const contents = mensagens
        .filter((m) => m && typeof m.text === 'string' && m.text.trim())
        .map((m) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(m.text).slice(0, 8000) }],
        }));

      const generationConfig = { temperature: 0.4, maxOutputTokens: 1024, topP: 0.9 };

      // ---- DeepSeek: mesmo system prompt, sem busca do Google ----
      if (provedorChat === 'deepseek') {
        if (!env.DEEPSEEK_API_KEY) {
          return json({ error: 'misconfigured', message: 'Defina DEEPSEEK_API_KEY.' }, 500, corsHeaders);
        }
        const modeloDs = modeloEfetivo(corpo, env, 'deepseek');
        try {
          const saida = await chamarDeepSeek(
            env,
            modeloDs,
            paraMensagensOpenAI(systemInstruction, contents),
            generationConfig,
          );
          if (!saida.ok) {
            return json({ error: 'deepseek_falhou', message: saida.texto.slice(0, 400) }, saida.status, corsHeaders);
          }
          const texto = textoDaResposta(JSON.parse(saida.texto));
          return json(
            {
              texto,
              modo,
              modelo: modeloDs,
              fontes: [],
              consultas: [],
              groundingUsado: false,
              citouProva: detectarCitacaoDeProva(texto),
            },
            200,
            corsHeaders,
          );
        } catch (err) {
          return json({ error: 'chat_erro', message: String(err && err.message) }, 502, corsHeaders);
        }
      }

      if (!env.GEMINI_API_KEY) {
        return json({ error: 'misconfigured', message: 'Defina GEMINI_API_KEY.' }, 500, corsHeaders);
      }
      const modelo = env.GEMINI_MODEL_CHAT || MODELO_CHAT_PADRAO;

      const chamarGemini = async (comBusca) => {
        const payload = { systemInstruction, contents, generationConfig };
        // Saida estruturada e busca sao mutuamente exclusivas na API do
        // Gemini; aqui so a busca importa, entao nao ha responseMimeType.
        if (comBusca) payload.tools = ferramentasDeBusca(modelo);

        const resposta = await fetch(
          `${GEMINI_BASE}/${modelo}:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        return { ok: resposta.ok, status: resposta.status, texto: await resposta.text() };
      };

      try {
        const querBusca = env.GROUNDING_DESLIGADO !== '1';
        let bruta = await chamarGemini(querBusca);
        let usouBusca = querBusca;

        /*
         * Repescagem sem busca.
         *
         * Grounding depende de modelo, regiao e plano de faturamento. Um
         * 400 por ferramenta indisponivel derrubaria a conversa inteira e
         * o aluno so veria "erro". Melhor responder sem fonte - e a
         * interface deixa claro que nenhuma foi consultada.
         */
        if (!bruta.ok && querBusca && bruta.status === 400) {
          bruta = await chamarGemini(false);
          usouBusca = false;
        }

        if (!bruta.ok) {
          return json(
            { error: 'gemini_falhou', message: bruta.texto.slice(0, 400) },
            bruta.status,
            corsHeaders,
          );
        }

        const dados = JSON.parse(bruta.texto);
        const texto = textoDaResposta(dados);
        const { fontes, consultas, groundingUsado } = extrairFontes(dados);

        return json(
          {
            texto,
            modo,
            modelo,
            fontes,
            consultas,
            // Dois sinais distintos, e a interface mostra badges
            // diferentes: "buscou na web" nao e o mesmo que "citou prova".
            groundingUsado: usouBusca && groundingUsado,
            citouProva: detectarCitacaoDeProva(texto),
          },
          200,
          corsHeaders,
        );
      } catch (err) {
        return json({ error: 'chat_erro', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    // =============================================================
    // 7. Redacao manuscrita: upload + OCR + correcao numa chamada
    // =============================================================
    if (url.pathname === '/api/essays/upload-and-grade' && request.method === 'POST') {
      if (!tokenValido(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
      if (!env.GEMINI_API_KEY) {
        return json({ error: 'misconfigured', message: 'Defina GEMINI_API_KEY.' }, 500, corsHeaders);
      }

      // A foto e material escolar de um menor de idade: sem sessao, nao entra.
      const usuario = await usuarioDoToken(env, request);
      if (!usuario) {
        return json({ error: 'sem_sessao', message: 'Faca login novamente.' }, 401, corsHeaders);
      }

      let formulario;
      try {
        formulario = await request.formData();
      } catch {
        return json({ error: 'form_invalido', message: 'Envie multipart/form-data.' }, 400, corsHeaders);
      }

      const arquivo = formulario.get('imagem') || formulario.get('file');
      if (!arquivo || typeof arquivo === 'string') {
        return json({ error: 'imagem_ausente' }, 400, corsHeaders);
      }

      const tipo = arquivo.type || 'image/jpeg';
      if (!MIMES_ACEITOS.includes(tipo)) {
        return json({ error: 'tipo_invalido', message: `Formato ${tipo} nao aceito.` }, 415, corsHeaders);
      }
      if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
        return json(
          { error: 'imagem_grande', message: 'A foto passou de 8 MB mesmo depois da compressao.' },
          413,
          corsHeaders,
        );
      }

      const tema = String(formulario.get('tema') || '').slice(0, 300);

      try {
        const buffer = await arquivo.arrayBuffer();
        const extensao = (tipo.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const caminho = `${usuario.id}/${crypto.randomUUID()}.${extensao}`;

        // 1) guarda a foto (bucket privado, caminho por dono)
        await subirImagem(env, caminho, buffer, tipo);

        // 2) OCR + correcao na MESMA chamada: sao duas leituras da mesma
        //    imagem, e separa-las dobraria custo e latencia - alem de
        //    permitir que a nota fosse calculada sobre uma transcricao
        //    diferente da que o aluno le na tela.
        const modelo = env.GEMINI_MODEL_VISION || MODELO_VISAO_PADRAO;
        const resposta = await fetch(
          `${GEMINI_BASE}/${modelo}:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: promptCorrecaoFoto(tema) },
                    { inlineData: { mimeType: tipo, data: paraBase64(buffer) } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json',
                responseSchema: ESQUEMA_CORRECAO,
              },
            }),
          },
        );

        if (!resposta.ok) {
          return json(
            { error: 'visao_falhou', message: (await resposta.text()).slice(0, 400) },
            resposta.status,
            corsHeaders,
          );
        }

        const correcao = normalizarCorrecao(jsonDaResposta(textoDaResposta(await resposta.json())));
        const ilegivel = pareceFotoIlegivel(correcao);
        const imagemUrl = await assinarImagem(env, caminho);

        // 3) historico - a mesma tabela da redacao digitada, para o aluno
        //    acompanhar a evolucao num lugar so.
        let redacaoId = null;
        if (!ilegivel) {
          try {
            const [linha] = await supabaseInsert(env, 'redacoes', {
              user_id: usuario.id,
              tema: tema || correcao.detected_theme,
              nota_final: correcao.total_score,
              competencia1: correcao.scores.competence_1.score,
              competencia2: correcao.scores.competence_2.score,
              competencia3: correcao.scores.competence_3.score,
              competencia4: correcao.scores.competence_4.score,
              competencia5: correcao.scores.competence_5.score,
              pontos_fortes: correcao.strengths,
              pontos_melhorar: correcao.actionable_improvements,
              texto_original: correcao.transcription,
              origem: 'foto',
              imagem_path: caminho,
              transcricao: correcao.transcription,
              feedback_competencias: correcao.scores,
            });
            redacaoId = linha?.id ?? null;
          } catch (err) {
            // A correcao ja esta pronta: devolve mesmo assim. Perder o
            // historico e ruim; perder a correcao depois de o aluno
            // esperar a leitura de uma folha inteira e pior.
            console.warn('historico da redacao nao gravado:', err && err.message);
          }
        }

        return json(
          { ...correcao, essay_id: redacaoId, image_url: imagemUrl, image_path: caminho, ilegivel },
          200,
          corsHeaders,
        );
      } catch (err) {
        return json({ error: 'correcao_falhou', message: String(err && err.message) }, 502, corsHeaders);
      }
    }

    return json({ error: 'not_found' }, 404, corsHeaders);
  },

  /**
   * Cron do Cloudflare: esvazia a fila de notificações a cada disparo.
   * Configure em wrangler.toml:  [triggers] crons = ["*\/5 * * * *"]
   */
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      this.fetch(
        new Request('https://worker/notify/drain', {
          method: 'POST',
          headers: env.API_TOKEN ? { Authorization: `Bearer ${env.API_TOKEN}` } : {},
        }),
        env,
      ),
    );
  },
};

/**
 * Variante para servidores Node (Express/Next API route) - se preferir não usar Workers:
 *   import MascotProxy from './worker.js'
 *   app.all('*', (req, res) => { ... adapta Request/Response ... })
 */
