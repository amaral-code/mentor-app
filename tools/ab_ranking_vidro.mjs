/**
 * A/B honesto da lista do ranking, agora que o desfoque funciona de fato.
 *
 * As medicoes anteriores foram feitas com o backdrop-filter quebrado pelo
 * build, entao comparavam "sem blur" com "sem blur" e o que sobrou foi
 * ruido. Este script refaz a comparacao no build corrigido:
 *
 *   A) lista com .glass-plano  (como esta: sem filtro)
 *   B) lista com o filtro de volta (equivalente a .glass)
 *
 * Metodologia contra o ruido da maquina:
 *  - 5 repeticoes por variante, alternando A/B/A/B em vez de rodar todas
 *    de A e depois todas de B, para que aquecimento e concorrencia caiam
 *    igualmente nos dois lados;
 *  - reporta mediana E amostras, para o leitor julgar a dispersao;
 *  - reporta tarefas longas, que nao dependem do compositor e por isso sao
 *    confiaveis em headless, ao contrario do fps.
 *
 * Uso: node tools/ab_ranking_vidro.mjs http://localhost:4184 [taxa]
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:4184';
const TAXA = Number(process.argv[3] || 4);
const REPS = 5;

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'ab@exemplo-descartavel.com';
const SENHA = 'Ab!2026abcdef';

const api = (m, p, b, tok) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: 'Bearer ' + (tok || SVC), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ s: r.status, t: await r.text() }));

/*
 * A lista voltou a usar .glass (com desfoque), entao a variante de teste e
 * a que TIRA o filtro so dela. `:has()` alcança exatamente o painel que
 * contem as linhas do ranking, sem afetar os cards de estatistica nem as
 * barras fixas, que sao superficies diferentes.
 */
const SEM_FILTRO_NA_LISTA = `
  .glass:has(.linha-ranking) {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }`;

let uid = null;
const nav = await chromium.launch({
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--use-gl=swiftshader'],
});

try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Ab' },
  });
  uid = r.s < 300 ? JSON.parse(r.t).id : null;
  if (uid) {
    const tk = JSON.parse(
      (await api('POST', '/auth/v1/token?grant_type=password', { email: EMAIL, password: SENHA })).t,
    ).access_token;
    for (let i = 0; i < 6; i++) {
      await api('POST', '/rest/v1/rpc/registrar_xp', { p_tipo: 'q', p_descricao: `t${i}`, p_xp: 90 }, tk);
    }
  }

  const ctx = await nav.newContext({ viewport: { width: 375, height: 812 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);

  await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Aluno/ }).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible', { timeout: 30000 });
  await page.waitForTimeout(2500);

  let aba = page.locator('[data-tab="ranking"]:visible').first();
  if (!(await aba.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Mais$/ }).first().click();
    await page.waitForTimeout(700);
    aba = page.locator('[data-tab="ranking"]:visible').first();
  }
  await aba.click();
  await page.waitForTimeout(2200);

  // Confirma que a pagina esta no estado esperado antes de medir qualquer
  // coisa: medir a tela errada e o jeito mais facil de produzir um numero
  // bonito e sem valor.
  const conferencia = await page.evaluate(() => ({
    linhas: document.querySelectorAll('.linha-ranking').length,
    filtroNaLista: getComputedStyle(
      document.querySelector('.linha-ranking')?.closest('.glass') || document.body,
    ).getPropertyValue('backdrop-filter'),
  }));
  console.log(`\n  conferencia: ${conferencia.linhas} linhas, filtro na lista = ${conferencia.filtroNaLista}`);
  if (conferencia.linhas === 0) throw new Error('ranking nao renderizou; medicao abortada');

  const medir = (ms) =>
    page.evaluate(
      (dur) =>
        new Promise((res) => {
          const longas = [];
          const obs = new PerformanceObserver((l) => {
            for (const e of l.getEntries()) longas.push(Math.round(e.duration));
          });
          try { obs.observe({ entryTypes: ['longtask'] }); } catch { /* nao suportado */ }
          let q = 0;
          const t0 = performance.now();
          const passo = (agora) => {
            q++;
            if (agora - t0 < dur) requestAnimationFrame(passo);
            else {
              obs.disconnect();
              res({
                fps: +(q / ((agora - t0) / 1000)).toFixed(1),
                pior: longas.length ? Math.max(...longas) : 0,
                bloqueio: longas.reduce((a, b) => a + b, 0),
              });
            }
          };
          requestAnimationFrame(passo);
        }),
      ms,
    );

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: TAXA });
  await page.waitForTimeout(500);

  const dados = { 'A como esta (com desfoque)': [], 'B sem desfoque so na lista': [] };

  for (let rep = 0; rep < REPS; rep++) {
    for (const nome of Object.keys(dados)) {
      await page.evaluate(() => document.getElementById('ab')?.remove());
      if (nome.startsWith('B')) {
        await page.evaluate((css) => {
          const s = document.createElement('style');
          s.id = 'ab';
          s.textContent = css;
          document.head.appendChild(s);
        }, SEM_FILTRO_NA_LISTA);
      }
      // Confirma que a variante REALMENTE mudou o estilo antes de medir:
      // um seletor que nao casa produziria dois lados identicos e a
      // conclusao "nao faz diferenca" seria um artefato do teste.
      const aplicado = await page.evaluate(() => {
        const el = document.querySelector('.linha-ranking')?.closest('.glass');
        return el ? getComputedStyle(el).getPropertyValue('backdrop-filter') : '(painel nao encontrado)';
      });
      if (rep === 0) console.log(`  ${nome}: filtro medido no painel = ${aplicado}`);
      await page.waitForTimeout(450);

      const p = medir(1200);
      await page.mouse.move(187, 500);
      for (let k = 0; k < 6; k++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(80);
      }
      await page.mouse.wheel(0, -720);
      dados[nome].push(await p);
      await page.waitForTimeout(300);
    }
  }

  const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(`\n=== ranking, throttling ${TAXA}x, ${REPS} repeticoes alternadas ===\n`);
  for (const [nome, amostras] of Object.entries(dados)) {
    const fps = amostras.map((a) => a.fps);
    const pior = amostras.map((a) => a.pior);
    console.log(`  ${nome}`);
    console.log(`     fps mediana ${String(mediana(fps)).padStart(6)}   amostras: ${fps.join(', ')}`);
    console.log(`     pior tarefa ${String(mediana(pior)).padStart(6)} ms amostras: ${pior.join(', ')}\n`);
  }

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
