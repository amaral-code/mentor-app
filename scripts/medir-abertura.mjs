#!/usr/bin/env node
/**
 * Tempo de abertura num "Android de entrada" simulado (issue #67).
 *
 * Abre o build de produção num Chromium com a CPU 4x mais lenta e rede
 * 4G ruim (1,6 Mbit/s, 150 ms de latência), que é o perfil que o
 * Lighthouse usa para celular, e mede até a tela de login estar pronta
 * para o toque. Primeira visita (sem cache) e segunda (com o service
 * worker), porque o aluno real vive quase sempre na segunda.
 *
 * Simulação não é aparelho: o número serve para comparar um build com
 * outro. O critério do issue (< 3 s) se confere num celular de verdade,
 * com o Chrome remoto (chrome://inspect), antes do lançamento.
 *
 * Uso:
 *   npm run build && npm run preview &      (porta 4184)
 *   node scripts/medir-abertura.mjs [url] [--vezes 3]
 * Navegador fora do padrão: E2E_CHROMIUM=/caminho/do/chrome
 */
import { chromium } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:4184/';
const iVezes = process.argv.indexOf('--vezes');
const vezes = iVezes > 0 ? Number(process.argv[iVezes + 1]) || 3 : 3;

const REDE_4G_RUIM = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

async function medirUma(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 360, height: 760 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
  });
  const pagina = await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', REDE_4G_RUIM);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const resultado = {};
  for (const visita of ['primeira', 'segunda']) {
    const inicio = Date.now();
    await pagina.goto(url, { waitUntil: 'commit' });
    await pagina.getByRole('button', { name: /^Entrar/ }).first().waitFor({ state: 'visible', timeout: 60_000 });
    const pronta = Date.now() - inicio;
    const fcp = await pagina.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null);
    resultado[visita] = { prontaMs: pronta, fcpMs: fcp && Math.round(fcp) };
    if (visita === 'primeira') {
      // Dá tempo ao service worker de instalar e guardar o app.
      await pagina.evaluate(() => navigator.serviceWorker?.ready);
      await pagina.waitForTimeout(1500);
    }
  }
  await contexto.close();
  return resultado;
}

const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
const medidas = [];
for (let i = 0; i < vezes; i++) medidas.push(await medirUma(navegador));
await navegador.close();

const mediana = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const visita of ['primeira', 'segunda']) {
  const pronta = mediana(medidas.map((m) => m[visita].prontaMs));
  const fcp = mediana(medidas.map((m) => m[visita].fcpMs ?? 0));
  console.log(`${visita} visita: login pronto em ${(pronta / 1000).toFixed(2)} s · primeira pintura ${(fcp / 1000).toFixed(2)} s (mediana de ${vezes})`);
}
