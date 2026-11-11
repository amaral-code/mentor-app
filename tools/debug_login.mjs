/** Depura o login: captura o estado exato depois do submit. */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:5178';
const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'debug-login@exemplo-descartavel.com';
const SENHA = 'DebugLogin!2026';

const api = (m, p, b) =>
  fetch(SUPA + p, {
    method: m,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ status: r.status, texto: await r.text() }));

let uid = null;
const nav = await chromium.launch();
try {
  const r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Debug' },
  });
  uid = r.status < 300 ? JSON.parse(r.texto).id : null;
  console.log('usuario:', uid?.slice(0, 8), 'status', r.status);

  const ctx = await nav.newContext({ viewport: { width: 375, height: 812 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  page.on('console', (m) => console.log(`  [console.${m.type()}] ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => console.log(`  [PAGEERROR] ${String(e).slice(0, 300)}`));
  page.on('requestfailed', (req) =>
    console.log(`  [REQ FALHOU] ${req.method()} ${req.url().slice(0, 110)} :: ${req.failure()?.errorText}`));
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('supabase.co') && res.status() >= 400) {
      console.log(`  [HTTP ${res.status()}] ${u.slice(0, 120)} :: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
  });

  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Aluno/ }).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  console.log('\n--- submetendo ---');
  await page.getByRole('button', { name: /^Entrar$/ }).click();

  for (const espera of [1000, 2000, 4000, 8000]) {
    await page.waitForTimeout(espera === 1000 ? 1000 : espera - 1000);
    const estado = await page.evaluate(() => ({
      temNav: !!document.querySelector('[data-tab="dashboard"]'),
      textoVisivel: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
    }));
    console.log(`  t=${espera}ms  nav=${estado.temNav}  texto="${estado.textoVisivel.slice(0, 140)}"`);
    if (estado.temNav) break;
  }

  await page.screenshot({ path: 'tools/capturas/debug-pos-login.png' });
  console.log('\ncaptura: tools/capturas/debug-pos-login.png');
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
