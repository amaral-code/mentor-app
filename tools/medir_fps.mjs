/**
 * Mede fps sob CPU throttling, como o brief da Fase 2 exige.
 *
 * O throttling vem do CDP (Emulation.setCPUThrottlingRate), o mesmo
 * mecanismo do painel Performance do DevTools. A contagem de quadros usa
 * requestAnimationFrame dentro da propria pagina: e o numero que o usuario
 * sente, nao uma estimativa do lado de fora.
 *
 * Uso: node tools/medir_fps.mjs http://localhost:5180 [taxa]
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:5180';
const TAXA = Number(process.argv[3] || 4);
const META_FPS = 50;

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'fps@exemplo-descartavel.com';
const SENHA = 'Fps!2026abcd';

const api = (m, p, b, tok) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: 'Bearer ' + (tok || SVC), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ s: r.status, t: await r.text() }));

/**
 * Tarefas longas na main thread durante `ms`.
 *
 * Quadro perdido e sintoma; tarefa longa e a causa. Esta metrica nao
 * depende de compositor, entao e confiavel em headless: qualquer bloco
 * acima de 50ms trava a interface independentemente do fps relatado.
 */
async function medirBloqueio(page, ms) {
  return page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        const longas = [];
        const obs = new PerformanceObserver((lista) => {
          for (const e of lista.getEntries()) longas.push(Math.round(e.duration));
        });
        try { obs.observe({ entryTypes: ['longtask'] }); } catch { /* nao suportado */ }
        setTimeout(() => {
          obs.disconnect();
          const total = longas.reduce((a, b) => a + b, 0);
          resolve({ qtdLongas: longas.length, piorMs: longas.length ? Math.max(...longas) : 0, bloqueioMs: total });
        }, dur);
      }),
    ms,
  );
}

/** Conta quadros reais durante `ms`, retornando fps e o pior intervalo. */
async function medir(page, ms) {
  return page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        let quadros = 0;
        let pior = 0;
        let anterior = performance.now();
        const inicio = anterior;
        function passo(agora) {
          const delta = agora - anterior;
          if (quadros > 0 && delta > pior) pior = delta;
          anterior = agora;
          quadros++;
          if (agora - inicio < dur) requestAnimationFrame(passo);
          else {
            const seg = (agora - inicio) / 1000;
            resolve({ fps: +(quadros / seg).toFixed(1), piorQuadroMs: +pior.toFixed(1) });
          }
        }
        requestAnimationFrame(passo);
      }),
    ms,
  );
}

let uid = null;
/*
 * Em headless o requestAnimationFrame nao acompanha o vsync: sem
 * compositor real, a taxa medida vira artefato do ambiente e nao do
 * aplicativo. Estas flags ligam o compositor por software e soltam o
 * limitador de quadros, que e o que o painel Performance do DevTools faz.
 */
/*
 * O 4o argumento escolhe o renderizador.
 *
 * `swiftshader` rasteriza na CPU. Isso torna a pintura MUITO mais cara do
 * que num aparelho real e, somado ao throttling, castiga duas vezes a
 * mesma tela. Com `gpu` o navegador abre com aceleracao de verdade, que e
 * o que o aluno tem. Comparar os dois separa defeito do aplicativo de
 * artefato do ambiente de medicao.
 */
const MODO = process.argv[4] || 'swiftshader';
const nav = await chromium.launch({
  headless: MODO !== 'gpu',
  args:
    MODO === 'gpu'
      ? ['--disable-gpu-vsync', '--disable-frame-rate-limit']
      : ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--use-gl=swiftshader', '--enable-gpu-rasterization'],
});
console.log(`renderizador: ${MODO === 'gpu' ? 'GPU real (janela visivel)' : 'swiftshader (CPU)'}`);
const resultados = [];

try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Fps' },
  });
  uid = r.s < 300 ? JSON.parse(r.t).id : null;

  // Dados para as telas nao ficarem vazias: lista vazia nao estressa nada.
  if (uid) {
    const tk = JSON.parse((await api('POST', '/auth/v1/token?grant_type=password', { email: EMAIL, password: SENHA })).t).access_token;
    for (const m of ['Matemática', 'História', 'Física']) {
      await api('POST', '/rest/v1/quiz_resultados', { user_id: uid, materia: m, acertos: 4, total: 5, xp_ganho: 40 }, tk);
    }
    for (let i = 0; i < 6; i++) {
      await api('POST', '/rest/v1/rpc/registrar_xp', { p_tipo: 'quiz', p_descricao: `treino ${i}`, p_xp: 90 }, tk);
    }
    for (let i = 0; i < 8; i++) {
      await api('POST', '/rest/v1/notas', { user_id: uid, texto: `Anotacao de teste numero ${i}`, tag: 'resumo' }, tk);
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

  // baseline sem throttling, para dar escala ao numero de baixo
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const base = await medir(page, 1200);
  console.log(`baseline (sem throttling): ${base.fps} fps`);

  console.log(`\n=== CPU throttling ${TAXA}x  (meta: >= ${META_FPS} fps) ===`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: TAXA });
  await page.waitForTimeout(600);

  /*
   * Duas passadas de proposito.
   *
   * A PRIMEIRA visita a uma aba inclui baixar e compilar o chunk lazy dela,
   * custo que acontece uma vez por sessao e nao e "engasgo de animacao".
   * A SEGUNDA passada mede a troca de aba pura: transicao, stagger e
   * render, que e o que o brief quer avaliar.
   */
  const abas = ['dashboard', 'quiz', 'ranking'];
  console.log('  (aquecendo: primeira visita carrega o chunk de cada aba)');
  for (const aba of abas) {
    let a = page.locator(`[data-tab="${aba}"]:visible`).first();
    if (!(await a.isVisible().catch(() => false))) {
      const mais = page.getByRole('button', { name: /^Mais$/ }).first();
      if (await mais.isVisible().catch(() => false)) { await mais.click(); await page.waitForTimeout(700); }
      a = page.locator(`[data-tab="${aba}"]:visible`).first();
    }
    await a.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1400);
  }
  console.log('');

  // Repouso: sem interacao nenhuma. Se houver bloqueio aqui, a causa nao e
  // a troca de aba, e algo rodando o tempo todo.
  const parado = await Promise.all([medir(page, 1600), medirBloqueio(page, 1600)]);
  console.log(
    `  ${'(parado)'.padEnd(10)} ${String(parado[0].fps).padStart(5)} fps  |  tarefas longas: ${String(parado[1].qtdLongas).padStart(2)}` +
      `  pior ${String(parado[1].piorMs).padStart(4)} ms  bloqueio total ${String(parado[1].bloqueioMs).padStart(4)} ms`,
  );

  /*
   * Tres repeticoes por tela, e reporto a MEDIANA.
   *
   * Medicoes isoladas variaram 3x na mesma build, porque a maquina divide
   * CPU com build, servidor e sistema. Uma amostra so nao distingue
   * problema do aplicativo de ruido do ambiente; a mediana descarta o
   * pico ocasional sem esconder um problema real.
   */
  const REPETICOES = 3;
  const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  for (const aba of abas) {
    const amostrasFps = [];
    const amostrasPior = [];
    for (let rep = 0; rep < REPETICOES; rep++) {
      // sai da aba e volta, para cada repeticao medir uma troca de verdade
      const outra = abas[(abas.indexOf(aba) + 1) % abas.length];
      let saida = page.locator(`[data-tab="${outra}"]:visible`).first();
      if (!(await saida.isVisible().catch(() => false))) {
        const mais = page.getByRole('button', { name: /^Mais$/ }).first();
        if (await mais.isVisible().catch(() => false)) { await mais.click(); await page.waitForTimeout(600); }
        saida = page.locator(`[data-tab="${outra}"]:visible`).first();
      }
      await saida.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(900);

      let a = page.locator(`[data-tab="${aba}"]:visible`).first();
      if (!(await a.isVisible().catch(() => false))) {
        const mais = page.getByRole('button', { name: /^Mais$/ }).first();
        if (await mais.isVisible().catch(() => false)) { await mais.click(); await page.waitForTimeout(600); }
        a = page.locator(`[data-tab="${aba}"]:visible`).first();
      }
      const mFps = medir(page, 1500);
      const mBlq = medirBloqueio(page, 1500);
      await a.click({ timeout: 8000 }).catch(() => {});
      const rf = await mFps;
      const rb = await mBlq;
      amostrasFps.push(rf.fps);
      amostrasPior.push(rb.piorMs);
      await page.waitForTimeout(500);
    }
    const fpsMed = mediana(amostrasFps);
    const piorMed = mediana(amostrasPior);
    const ok = fpsMed >= META_FPS;
    resultados.push({ aba, fps: fpsMed, piorMs: piorMed, ok });
    console.log(
      `  ${aba.padEnd(10)} mediana ${String(fpsMed).padStart(6)} fps  (amostras: ${amostrasFps.join(', ')})` +
        `   pior tarefa ${String(piorMed).padStart(4)} ms   ${ok ? 'ok' : 'ABAIXO'}`,
    );
  }

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
  const ruins = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - ruins.length}/${resultados.length} telas acima de ${META_FPS} fps`);
  if (ruins.length) console.log('abaixo da meta: ' + ruins.map((r) => r.aba).join(', '));
}
