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
 *   POST /api/turmas/import -> secretaria importa alunos (IA + contas + convites)
 *   POST /api/ocr-process   -> EPICO 1: foto do caderno -> transcricao + duvida
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
  extrairSinalFrustracao,
  detectarCitacaoDeProva,
  modoValido,
  modoRespostaValido,
  limparTextoLivre,
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

/* ===================================================================
   Provedor e modelo vindos do ambiente

   LEIA SEMPRE POR AQUI, nunca `env.AI_PROVIDER` direto.

   Este helper existe por causa de um bug real em produção. Havia cinco
   leituras espalhadas dessas duas variáveis, e só ALGUMAS aparavam o
   valor: `AI_MODEL` passava por `.trim()`, `AI_PROVIDER` não. Um espaço
   ou quebra de linha invisível no fim do valor — o que acontece à toa ao
   colar no painel da Vercel — produzia o sintoma mais confuso possível:

     AI_PROVIDER = "deepseek\n"  ->  "deepseek\n" !== "deepseek"  ->  cai em gemini
     AI_MODEL    = "deepseek-v4-flash\n"  ->  aparado  ->  funciona

   Ou seja, as duas variáveis cadastradas juntas, com o mesmo valor
   colado do mesmo jeito, e o /health respondia
   {provider: "gemini", model: "deepseek-v4-flash"} — um estado que, lendo
   o painel, parecia impossível.

   O padrão também mudou para DeepSeek. Antes era Gemini, e o
   `wrangler.toml` já contornava isso com um comentário dizendo "sem isso
   o worker assumia Gemini e quebrava tudo sem GEMINI_API_KEY". Só que
   esse contorno vive no arquivo da Cloudflare, que não existe na Vercel —
   então lá o padrão errado reaparecia. O padrão documentado do projeto
   (README, .env.example, api/config.js) é DeepSeek; o código era o único
   fora de compasso.
   =================================================================== */

/** Provedor configurado no ambiente. Aparado e com DeepSeek como padrão. */
function provedorDoAmbiente(env) {
  return String(env.AI_PROVIDER || '').trim().toLowerCase() === 'gemini' ? 'gemini' : 'deepseek';
}

/** Modelo configurado no ambiente, aparado ('' quando ausente). */
function modeloDoAmbiente(env) {
  return String(env.AI_MODEL || '').trim();
}
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
  // Em produção defina ALLOWED_ORIGIN=https://seu-dominio: com '*' qualquer
  // site usa sua cota de IA (o API_TOKEN vai no bundle, então não é segredo).
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Supabase-Auth',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
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

/**
 * Detecta o tipo real pelos magic-bytes (não pelo `arquivo.type`, que o
 * cliente controla). Retorna null para SVG/texto/executável disfarçado.
 */
function tipoPorMagicBytes(buffer) {
  const b = new Uint8Array(buffer);
  if (b.length < 12) return null;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  // WebP: RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  // HEIC/HEIF: ....ftyp + marca heic/heix/hevc/hevx/mif1/msf1
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/heic';
  return null;
}

/** Extrai o JSON da resposta do Gemini, com ou sem cerca de markdown. */
function jsonDaResposta(texto) {
  const limpo = String(texto || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpo);
  } catch (primeiroErro) {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio >= 0 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch (segundoErro) {
        throw new Error(`resposta do modelo não é JSON: ${String(segundoErro && segundoErro.message || segundoErro).slice(0, 120)}`);
      }
    }
    throw new Error(`resposta do modelo não é JSON: ${String(primeiroErro && primeiroErro.message || primeiroErro).slice(0, 120)}`);
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
  const pedido = String(payload?.provider || '').trim().toLowerCase();
  if (pedido === 'deepseek' || pedido === 'gemini') return pedido;
  return provedorDoAmbiente(env);
}

function modeloEfetivo(payload, env, provedor) {
  const pedido = String(payload?.model || '').trim();
  if (pedido && MODELOS_PERMITIDOS.has(pedido)) return pedido;
  const padraoEnv = modeloDoAmbiente(env);
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

/**
 * Trava os parâmetros que o cliente pode pedir no /generate.
 *
 * temperature 0-1, teto de 8192 tokens de saída (o quiz estruturado usa
 * até ~5000; o chat usa 1000). Sem isso, max_tokens arbitrário virava
 * dreno de cota — ainda mais com CORS aberto e API_TOKEN opcional.
 */
function limitarGenerationConfig(generationConfig) {
  const base = generationConfig && typeof generationConfig === 'object' ? generationConfig : {};
  const out = { ...base };
  const temp = Number(base.temperature);
  out.temperature = Number.isFinite(temp) ? Math.min(1, Math.max(0, temp)) : 0.5;
  const maxReq = Number(base.maxOutputTokens ?? base.max_tokens);
  const maximo = Number.isFinite(maxReq) && maxReq > 0 ? Math.min(8192, Math.floor(maxReq)) : 1000;
  out.maxOutputTokens = maximo;
  delete out.max_tokens;
  const topP = Number(base.topP ?? base.top_p);
  if (Number.isFinite(topP)) out.topP = Math.min(1, Math.max(0, topP));
  delete out.top_p;
  if (base.response_format && typeof base.response_format === 'object') {
    out.response_format = base.response_format;
  } else {
    delete out.response_format;
  }
  return out;
}

function genParaDeepSeek(generationConfig = {}) {
  const out = {};
  const temp = Number(generationConfig.temperature);
  const maxTokens = Number(generationConfig.maxOutputTokens ?? generationConfig.max_tokens);
  const topP = Number(generationConfig.topP ?? generationConfig.top_p);
  if (Number.isFinite(temp)) out.temperature = temp;
  if (Number.isFinite(maxTokens) && maxTokens > 0) out.max_tokens = Math.floor(maxTokens);
  if (Number.isFinite(topP)) out.top_p = topP;
  // Saida JSON estrita (quiz, mapa mental). So chega aqui em fluxos
  // DeepSeek: o front so inclui em modo deepseek, e o caminho Gemini do
  // worker nunca repassa este campo ao Google.
  if (generationConfig.response_format && typeof generationConfig.response_format === 'object') {
    out.response_format = generationConfig.response_format;
  }
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

/* ===================================================================
   Importacao de turma: normalizacao por IA + contas + convites
   =================================================================== */

const EMAIL_OK_IMPORT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Primeiro char aceita '(' — o formato BR "(11) 99999-8888" começava com
// parêntese e era rejeitado pelo padrão antigo, inclusive no exemplo.
const FONE_OK_IMPORT = /^[+\d(][\d\s().-]{7,24}$/;

/** Senha temporaria de uso unico: 12 chars sem ambiguos (0/O, 1/l). */
function senhaTemporaria() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('');
}

/** Login institucional do aluno (email tecnico, nao precisa receber). */
function loginDoAluno(nome, codigoTurma, dominio) {
  const slug = String(nome || 'aluno')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '').slice(0, 30) || 'aluno';
  const sufixo = crypto.randomUUID().replace(/-/g, '').slice(0, 4);
  return `${slug}.${String(codigoTurma || 'turma').toLowerCase()}.${sufixo}@${dominio}`;
}

function dominioAlunos(env) {
  try {
    const host = new URL(env.PUBLIC_APP_URL || 'https://app.midnightmentor.app').hostname;
    return `alunos.${host}`;
  } catch {
    return 'alunos.midnightmentor.app';
  }
}

/**
 * IA (DeepSeek barato) normaliza a lista: corrige caixa dos nomes,
 * associa cada sala a uma turma existente (por id) e valida contatos.
 * Qualquer falha -> segue com os dados crus (ia: false no relatorio).
 */
async function normalizarTurmaComIA(env, linhas, turmas) {
  const cruas = linhas.map((l) => ({
    nome: String(l.nome || l['Nome do Aluno'] || '').slice(0, 120),
    sala: String(l.sala || l.Sala || '').slice(0, 20),
    email: String(l.email || l['Email do Responsável'] || '').trim().slice(0, 120),
    telefone: String(l.telefone || l['Telefone do Responsável'] || '').trim().slice(0, 25),
    tipo: /docente|professor|teacher/i.test(String(l.tipo || '')) ? 'teacher' : 'student',
  }));

  if (!env.DEEPSEEK_API_KEY) return { linhas: cruas, ia: false };

  try {
    const saida = await chamarDeepSeek(
      env,
      /* Aparado: sem isso, um valor com espaço no fim era enviado como
         nome de modelo e a API recusava a chamada. */
      /^deepseek-/i.test(modeloDoAmbiente(env)) ? modeloDoAmbiente(env) : DEEPSEEK_DEFAULT_MODEL,
      [
        {
          role: 'system',
          content: 'Você normaliza cadastros escolares. Responda APENAS com JSON {"alunos":[...]}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, codigo: t.codigo })),
            alunos: cruas,
            instrucao: 'Para cada aluno devolva {nome (Title Case, sem apelidos), sala (igual à turma mais parecida), turmaId (id exato da turma ou null), email, telefone, tipo, problemas[] (lista curta do que está errado ou vazio)}.',
          }),
        },
      ],
      { temperature: 0.2, maxOutputTokens: 4000, response_format: { type: 'json_object' } },
    );
    if (!saida.ok) return { linhas: cruas, ia: false };
    // chamarDeepSeek reembala em envelope Gemini: desembrulha antes de
    // ler o JSON da IA (antes lia .choices do envelope e a IA nunca
    // era aplicada — caía sempre no fallback cru).
    const texto = textoDaResposta(JSON.parse(saida.texto));
    const arr = JSON.parse(texto).alunos;
    if (!Array.isArray(arr) || arr.length === 0) return { linhas: cruas, ia: false };
    const ids = new Set(turmas.map((t) => String(t.id)));
    return {
      ia: true,
      linhas: cruas.map((crua, i) => {
        const n = arr[i] && typeof arr[i] === 'object' ? arr[i] : {};
        return {
          nome: String(n.nome || crua.nome).slice(0, 120),
          sala: String(n.sala || crua.sala).slice(0, 20),
          turmaId: ids.has(String(n.turmaId)) ? String(n.turmaId) : null,
          email: String(n.email || crua.email).trim().slice(0, 120),
          telefone: String(n.telefone || crua.telefone).trim().slice(0, 25),
          tipo: n.tipo === 'teacher' ? 'teacher' : 'student',
          problemas: Array.isArray(n.problemas) ? n.problemas.map(String).slice(0, 4) : [],
        };
      }),
    };
  } catch {
    return { linhas: cruas.map((c) => ({ ...c, turmaId: null, problemas: [] })), ia: false };
  }
}

/** Associa sala -> turma por nome quando a IA não devolveu id. */
function turmaPorSala(turmas, sala) {
  const alvo = String(sala || '').trim().toLowerCase();
  if (!alvo) return null;
  return turmas.find((t) => String(t.nome || '').trim().toLowerCase() === alvo) || null;
}

function cabecalhosAdmin(env) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function adminCreateUser(env, email, password, nome) {
  const resposta = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabecalhosAdmin(env),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nome } }),
  });
  const texto = await resposta.text();
  if (!resposta.ok) return { ok: false, erro: texto.slice(0, 160) };
  try {
    return { ok: true, id: JSON.parse(texto).id };
  } catch {
    return { ok: false, erro: 'resposta admin invalida' };
  }
}

/** Link mágico de confirmação (Supabase Admin). Null quando indisponível. */
async function adminGenerateLink(env, email) {
  try {
    const resposta = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: cabecalhosAdmin(env),
      body: JSON.stringify({ type: 'magiclink', email }),
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return typeof dados?.action_link === 'string' ? dados.action_link : null;
  } catch {
    return null;
  }
}

async function perfilDoImportado(env, uid, patch) {
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/perfis?id=eq.${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    headers: { ...cabecalhosAdmin(env), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return resposta.ok;
}

function emailBoasVindas({ paraQuem, login, senha, linkMagico, escola, codigoInstituicao, turma, appUrl }) {
  const linhasTexto = [
    `Olá! Sua conta no Midnight Mentor foi criada pela secretaria (${escola}).`,
    '',
    `Login: ${login}`,
    `Senha temporária (uso único, troque no primeiro acesso): ${senha}`,
    linkMagico ? `Confirmação em 1 clique: ${linkMagico}` : '',
    '',
    // Aluno importado JÁ nasce na escola e na turma (perfilDoImportado).
    // "Digite os códigos no Perfil" era um passo à toa, que ainda fazia
    // parecer que a matrícula não tinha dado certo. Os códigos continuam
    // no e-mail como reserva: se a gravação do perfil falhar, são o
    // único jeito de o aluno entrar sozinho.
    turma
      ? `Você já está na turma ${turma.nome}. Só se o app pedir, os códigos são: escola ${codigoInstituicao}, turma ${turma.codigo}.`
      : `Código da escola (digite no Perfil): ${codigoInstituicao}. Sua turma será vinculada pela secretaria.`,
    '',
    `Acesse: ${appUrl}`,
    'Guarde este email em sigilo e não repasse os códigos a ninguém de fora da escola.',
  ].filter((l) => l !== null);
  return { assunto: `Sua conta no Midnight Mentor (${escola})`, corpo: linhasTexto.join('\n') };
}

/**
 * Importa UMA linha: cria aluno (+ responsavel ou docente), vincula
 * escola/turma, marca troca de senha e envia o convite. Devolve o
 * resultado para o relatório da secretaria (nunca joga).
 */
async function importarLinha(env, escola, turmas, linha) {
  const tipo = linha.tipo === 'teacher' ? 'teacher' : 'student';
  const turma = linha.turmaId
    ? turmas.find((t) => String(t.id) === String(linha.turmaId)) || null
    : turmaPorSala(turmas, linha.sala);
  const appUrl = env.PUBLIC_APP_URL || 'https://app.midnightmentor.app';
  const podeEmail = !!env.RESEND_API_KEY;

  // Docente usa o próprio email como login; aluno usa login institucional
  // e o email do responsável só recebe (nunca vira login do aluno).
  const emailDono = tipo === 'teacher' ? linha.email : null;
  if (tipo === 'teacher' && !EMAIL_OK_IMPORT.test(linha.email)) {
    return { ok: false, erro: 'email do docente inválido', emailEnviado: false };
  }
  if (tipo === 'student') {
    if (!linha.nome.trim()) return { ok: false, erro: 'nome ausente', emailEnviado: false };
    if (!EMAIL_OK_IMPORT.test(linha.email)) return { ok: false, erro: 'email do responsável inválido', emailEnviado: false };
    if (linha.telefone && !FONE_OK_IMPORT.test(linha.telefone)) {
      return { ok: false, erro: 'telefone do responsável inválido', emailEnviado: false };
    }
  }

  const senhaAluno = senhaTemporaria();
  const loginAluno = tipo === 'teacher'
    ? linha.email.trim()
    : loginDoAluno(linha.nome, turma?.codigo, dominioAlunos(env));

  const criado = await adminCreateUser(env, loginAluno, senhaAluno, linha.nome || 'Docente');
  if (!criado.ok) {
    const duplicado = /already|exists|duplicate|unique/i.test(criado.erro);
    return { ok: false, erro: duplicado ? 'login já existe' : `falha ao criar conta: ${criado.erro}`, emailEnviado: false };
  }

  await perfilDoImportado(env, criado.id, {
    papel: tipo,
    escola_id: escola.id,
    turma_id: turma ? turma.id : null,
    deve_trocar_senha: true,
    ...(tipo === 'student' ? { email_responsaveis: linha.email.trim() } : {}),
  });

  let loginResp = null;
  let senhaResp = null;
  let linkMagico = null;
  let destinoEmail = null;

  if (tipo === 'student') {
    // Conta do responsável (email real): confirmação por link mágico.
    senhaResp = senhaTemporaria();
    const resp = await adminCreateUser(env, linha.email.trim(), senhaResp, `Responsável por ${linha.nome}`);
    if (resp.ok) {
      await perfilDoImportado(env, resp.id, { papel: 'parent', escola_id: escola.id, deve_trocar_senha: true });
      loginResp = linha.email.trim();
      linkMagico = await adminGenerateLink(env, linha.email.trim());
    }
    destinoEmail = linha.email.trim();
  } else {
    loginResp = null;
    linkMagico = await adminGenerateLink(env, linha.email.trim());
    destinoEmail = linha.email.trim();
  }

  const convite = emailBoasVindas({
    paraQuem: tipo,
    login: loginAluno,
    senha: senhaAluno,
    linkMagico,
    escola: escola.nome,
    codigoInstituicao: escola.codigo_instituicao,
    turma,
    appUrl,
  });
  // O corpo do responsável carrega as duas credenciais + códigos.
  const corpoFinal = tipo === 'student' && loginResp
    // Sem "---" de separador: e-mail é texto que o usuário lê, e a regra
    // de escrita do produto vale aqui também. E o responsável precisa
    // saber como começar a acompanhar: a importação cria a conta dele,
    // mas o vínculo é pelo código que o ALUNO entrega (024).
    ? `${convite.corpo}\n\nCONTA DO RESPONSÁVEL\nLogin: ${loginResp}\nSenha temporária: ${senhaResp}\nUse o link de confirmação acima para ativar.\n\nPara acompanhar os estudos, peça ao estudante o código que aparece no app dele, em Perfil, Responsáveis, e digite no seu painel.`
    : convite.corpo;

  let emailEnviado = false;
  if (podeEmail && destinoEmail) {
    emailEnviado = await enviarEmail(env, destinoEmail, convite.assunto, corpoFinal);
  }

  const saida = {
    ok: true,
    login: loginAluno,
    turma: turma ? turma.nome : null,
    codigoTurma: turma ? turma.codigo : null,
    emailEnviado,
  };
  // Sem Resend, a secretaria repassa manualmente: credenciais voltam no
  // relatório (canal interno, nunca em tela pública).
  if (!emailEnviado) {
    return {
      ...saida,
      senhaTemporaria: senhaAluno,
      ...(loginResp ? { loginResponsavel: loginResp, senhaResponsavel: senhaResp } : {}),
      linkMagico,
    };
  }
  return saida;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = cors(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      const provedor = provedorDoAmbiente(env);
      return json(
        {
          status: 'ok',
          provider: provedor,
          model:
            modeloDoAmbiente(env) || (provedor === 'deepseek' ? DEEPSEEK_DEFAULT_MODEL : DEFAULT_MODEL),
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
      // Teto server-side: o cliente manda generationConfig livre e sem isso
      // qualquer origem (CORS *) drenava a cota com max_tokens gigante.
      payload.generationConfig = limitarGenerationConfig(payload.generationConfig);

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

      // Padrão: Ana (Neural2-A, feminina) — a voz das pílulas.
      const voz = /^pt-BR-[A-Za-z0-9-]+$/.test(corpo.voz || '') ? corpo.voz : 'pt-BR-Neural2-A';
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
      const valor = valorCentavos ?? null;
      if (valor !== null && (!Number.isFinite(Number(valor)) || Number(valor) <= 0)) {
        return json({ error: 'valor_invalido' }, 400, corsHeaders);
      }

      // O agendamento tem de ser mesmo de quem está pagando.
      let agendamento;
      try {
        const linhas = await supabaseSelect(
          env,
          `agendamentos?id=eq.${encodeURIComponent(agendamentoId)}&select=id,aluno_id,responsavel_id,valor_centavos,status_pagamento`,
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
        // external_reference forjado ou ausente não cria sala nem confirma.
        if (!agendamentoId || typeof agendamentoId !== 'string') {
          return json({ ok: true, ignorado: true }, 200, corsHeaders);
        }
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
          'notificacoes?canal=eq.email&enviada_em=is.null&tentativas=lt.3&select=id,user_id,titulo,corpo,tentativas&limit=50',
        );

        let enviadas = 0;
        for (const n of pendentes) {
          const perfis = await supabaseSelect(env, `perfis?id=eq.${encodeURIComponent(n.user_id)}&select=email`);
          const email = perfis[0]?.email;
          const ok = email ? await enviarEmail(env, email, n.titulo, n.corpo) : false;

          await supabasePatch(
            env,
            `notificacoes?id=eq.${encodeURIComponent(n.id)}`,
            ok
              ? { enviada_em: new Date().toISOString() }
              : // Antes gravava `tentativas: 1` fixo: a fila tentava para
                // sempre. Incremento real (lê o valor atual da linha).
                { tentativas: (Number(n.tentativas) || 0) + 1 },
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

      // Toggle Explicativo/Comunicativo: validado contra a allowlist para
      // nao deixar o cliente injetar instrucao livre no system do servidor.
      const modoResposta = modoRespostaValido(corpo.modoResposta) ? corpo.modoResposta : undefined;

      const systemInstruction = {
        parts: [
          {
            text: montarSystemInstructionChat({
              modo,
              horaLocal: Number(corpo.horaLocal),
              // limparTextoLivre (mesma do front): sem \n, sem injeção de prompt.
              nomeAluno: limparTextoLivre(corpo.nomeAluno),
              materiaRecente: limparTextoLivre(corpo.materiaRecente),
              modoResposta,
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

      /* temperature 0.5 / 1000 tokens: mesmo config do front
         (aiProvider DEEPSEEK_CHAT_CONFIG/GEMINI_CHAT_CONFIG) — versão
         mais barata do DeepSeek-V4-Flash, comportamento idêntico em
         todos os transportes. */
      const generationConfig = { temperature: 0.5, maxOutputTokens: 1000, topP: 0.9 };

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
          const brutoDs = textoDaResposta(JSON.parse(saida.texto));
          // EPICO 2: o bloco `frustracao` nunca chega a tela; vira flag.
          const sinalDs = extrairSinalFrustracao(brutoDs);
          return json(
            {
              texto: sinalDs.textoLimpo,
              frustrationDetected: sinalDs.frustrationDetected,
              modo,
              modelo: modeloDs,
              fontes: [],
              consultas: [],
              groundingUsado: false,
              citouProva: detectarCitacaoDeProva(sinalDs.textoLimpo),
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
        // EPICO 2: separa o bloco `frustracao` antes de exibir.
        const { textoLimpo, frustrationDetected } = extrairSinalFrustracao(textoDaResposta(dados));
        const { fontes, consultas, groundingUsado } = extrairFontes(dados);

        return json(
          {
            texto: textoLimpo,
            frustrationDetected,
            modo,
            modelo,
            fontes,
            consultas,
            // Dois sinais distintos, e a interface mostra badges
            // diferentes: "buscou na web" nao e o mesmo que "citou prova".
            groundingUsado: usouBusca && groundingUsado,
            citouProva: detectarCitacaoDeProva(textoLimpo),
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

      // arquivo.type é cabeçalho controlado pelo cliente: confere os
      // magic-bytes reais (JPEG/PNG/WebP/HEIC) e veta SVG por conteúdo.
      const buffer = await arquivo.arrayBuffer();
      const tipoReal = tipoPorMagicBytes(buffer);
      if (!tipoReal || !MIMES_ACEITOS.includes(tipoReal)) {
        return json({ error: 'tipo_invalido', message: 'Formato de imagem nao aceito. Use JPG ou PNG.' }, 415, corsHeaders);
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
        // Extensão sai dos BYTES verificados, nunca do tipo declarado.
        const tipo = tipoReal;
        const extensao = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
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

    // =============================================================
    // 8. Importacao de turma (secretaria, pos-pagamento no site)
    //
    // A secretaria importa CSV/tabela no painel; a IA normaliza
    // (nomes, sala -> turma, email/telefone) e o SERVIDOR cria as
    // contas com senha temporaria de uso unico + link magico, e envia
    // tudo por email ao responsavel (login do aluno, login do
    // responsavel, codigos da instituicao e da turma).
    //
    // So educator/admin da PROPRIA escola (papel lido do perfil, nunca
    // do cliente). Senhas temporarias morrem no primeiro login
    // (deve_trocar_senha) e nunca aparecem em tela — so no email.
    // =============================================================
    if (url.pathname === '/api/turmas/import' && request.method === 'POST') {
      if (!tokenValido(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
        return json({ error: 'misconfigured', message: 'Defina SUPABASE_URL e SUPABASE_SERVICE_KEY.' }, 500, corsHeaders);
      }

      const educador = await usuarioDoToken(env, request);
      if (!educador) {
        return json({ error: 'sem_sessao', message: 'Faca login novamente.' }, 401, corsHeaders);
      }

      let corpo;
      try {
        corpo = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      const linhas = Array.isArray(corpo.alunos) ? corpo.alunos.slice(0, 500) : [];
      if (linhas.length === 0) return json({ error: 'sem_alunos' }, 400, corsHeaders);

      // Papel e escola do solicitante: o cliente nao escolhe a escola.
      let perfil;
      try {
        const linhasPerfil = await supabaseSelect(
          env,
          `perfis?id=eq.${encodeURIComponent(educador.id)}&select=papel,escola_id`,
        );
        perfil = linhasPerfil[0];
      } catch (err) {
        return json({ error: 'perfil_falhou', message: String(err.message) }, 502, corsHeaders);
      }
      const papel = String(perfil?.papel || '');
      if (papel !== 'educator' && papel !== 'admin') {
        return json({ error: 'sem_permissao', message: 'So a secretaria da escola importa turmas.' }, 403, corsHeaders);
      }
      const escolaId = perfil?.escola_id;
      if (!escolaId) {
        return json({ error: 'sem_escola', message: 'Sua conta nao esta vinculada a uma escola.' }, 400, corsHeaders);
      }

      // Escola (codigo da instituicao) + turmas (id, nome, codigo).
      let escola;
      let turmas;
      try {
        const [e, t] = await Promise.all([
          supabaseSelect(env, `escolas?id=eq.${encodeURIComponent(escolaId)}&select=id,nome,codigo_instituicao`),
          supabaseSelect(env, `turmas?escola_id=eq.${encodeURIComponent(escolaId)}&select=id,nome,codigo`),
        ]);
        escola = e[0];
        turmas = Array.isArray(t) ? t : [];
      } catch (err) {
        return json({ error: 'escola_falhou', message: String(err.message) }, 502, corsHeaders);
      }
      if (!escola) return json({ error: 'escola_nao_encontrada' }, 404, corsHeaders);

      // 1) IA normaliza (nomes, sala -> turma, valida contatos). Sem
      // DeepSeek, segue com os dados crus + validacao por regex.
      const { linhas: normalizados, ia } = await normalizarTurmaComIA(env, linhas, turmas);

      // 2) Cria contas e envia convites, uma linha por vez (para o
      // relatorio dizer exatamente qual linha falhou e por que).
      const resultados = [];
      let emailsEnviados = 0;
      for (let i = 0; i < normalizados.length; i++) {
        const linha = normalizados[i];
        // eslint-disable-next-line no-await-in-loop
        const r = await importarLinha(env, escola, turmas, linha);
        if (r.emailEnviado) emailsEnviados++;
        resultados.push({ linha: i + 1, nome: linha.nome, tipo: linha.tipo, ia, ...r });
      }

      return json(
        {
          ok: true,
          escola: escola.nome,
          codigoInstituicao: escola.codigo_instituicao,
          total: resultados.length,
          criados: resultados.filter((r) => r.ok).length,
          emailsEnviados,
          emailConfigurado: !!env.RESEND_API_KEY,
          normalizadoPorIA: ia,
          resultados,
        },
        200,
        corsHeaders,
      );
    }

    // =============================================================
    // 9. EPICO 1 (HackTudo 2026): Ponte analogica-digital (OCR)
    //
    // O celular e so um scanner de 5 segundos: recebe a foto do caderno
    // em base64, o Gemini Vision transcreve o manuscrito e extrai a
    // duvida principal, e o front joga o texto no input do chat.
    // Sem sessao nao entra (foto de material escolar de menor).
    // =============================================================
    if (url.pathname === '/api/ocr-process' && request.method === 'POST') {
      if (!tokenValido(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
      if (!env.GEMINI_API_KEY) {
        return json({ error: 'misconfigured', message: 'Defina GEMINI_API_KEY.' }, 500, corsHeaders);
      }

      const usuario = await usuarioDoToken(env, request);
      if (!usuario) {
        return json({ error: 'sem_sessao', message: 'Faca login novamente.' }, 401, corsHeaders);
      }

      let corpo;
      try {
        corpo = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, corsHeaders);
      }

      const bruto = String(corpo.imageBase64 || corpo.imagem || '');
      if (!bruto) return json({ error: 'imagem_ausente' }, 400, corsHeaders);

      // Aceita data-URL ou base64 puro; mime sai do prefixo quando houver.
      const match = bruto.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      const mimeType = String(corpo.mimeType || (match ? match[1] : 'image/jpeg')).toLowerCase();
      const base64 = (match ? match[2] : bruto).replace(/\s/g, '');
      const MIMES_OCR = ['image/jpeg', 'image/png', 'image/webp'];
      if (!MIMES_OCR.includes(mimeType)) {
        return json({ error: 'tipo_invalido', message: 'Use foto JPG ou PNG.' }, 415, corsHeaders);
      }
      // ~6MB em base64 ~= 4.5MB binarios: teto do scanner rapido.
      if (base64.length > 6 * 1024 * 1024) {
        return json({ error: 'imagem_grande', message: 'Foto muito grande. Aproxime so do trecho da duvida.' }, 413, corsHeaders);
      }

      const modelo = env.GEMINI_MODEL_VISION || MODELO_VISAO_PADRAO;
      const promptOcr = [
        'Voce e o scanner do Midnight Mentor. Transcreva o texto MANUSCRITO da foto com fidelidade total (mantenha numeros, formulas e unidades).',
        'Depois, em UMA frase, extraia a duvida principal do aluno sobre esse trecho.',
        'Responda APENAS com JSON valido, sem markdown: {"transcricao": "<texto fiel>", "duvida": "<duvida em 1 frase>"}',
        'Se a foto estiver ilegivel, devolva {"transcricao": "", "duvida": ""}.',
      ].join('\n');

      try {
        const upstream = await fetch(
          `${GEMINI_BASE}/${modelo}:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: promptOcr },
                    { inlineData: { mimeType, data: base64 } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
              },
            }),
          },
        );
        if (!upstream.ok) {
          return json(
            { error: 'visao_falhou', message: (await upstream.text()).slice(0, 400) },
            upstream.status,
            corsHeaders,
          );
        }
        const parsed = jsonDaResposta(textoDaResposta(await upstream.json()));
        const transcricao = String(parsed.transcricao || '').slice(0, 4000);
        const duvida = String(parsed.duvida || '').slice(0, 500);
        const textoParaChat = duvida && transcricao
          ? `${duvida}\n\nTrecho do caderno: ${transcricao}`
          : (transcricao || duvida);
        return json({ transcricao, duvida, textoParaChat }, 200, corsHeaders);
      } catch (err) {
        return json({ error: 'ocr_falhou', message: String(err && err.message) }, 502, corsHeaders);
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
