/**
 * Quanto o backdrop-filter da lista muda a APARENCIA?
 *
 * Antes de trocar performance por identidade visual, vale medir o que se
 * perde. O script fotografa a mesma tela com e sem o filtro e compara
 * pixel a pixel, separando a area da lista do resto da pagina.
 *
 * Se a diferenca for imperceptivel, remover o filtro dali e ganho puro.
 * Se for visivel, o preco e alto demais e a otimizacao precisa ser outra.
 *
 * Uso: node tools/diff_visual_blur.mjs http://localhost:4184
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

const URL_APP = process.argv[2] || 'http://localhost:4184';

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'diff@exemplo-descartavel.com';
const SENHA = 'Diff!2026abcd';

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
    email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { nome: 'Diff' },
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

  /*
   * CONGELA as particulas, sem esconde-las.
   *
   * Escondia-las invalidaria o teste: o blur so tem o que borrar quando ha
   * textura atras do painel, e as particulas sao justamente essa textura.
   * Com o canvas oculto, os dois lados ficariam iguais por construcao.
   *
   * Entao o conteudo atual do canvas vira uma imagem estatica no mesmo
   * lugar: as particulas continuam visiveis e identicas nas duas fotos, e
   * a unica variavel passa a ser o filtro.
   */
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return;
    const congelada = c.toDataURL();
    const img = document.createElement('img');
    img.src = congelada;
    img.id = 'particulas-congeladas';
    const r = c.getBoundingClientRect();
    Object.assign(img.style, {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      zIndex: getComputedStyle(c).zIndex,
      pointerEvents: 'none',
    });
    c.parentElement.insertBefore(img, c);
    c.style.display = 'none';
  });
  await page.waitForTimeout(600);

  /*
   * Pausa animacoes CSS nas DUAS fotos. O mascote flutuante e o cronometro
   * se moviam entre as capturas e apareciam no diff como se fossem efeito
   * do filtro, que e exatamente a confusao que este teste precisa evitar.
   */
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'congela-animacoes';
    s.textContent = '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }';
    document.head.appendChild(s);
  });
  await page.waitForTimeout(400);

  const comFiltro = await page.screenshot();
  writeFileSync('tools/capturas/blur-com.png', comFiltro);

  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'sem-blur';
    s.textContent =
      '.glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
    document.head.appendChild(s);
  });
  await page.waitForTimeout(500);
  const semFiltro = await page.screenshot();
  writeFileSync('tools/capturas/blur-sem.png', semFiltro);

  const A = PNG.sync.read(readFileSync('tools/capturas/blur-com.png'));
  const B = PNG.sync.read(readFileSync('tools/capturas/blur-sem.png'));

  let diferentes = 0;
  let somaDelta = 0;
  let maiorDelta = 0;
  const total = A.width * A.height;
  const mapa = new PNG({ width: A.width, height: A.height });

  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const d =
      Math.abs(A.data[o] - B.data[o]) +
      Math.abs(A.data[o + 1] - B.data[o + 1]) +
      Math.abs(A.data[o + 2] - B.data[o + 2]);
    somaDelta += d;
    if (d > maiorDelta) maiorDelta = d;
    // 3 niveis de 765 possiveis: abaixo disso nenhum olho distingue
    if (d > 3) diferentes++;
    mapa.data[o] = d > 3 ? 255 : 0;
    mapa.data[o + 1] = d > 3 ? 0 : 0;
    mapa.data[o + 2] = 0;
    mapa.data[o + 3] = 255;
  }
  writeFileSync('tools/capturas/blur-diff.png', PNG.sync.write(mapa));

  console.log('\n=== diferenca visual: com filtro x sem filtro ===');
  console.log(`  pixels alterados acima do limiar : ${diferentes} de ${total} (${((diferentes / total) * 100).toFixed(2)}%)`);
  console.log(`  delta medio por pixel (0-765)    : ${(somaDelta / total).toFixed(2)}`);
  console.log(`  maior delta em um unico pixel    : ${maiorDelta}`);
  console.log('\n  capturas: tools/capturas/blur-{com,sem,diff}.png');

  await ctx.close();
} finally {
  await nav.close();
  if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`);
}
