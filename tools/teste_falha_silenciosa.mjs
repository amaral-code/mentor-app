/**
 * Quando a gravacao no banco falha, o aluno fica sabendo?
 *
 * O codigo tem 22 pontos com `.catch(() => {})`. Se isso significar que
 * uma anotacao apagada, uma sessao de foco concluida ou uma mensagem
 * enviada somem sem aviso, o aluno perde trabalho achando que salvou. Este
 * script derruba a rota do Supabase e opera a interface normalmente, para
 * ver o que aparece na tela.
 *
 * Uso: node tools/teste_falha_silenciosa.mjs http://localhost:4184
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:4184';
const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'falha@exemplo-descartavel.com';
const SENHA = 'Falha!2026abc';

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
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Falha' },
  });
  uid = r.s < 300 ? JSON.parse(r.t).id : null;
  if (uid) {
    const tk = JSON.parse(
      (await api('POST', '/auth/v1/token?grant_type=password', { email: EMAIL, password: SENHA })).t,
    ).access_token;
    // Uma anotacao para poder tentar apagar depois.
    await api('POST', '/rest/v1/notas', { user_id: uid, texto: 'Anotacao que sera apagada com a rede caida', tag: 'resumo' }, tk);
  }

  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Aluno/ }).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible', { timeout: 30000 });
  await page.waitForTimeout(2500);

  // A partir daqui, TODA escrita no banco falha.
  let bloqueadas = 0;
  await page.route('**/rest/v1/**', (rota) => {
    const m = rota.request().method();
    if (m === 'POST' || m === 'PATCH' || m === 'DELETE') {
      bloqueadas++;
      return rota.abort('failed');
    }
    return rota.continue();
  });
  console.log('\n  rede de ESCRITA derrubada a partir de agora\n');

  const irPara = async (aba) => {
    let a = page.locator(`[data-tab="${aba}"]:visible`).first();
    if (!(await a.isVisible().catch(() => false))) {
      const mais = page.getByRole('button', { name: /^Mais$/ }).first();
      if (await mais.isVisible().catch(() => false)) { await mais.click(); await page.waitForTimeout(700); }
      a = page.locator(`[data-tab="${aba}"]:visible`).first();
    }
    await a.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
  };

  /*
   * Le o TOAST, nao a pagina inteira.
   *
   * A primeira versao procurava palavras como "falh" em document.innerText
   * e acusava aviso ate no caso de controle, porque a palavra aparece em
   * texto estatico da interface. O toast e o canal real do aviso, entao e
   * ele que deve ser lido.
   */
  const lerToast = async () => {
    const t = await page.evaluate(() => {
      const el = document.querySelector('[role="status"], [role="alert"], .toast, [data-toast]');
      return el ? el.textContent.trim() : null;
    });
    return t;
  };
  const limparToast = () => page.evaluate(() => {
    const el = document.querySelector('[role="status"], [role="alert"], .toast, [data-toast]');
    if (el) el.remove();
  });

  // --- Caso 1: criar uma anotacao com a rede caida ---
  await irPara('notebook');
  await page.locator('textarea').first().fill('Anotacao escrita sem rede');
  await page.getByRole('button', { name: /Adicionar/ }).click();
  await page.waitForTimeout(2000);

  const toast = await lerToast();
  const aindaNaTela = await page.locator('text=Anotacao escrita sem rede').count();
  console.log(`  [caderno] escritas bloqueadas ate aqui : ${bloqueadas}`);
  console.log(`  [caderno] aviso mostrado ao aluno      : ${toast ? '"' + toast + '"' : 'NENHUM'}`);
  console.log(`  [caderno] anotacao removida da tela    : ${aindaNaTela === 0 ? 'SIM' : 'nao (a tela mentiria)'}`);
  await limparToast();

  // --- Caso 2: mesma acao com a rede de volta, para comparar ---
  await page.unroute('**/rest/v1/**');
  await page.waitForTimeout(500);
  await page.locator('textarea').first().fill('Anotacao com rede normal');
  await page.getByRole('button', { name: /Adicionar/ }).click();
  await page.waitForTimeout(2500);
  const toast2 = await lerToast();
  const salva = await page.locator('text=Anotacao com rede normal').count();
  console.log(`
  [controle] anotacao permanece na tela : ${salva > 0 ? 'SIM' : 'nao'}`);
  console.log(`  [controle] aviso de erro indevido    : ${toast2 ? '"' + toast2 + '"' : 'NENHUM (correto)'}`);

  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
