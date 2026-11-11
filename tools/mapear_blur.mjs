/**
 * Quais elementos ainda aplicam backdrop-filter na tela do ranking, e que
 * area cada um cobre.
 *
 * Remover o filtro so da lista nao resolveu, entao o custo esta em outro
 * lugar. Em vez de tentar classe por classe, este script pergunta ao
 * navegador quem borra o que, com area e posicao, e depois mede o efeito
 * de desligar cada grupo isoladamente.
 *
 * Uso: node tools/mapear_blur.mjs http://localhost:4184 [taxa]
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:4184';
const TAXA = Number(process.argv[3] || 4);

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'mapa@exemplo-descartavel.com';
const SENHA = 'Mapa!2026abcd';

const api = (m, p, b, tok) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: 'Bearer ' + (tok || SVC), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ s: r.status, t: await r.text() }));

let uid = null;
const nav = await chromium.launch({
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--use-gl=swiftshader'],
});

try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Mapa' },
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

  let a = page.locator('[data-tab="ranking"]:visible').first();
  if (!(await a.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Mais$/ }).first().click();
    await page.waitForTimeout(700);
    a = page.locator('[data-tab="ranking"]:visible').first();
  }
  await a.click();
  await page.waitForTimeout(2200);

  const mapa = await page.evaluate(() => {
    const saida = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      if (!bf || bf === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      saida.push({
        tag: el.tagName.toLowerCase(),
        classe: (el.className || '').toString().split(/\s+/).slice(0, 3).join(' '),
        pos: cs.position,
        w: Math.round(r.width),
        h: Math.round(r.height),
        area: Math.round(r.width * r.height),
        filtro: bf,
      });
    }
    return saida.sort((x, y) => y.area - x.area);
  });

  console.log('\n=== elementos com backdrop-filter na tela do ranking ===');
  console.log(`total: ${mapa.length} elementos, area somada ${mapa.reduce((s, e) => s + e.area, 0).toLocaleString()} px2`);
  console.log(`(viewport = ${375 * 812} px2)\n`);
  for (const e of mapa.slice(0, 14)) {
    console.log(
      `  ${String(e.area).padStart(8)} px2  ${String(e.w + 'x' + e.h).padStart(9)}  ${e.pos.padEnd(8)} ${e.tag}.${e.classe}`,
    );
  }

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: TAXA });
  await page.waitForTimeout(400);

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
              res({ fps: +(q / ((agora - t0) / 1000)).toFixed(1), pior: longas.length ? Math.max(...longas) : 0 });
            }
          };
          requestAnimationFrame(passo);
        }),
      ms,
    );

  const VARIANTES = {
    'como esta agora': '',
    'sem blur nas barras fixas': `
      header, nav, [class*="fixed"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
    'sem blur nos cards de estatistica': `
      .grid .glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
    'sem blur em nenhum lugar': `
      * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
  };

  console.log(`\n=== efeito de cada grupo, throttling ${TAXA}x, 3 repeticoes (mediana) ===\n`);
  const mediana = (xs) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];

  for (const [nome, css] of Object.entries(VARIANTES)) {
    await page.evaluate(() => document.getElementById('exp')?.remove());
    if (css) {
      await page.evaluate((c) => {
        const s = document.createElement('style');
        s.id = 'exp';
        s.textContent = c;
        document.head.appendChild(s);
      }, css);
    }
    await page.waitForTimeout(500);

    const fps = [];
    const piores = [];
    for (let i = 0; i < 3; i++) {
      const p = medir(1200);
      await page.mouse.move(187, 500);
      for (let k = 0; k < 6; k++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(80);
      }
      await page.mouse.wheel(0, -720);
      const res = await p;
      fps.push(res.fps);
      piores.push(res.pior);
    }
    console.log(`  ${nome.padEnd(36)} ${String(mediana(fps)).padStart(6)} fps   pior ${String(mediana(piores)).padStart(4)} ms`);
  }

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
