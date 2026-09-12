import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /*
   * Chave DeepSeek LADO SERVIDOR (sem prefixo VITE_ de proposito).
   *
   * loadEnv com prefixo '' le tambem variaveis sem VITE_ - mas SOMENTE
   * aqui, no processo Node do dev server. Variavel sem VITE_ nunca entra
   * no bundle do navegador (o Vite so expoe VITE_* ao cliente), entao a
   * chave jamais vaza para o front, mesmo com o proxy ativo.
   */
  const env = loadEnv(mode, process.cwd(), '')
  const deepseekKey = (env.DEEPSEEK_API_KEY || '').trim()
  /*
   * Base do worker de IA (ex.: https://midnight-mentor-ia.workers.dev).
   * Entra no bypass do SW como regex escapada - sem isso, o host
   * publicado cairia no precache generico e a demo mostraria IA velha.
   */
  const aiBase = (env.VITE_AI_BASE_URL || '').trim().replace(/\/+$/, '')
  const aiBasePattern = aiBase
    ? new RegExp(`^${aiBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`, 'i')
    : null

  return {
    plugins: [
      react(),
      /*
       * PWA (prompt de instalacao no Chrome) com REGRA DE OURO do pitch:
       *
       * - registerType 'autoUpdate': o SW novo assume na hora (skipWaiting +
       *   clientsClaim), sem popup de "nova versao" no meio da demo.
       * - Precache ESTRITO do App Shell: HTML/JS/CSS/fontes/ico­nes gerados.
       *   E so o que o workbox precarrega; nada de runtime caching generico.
       * - PROIBIDO cachear rede externa: Supabase, Gemini, DeepSeek, TTS e
       *   o worker de IA sao Network Only (bypass total do SW). Dado de
       *   jurado jamais vem de cache: offline, essas chamadas falham e o
       *   app cai nos fallbacks locais ja existentes (toast + modo local).
       */
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff,woff2,ttf,png,svg}'],
          // Mascotes do shell passam de 2 MiB (limite padrao do workbox):
          // sem este teto eles ficariam fora do precache e o offline
          // quebraria imagens da UI. Continua so App Shell, sem rede.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Supabase: REST, Auth, Realtime e Storage (qualquer projeto).
              urlPattern: /^https:\/\/[^/]+\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Gemini REST + TTS do Google.
              urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // DeepSeek direto (producao sem worker nunca chama, mas trava
              // a porta por garantia).
              urlPattern: /^https:\/\/api\.deepseek\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Proxy local do Vite dev (same-origin).
              urlPattern: /\/deepseek-api\/.*/i,
              handler: 'NetworkOnly',
            },
            // Worker de IA publicado (so existe se VITE_AI_BASE_URL setado).
            ...(aiBasePattern
              ? [{ urlPattern: aiBasePattern, handler: 'NetworkOnly' as const }]
              : []),
          ],
        },
      }),
    ],
    server: {
      /*
       * Portas fixas e fora da faixa 8080: essa porta ja hospeda outra
       * aplicacao nesta maquina. O Vite nunca escolhe 8080 sozinho (o padrao
       * e 5173 aqui e 4173 no preview), mas deixar explicito evita que
       * qualquer ajuste futuro esbarre no servidor do lado.
       */
      port: 5180,
      /*
       * frame-ancestors so vale como CABECALHO HTTP: via <meta> o navegador
       * ignora e ainda loga erro. Aqui o dev server ja entrega a protecao
       * contra clickjacking; em producao, replique no host (Vercel, Nginx,
       * Cloudflare) porque o Vite nao participa do runtime publicado.
       */
      headers: {
        'Content-Security-Policy': "frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
      /*
       * Proxy local do DeepSeek (somente `vite dev`).
       *
       * O navegador chama o MESMO origin (/deepseek-api/...) e o Vite
       * repassa para api.deepseek.com injetando o Authorization no
       * servidor. Resultado: zero CORS, zero chave no front, zero
       * "Failed to fetch" por bloqueio de third-party/adblock.
       *
       * So existe quando DEEPSEEK_API_KEY esta no .env (raiz). Sem a chave,
       * a rota nao e registrada e o front devolve erro acionavel pedindo
       * a chave + restart - em vez de um fetch morto.
       *
       * Em producao este proxy NAO existe: la o back-end e o worker
       * (server/worker.js) com o secret DEEPSEEK_API_KEY.
       */
      proxy: deepseekKey
        ? {
            '/deepseek-api': {
              target: 'https://api.deepseek.com',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/deepseek-api/, ''),
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  // Sobrescreve qualquer Authorization vindo do cliente: a
                  // unica chave valida mora no servidor.
                  proxyReq.setHeader('Authorization', `Bearer ${deepseekKey}`)
                })
              },
            },
          }
        : undefined,
    },
    preview: {
      port: 4184,
    },
  }
})
