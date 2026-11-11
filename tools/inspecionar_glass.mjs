/**
 * O que a tela do ranking realmente tem de vidro e de filtro.
 *
 * O mapeamento anterior devolveu zero elementos com backdrop-filter, o que
 * contradiz o experimento que "mostrou" ganho ao remove-lo. Um dos dois
 * esta errado, e este script existe para dizer qual: lista quem tem classe
 * glass, o que o navegador computou para cada um, e se ha regra aplicada.
 *
 * Uso: node tools/inspecionar_glass.mjs http://localhost:4184
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:4184';
const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'insp@exemplo-descartavel.com';
const SENHA = 'Insp!2026abcd';

const api = (m, p, b, tok) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: 'Bearer ' + (tok || SVC), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ s: r.status, t: await r.text() }));

let uid = null;
const nav = await chromium.launch({ args: ['--use-gl=swiftshader'] });

try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Insp' },
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

  const info = await page.evaluate(() => {
    const comClasse = [...document.querySelectorAll('[class*="glass"]')].map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        classe: (el.className || '').toString().slice(0, 60),
        bf: cs.backdropFilter,
        wbf: cs.webkitBackdropFilter,
        bg: cs.backgroundColor,
        tam: `${Math.round(r.width)}x${Math.round(r.height)}`,
      };
    });

    // A regra .glass chegou na folha de estilo publicada?
    let regra = null;
    for (const folha of document.styleSheets) {
      try {
        for (const r2 of folha.cssRules) {
          if (r2.selectorText === '.glass') regra = r2.cssText.slice(0, 200);
        }
      } catch { /* folha de outra origem */ }
    }

    return {
      comClasse,
      regra,
      totalElementos: document.querySelectorAll('*').length,
      linhas: document.querySelectorAll('.linha-ranking').length,
    };
  });

  console.log('\n=== regra .glass publicada ===');
  console.log(info.regra || '  NAO ENCONTRADA na folha de estilo');
  console.log(`\n=== elementos com "glass" no class (${info.comClasse.length}) ===`);
  for (const e of info.comClasse.slice(0, 12)) {
    console.log(`  ${e.tam.padStart(9)}  bf=${String(e.bf).padEnd(26)} ${e.classe}`);
  }
  console.log(`\n  elementos no DOM: ${info.totalElementos}   linhas de ranking: ${info.linhas}`);

  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
