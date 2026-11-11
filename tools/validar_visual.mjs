/**
 * Validação visual automatizada.
 *
 * Abre o app num Chromium de verdade, faz login, percorre as telas nas
 * três larguras do brief e captura tudo. Também mede o que dá para medir
 * sem olho humano:
 *
 *   - overflow horizontal (o corpo da página nunca deve rolar de lado)
 *   - alvos de toque menores que 44px no mobile
 *   - contagem de erros no console
 *
 * Uso: node tools/validar_visual.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_APP = process.argv[2] || 'http://localhost:5178';
const SAIDA = 'tools/capturas';

const SUPA = 'https://bxidxlcismcvryznpomh.supabase.co';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? '';

const EMAIL = 'validacao-visual@exemplo-descartavel.com';
const SENHA = 'ValidaVisual!2026';

const LARGURAS = [
  { nome: 'mobile', w: 375, h: 812 },
  { nome: 'tablet', w: 768, h: 1024 },
  { nome: 'desktop', w: 1280, h: 900 },
];

const TELAS = ['dashboard', 'chat', 'quiz', 'foco', 'ranking', 'store', 'notebook', 'profile'];

const achados = [];
function anota(nivel, msg) {
  achados.push({ nivel, msg });
  console.log(`  [${nivel}] ${msg}`);
}

async function api(metodo, caminho, corpo) {
  const r = await fetch(SUPA + caminho, {
    method: metodo,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, texto: await r.text() };
}

/** Mede o que não depende de olho humano. */
async function medir(page, rotulo, largura) {
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    // O alvo efetivo nem sempre e o proprio elemento:
    //   - input dentro de <label> -> tocar no rotulo ja aciona
    //   - link inline dentro de frase -> convencao de texto, nao de botao
    // Medir sem isso produz falso positivo e esconde os casos que importam.
    const alvos = [...document.querySelectorAll('button, a[href], input, select, [role="button"]')]
      .map((el) => {
        const rotulo = el.closest('label');
        const alvoReal = rotulo && (el.tagName === 'INPUT' || el.tagName === 'SELECT') ? rotulo : el;
        const inline = getComputedStyle(el).display === 'inline' || el.closest('p');
        const r = alvoReal.getBoundingClientRect();
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          inline: !!inline,
          txt: (el.textContent || '').trim().slice(0, 24),
        };
      })
      .filter((t) => t.w > 0 && t.h > 0 && !t.inline && (t.w < 44 || t.h < 44));
    return {
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      pequenos: alvos.slice(0, 6),
      totalPequenos: alvos.length,
    };
  });

  if (m.scrollW > m.clientW + 1) {
    anota('OVERFLOW', `${rotulo} @${largura}px: página rola de lado (${m.scrollW} > ${m.clientW})`);
  }
  if (largura <= 400 && m.totalPequenos > 0) {
    anota(
      'TOQUE',
      `${rotulo} @${largura}px: ${m.totalPequenos} alvo(s) abaixo de 44px, ex.: ` +
        m.pequenos.map((t) => `${t.w}x${t.h}"${t.txt}"`).join(', '),
    );
  }
  return m;
}

let uid = null;
const navegador = await chromium.launch();

try {
  // --- usuário de teste --------------------------------------------
  console.log('SETUP');
  let r = await api('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
    user_metadata: { nome: 'Validacao Visual' },
  });
  if (r.status === 200 || r.status === 201) {
    uid = JSON.parse(r.texto).id;
    console.log(`  usuario criado ${uid.slice(0, 8)}...`);
  } else {
    // já existe de uma rodada anterior
    const lista = await api('GET', `/auth/v1/admin/users?per_page=200`);
    const achado = JSON.parse(lista.texto).users?.find((u) => u.email === EMAIL);
    uid = achado?.id ?? null;
    console.log(`  reaproveitando usuario ${uid ? uid.slice(0, 8) + '...' : 'NAO ACHADO'}`);
  }

  // dá XP para as telas não ficarem todas vazias
  mkdirSync(SAIDA, { recursive: true });

  for (const { nome, w, h } of LARGURAS) {
    console.log(`\n=== ${nome} ${w}x${h} ===`);
    const ctx = await navegador.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      locale: 'pt-BR',
    });
    const page = await ctx.newPage();

    const errosConsole = [];
    page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errosConsole.push('PAGEERROR ' + String(e).slice(0, 160)));

    await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#root > *', { timeout: 20000 }).catch(() => {});

    // ---- tela de escolha de perfil ----
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SAIDA}/${nome}-01-perfil.png` });
    await medir(page, 'escolha de perfil', w);

    // ---- login ----
    await page.getByRole('button', { name: /Aluno/ }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SAIDA}/${nome}-02-login.png` });
    await medir(page, 'login', w);

    await page.locator('#campo-email').fill(EMAIL);
    await page.locator('#campo-senha').fill(SENHA);
    await page.getByRole('button', { name: /^Entrar$/ }).click();

    // espera o app entrar (a bottom nav ou a sidebar aparecem)
    let entrou = true;
    await page.waitForSelector('[data-tab="dashboard"]:visible', { timeout: 30000 }).catch(() => { entrou = false; });
    if (!entrou) {
      await page.screenshot({ path: `${SAIDA}/${nome}-FALHA-login.png` });
      const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200));
      anota('FALHA', `${nome}: nao entrou no app. Tela: "${txt}"`);
    }
    await page.waitForTimeout(1600);

    // fecha o tour, se aparecer
    const pular = page.getByRole('button', { name: /Pular|Fechar|Depois/i }).first();
    if (await pular.isVisible().catch(() => false)) {
      await pular.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // ---- percorre as telas ----
    // No mobile as abas secundarias vivem dentro do bottom sheet, entao a
    // navegacao tem dois caminhos. O sheet fecha sozinho ao escolher.
    const sheetAberto = async () =>
      await page.locator('[role="dialog"][aria-label="Mais seções"]').isVisible().catch(() => false);

    for (const aba of TELAS) {
      let alvo = page.locator(`[data-tab="${aba}"]:visible`).first();
      let visivel = await alvo.isVisible().catch(() => false);

      if (!visivel && !(await sheetAberto())) {
        const mais = page.getByRole('button', { name: /^Mais$/ }).first();
        if (await mais.isVisible().catch(() => false)) {
          await mais.click();
          await page.waitForTimeout(600);
        }
      }

      alvo = page.locator(`[data-tab="${aba}"]:visible`).first();
      visivel = await alvo.isVisible().catch(() => false);
      if (!visivel) {
        anota('AVISO', `${nome}: aba "${aba}" nao alcancavel`);
        continue;
      }

      await alvo.click({ timeout: 8000 }).catch(async () => {
        anota('AVISO', `${nome}: clique em "${aba}" bloqueado`);
      });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${SAIDA}/${nome}-${aba}.png` });
      await medir(page, aba, w);
    }

    if (errosConsole.length) {
      const unicos = [...new Set(errosConsole)];
      unicos.forEach((e) => anota('CONSOLE', `${nome}: ${e}`));
    }

    await ctx.close();
  }

  // --- prefers-reduced-motion --------------------------------------
  console.log('\n=== movimento reduzido ===');
  const ctx = await navegador.newContext({ viewport: { width: 375, height: 812 }, locale: 'pt-BR' });
  await ctx.route('**/*', (r) => r.continue());
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Aluno/ }).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SAIDA}/reduced-motion.png` });

  // O projeto neutraliza movimento por duracao (0.01ms), nao removendo o
  // animation-name. Checar so o nome dava falso positivo.
  const animando = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      if (s.animationName === 'none') return false;
      const seg = parseFloat(s.animationDuration) || 0;
      return seg > 0.05; // acima disso o movimento e perceptivel
    }).length,
  );
  if (animando > 0) anota('MOVIMENTO', `com reduced-motion ainda ha ${animando} elemento(s) animando`);
  else console.log('  [ok] nenhuma animacao ativa com reduced-motion');
  await ctx.close();
} finally {
  await navegador.close();
  if (uid) {
    await api('DELETE', `/auth/v1/admin/users/${uid}`);
    console.log('\nusuario de teste removido');
  }
  writeFileSync(`${SAIDA}/achados.json`, JSON.stringify(achados, null, 2));
  console.log(`\n${achados.length} achado(s). Capturas em ${SAIDA}/`);
}
