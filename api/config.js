/**
 * Configuracao publica do app, lida em TEMPO DE EXECUCAO.
 *
 * ------------------------------------------------------------------
 * O PROBLEMA QUE ISTO RESOLVE
 * ------------------------------------------------------------------
 * O Vite substitui `import.meta.env.VITE_*` por texto literal durante o
 * BUILD. Numa app publicada na Vercel isso quer dizer que trocar a URL do
 * Supabase no painel nao muda nada ate alguem disparar um novo deploy -
 * e, pior, um build feito sem as variaveis gera um bundle com strings
 * vazias congeladas dentro.
 *
 * Esta rota le `process.env` A CADA REQUISICAO. Mudou a variavel no
 * painel da Vercel, vale no proximo carregamento da pagina. Sem rebuild,
 * sem `.env` no repositorio.
 *
 * ------------------------------------------------------------------
 * O QUE PODE SAIR DAQUI
 * ------------------------------------------------------------------
 * SOMENTE o que ja seria publico de qualquer forma: a URL do projeto
 * Supabase e a chave anon (publicas por desenho - quem protege os dados e
 * a RLS) e as preferencias de provedor/modelo de IA.
 *
 * Chave de servidor NUNCA entra nesta resposta: DEEPSEEK_API_KEY,
 * GEMINI_API_KEY, SUPABASE_SERVICE_KEY, RESEND_API_KEY, MP_ACCESS_TOKEN
 * e GOOGLE_TTS_KEY ficam exclusivamente dentro de `/api/*`. O campo
 * `recursos` conta apenas se cada uma ESTA configurada (booleano), para a
 * interface avisar o usuario - o valor em si jamais viaja.
 */

/** Primeiro valor nao-vazio; aceita o nome com e sem prefixo VITE_. */
function ler(...nomes) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }
  return '';
}

export const config = { maxDuration: 10 };

export function GET() {
  const provedor = ler('AI_PROVIDER', 'VITE_AI_PROVIDER').toLowerCase() === 'gemini' ? 'gemini' : 'deepseek';

  const corpo = {
    supabaseUrl: ler('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/+$/, ''),
    supabaseAnonKey: ler('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    aiProvider: provedor,
    aiModel: ler('AI_MODEL', 'VITE_AI_MODEL') || (provedor === 'deepseek' ? 'deepseek-v4-flash' : 'gemini-2.0-flash'),
    aiVisionModel: ler('AI_VISION_MODEL', 'VITE_AI_VISION_MODEL') || 'gemini-1.5-flash',
    /*
     * Vazio = back-end na MESMA ORIGEM (`/api`), que e o caso desta
     * implantacao. So preencha AI_BASE_URL para apontar de volta a um
     * Cloudflare Worker externo.
     */
    aiBaseUrl: ler('AI_BASE_URL', 'VITE_AI_BASE_URL').replace(/\/+$/, ''),
    n8nWebhookUrl: ler('N8N_WEBHOOK_URL', 'VITE_N8N_WEBHOOK_URL'),
    /* Esta resposta so existe onde `/api/*` existe. */
    backendIA: true,
    recursos: {
      deepseek: !!ler('DEEPSEEK_API_KEY'),
      gemini: !!ler('GEMINI_API_KEY'),
      tts: !!ler('GOOGLE_TTS_KEY'),
      email: !!ler('RESEND_API_KEY'),
      pagamento: ler('MP_ACCESS_TOKEN') ? 'mercadopago' : 'simulado',
    },
  };

  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /*
       * `no-store` e o que faz a troca no painel valer na hora. Com
       * qualquer cache de borda a variavel nova ficaria presa ate o TTL
       * expirar - exatamente o problema do build-time que esta rota veio
       * resolver.
       */
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
