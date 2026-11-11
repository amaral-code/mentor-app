/**
 * Experimento controlado: o backdrop-filter da lista e o gargalo do ranking?
 *
 * O perfil de CPU mostrou 85% do tempo em "(program)", ou seja, trabalho
 * interno de estilo/layout/paint, e nao JavaScript. A hipotese e que o
 * `.glass` que envolve as 49 linhas force o navegador a reborrar uma area
 * altissima a cada quadro.
 *
 * Em vez de reescrever e torcer, mede-se a MESMA pagina com e sem o
 * filtro, na mesma sessao, alternando a ordem para nao confundir o efeito
 * com o aquecimento da maquina.
 *
 * Uso: node tools/experimento_blur.mjs http://localhost:4184 [taxa]
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:4184';
const TAXA = Number(process.argv[3] || 4);

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'blur@exemplo-descartavel.com';
const SENHA = 'Blur!2026abcd';

const api = (m, p, b, tok) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: 'Bearer ' + (tok || SVC), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ s: r.status, t: await r.text() }));

async function medir(page, ms) {
  return page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        const longas = [];
        const obs = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) longas.push(Math.round(e.duration));
        });
        try { obs.observe({ entryTypes: ['longtask'] }); } catch { /* nao suportado */ }
        let quadros = 0;
        let anterior = performance.now();
        const inicio = anterior;
        function passo(agora) {
          anterior = agora;
          quadros++;
          if (agora - inicio < dur) requestAnimationFrame(passo);
          else {
            obs.disconnect();
            resolve({
              fps: +(quadros / ((agora - inicio) / 1000)).toFixed(1),
              piorMs: longas.length ? Math.max(...longas) : 0,
            });
          }
        }
        requestAnimationFrame(passo);
      }),
    ms,
  );
}

let uid = null;
const nav = await chromium.launch({
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--use-gl=swiftshader'],
});

try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Blur' },
  });
  uid = r.s < 300 ? JSON.parse(r.t).id : null;
  if (uid) {
    const tk = JSON.parse(
      (await api('POST', '/auth/v1/token?grant_type=password', { email: EMAIL, password: SENHA })).t,
    ).access_token;
    for (let i = 0; i < 6; i++) {
      await api('POST', '/rest/v1/rpc/registrar_xp', { p_tipo: 'quiz', p_descricao: `t${i}`, p_xp: 90 }, tk);
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

  const irPara = async (aba) => {
    let a = page.locator(`[data-tab="${aba}"]:visible`).first();
    if (!(await a.isVisible().catch(() => false))) {
      const mais = page.getByRole('button', { name: /^Mais$/ }).first();
      if (await mais.isVisible().catch(() => false)) { await mais.click(); await page.waitForTimeout(700); }
      a = page.locator(`[data-tab="${aba}"]:visible`).first();
    }
    await a.click({ timeout: 8000 }).catch(() => {});
  };

  await irPara('ranking');
  await page.waitForTimeout(1800);

  // Cada variante desliga um suspeito por vez, via folha de estilo injetada.
  const VARIANTES = {
    'atual (referencia)': '',
    'sem backdrop-filter na lista': `
      .glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
    'sem canvas de particulas': `
      canvas { display: none !important; }`,
    'sem transition-all nas linhas': `
      .linha-ranking * { transition: none !important; }`,
    'sem os dois (blur + canvas)': `
      .glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
      canvas { display: none !important; }`,
  };

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: TAXA });
  console.log(`\n=== ranking sob throttling ${TAXA}x, 3 repeticoes por variante (mediana) ===\n`);

  const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const nomes = Object.keys(VARIANTES);

  // Duas rodadas com a ordem invertida na segunda: se o efeito fosse so
  // aquecimento da maquina, ele seguiria a ordem e nao a variante.
  const acumulado = {};
  for (const n of nomes) acumulado[n] = { fps: [], pior: [] };

  for (const rodada of [nomes, [...nomes].reverse()]) {
    for (const nome of rodada) {
      await page.evaluate(() => {
        const antigo = document.getElementById('experimento');
        if (antigo) antigo.remove();
      });
      if (VARIANTES[nome]) {
        await page.evaluate((css) => {
          const s = document.createElement('style');
          s.id = 'experimento';
          s.textContent = css;
          document.head.appendChild(s);
        }, VARIANTES[nome]);
      }
      await page.waitForTimeout(500);

      for (let rep = 0; rep < 3; rep++) {
        // rola a lista: e onde o custo de repintura aparece de verdade
        const m = medir(page, 1200);
        await page.mouse.move(187, 500);
        for (let k = 0; k < 6; k++) {
          await page.mouse.wheel(0, 120);
          await page.waitForTimeout(80);
        }
        await page.mouse.wheel(0, -720);
        const res = await m;
        acumulado[nome].fps.push(res.fps);
        acumulado[nome].pior.push(res.piorMs);
      }
    }
  }

  const base = mediana(acumulado[nomes[0]].fps);
  for (const nome of nomes) {
    const f = mediana(acumulado[nome].fps);
    const p = mediana(acumulado[nome].pior);
    const delta = nome === nomes[0] ? '' : `  (${f > base ? '+' : ''}${(((f - base) / base) * 100).toFixed(0)}%)`;
    console.log(
      `  ${nome.padEnd(32)} ${String(f).padStart(6)} fps   pior tarefa ${String(p).padStart(4)} ms${delta}`,
    );
  }

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
