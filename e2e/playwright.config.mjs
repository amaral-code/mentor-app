import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ponta a ponta do app web (issue #64).
 *
 * O app roda de verdade (build de produção no `vite preview`, com o
 * service worker e o back-end /api), mas o
 * Supabase e a IA são simulados por rota em `e2e/ambiente.mjs`: nenhum
 * banco real é tocado e nada depende de chave. O endereço do Supabase de
 * teste é um subdomínio `.supabase.co` porque a CSP do app só libera esse
 * domínio; toda chamada a ele é interceptada antes de sair do navegador.
 *
 * Rodar: npm run test:e2e (faz o build antes)
 * Navegador fora do padrão (ex.: imagem com Chromium já instalado):
 *   E2E_CHROMIUM=/caminho/do/chrome npm run test:e2e
 */
const PORTA = Number(process.env.E2E_PORTA || 4184);

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  /*
   * Build de produção servido pelo `vite preview` (porta 4184), com o
   * service worker e o /api, como o aluno usa. No `vite dev` o Vite
   * recarrega a página ao descobrir dependência nova, e isso derrubava
   * o teste offline no meio.
   */
  webServer: {
    command: 'npm run build && npm run preview',
    cwd: '..',
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SUPABASE_URL: 'https://e2e-simulado.supabase.co',
      SUPABASE_ANON_KEY: 'anon-e2e',
    },
  },
});
