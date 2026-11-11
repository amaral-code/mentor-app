/**
 * Perfil de CPU da troca para a aba ranking.
 *
 * Medir fps diz QUE trava; nao diz ONDE. Este script liga o
 * Profiler do CDP (o mesmo do painel Performance), executa a troca de
 * aba sob throttling e agrega o tempo por funcao, para a otimizacao
 * atacar a linha certa em vez de um palpite.
 *
 * Uso: node tools/perfil_ranking.mjs http://localhost:4184 [taxa]
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:4184';
const TAXA = Number(process.argv[3] || 4);

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'perfil@exemplo-descartavel.com';
const SENHA = 'Perfil!2026abcd';

const api = (m, p, b, tok) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: 'Bearer ' + (tok || SVC), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ s: r.status, t: await r.text() }));

/**
 * Soma o tempo por funcao a partir do perfil amostrado.
 *
 * O CDP devolve amostras (qual no da arvore estava no topo da pilha) e
 * os intervalos entre elas. Somando o intervalo de cada amostra por no,
 * chega-se ao tempo PROPRIO de cada funcao, que e o que interessa: o
 * tempo total de uma funcao pai so aponta para o pai, nao para o custo.
 */
function agregar(perfil) {
  const porNo = new Map();
  for (const n of perfil.nodes) porNo.set(n.id, n);

  const proprio = new Map();
  const deltas = perfil.timeDeltas || [];
  perfil.samples.forEach((id, i) => {
    proprio.set(id, (proprio.get(id) || 0) + (deltas[i] || 0));
  });

  const linhas = [];
  for (const [id, us] of proprio) {
    const n = porNo.get(id);
    if (!n) continue;
    const cf = n.callFrame;
    const arq = (cf.url || '').split('/').pop() || '(interno)';
    const nome = cf.functionName || '(anonima)';
    linhas.push({ chave: `${nome} @ ${arq}:${cf.lineNumber + 1}`, ms: us / 1000 });
  }

  const juntas = new Map();
  for (const l of linhas) juntas.set(l.chave, (juntas.get(l.chave) || 0) + l.ms);

  return [...juntas.entries()]
    .map(([chave, ms]) => ({ chave, ms: +ms.toFixed(1) }))
    .sort((a, b) => b.ms - a.ms);
}

let uid = null;
const nav = await chromium.launch({
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--use-gl=swiftshader'],
});

try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Perfil' },
  });
  uid = r.s < 300 ? JSON.parse(r.t).id : null;
  if (uid) {
    const tk = JSON.parse(
      (await api('POST', '/auth/v1/token?grant_type=password', { email: EMAIL, password: SENHA })).t,
    ).access_token;
    for (let i = 0; i < 6; i++) {
      await api('POST', '/rest/v1/rpc/registrar_xp', { p_tipo: 'quiz', p_descricao: `treino ${i}`, p_xp: 90 }, tk);
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

  // aquece: primeira visita baixa o chunk, custo unico que nao e engasgo
  await irPara('ranking');
  await page.waitForTimeout(1500);
  await irPara('dashboard');
  await page.waitForTimeout(1200);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: TAXA });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');

  await irPara('ranking');
  await page.waitForTimeout(2000);

  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const top = agregar(profile);
  const total = top.reduce((a, b) => a + b.ms, 0);
  console.log(`\n=== tempo de CPU na troca para ranking (throttling ${TAXA}x) ===`);
  console.log(`total amostrado: ${total.toFixed(0)} ms\n`);
  for (const l of top.slice(0, 22)) {
    const pct = ((l.ms / total) * 100).toFixed(1).padStart(5);
    console.log(`  ${String(l.ms).padStart(8)} ms  ${pct}%  ${l.chave}`);
  }

  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
