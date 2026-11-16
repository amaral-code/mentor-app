import { expect, test } from '@playwright/test';
import { abrirAba, entrar, fecharAvisos, prepararConta } from './ambiente.mjs';

test('login leva à Central com a ofensiva', async ({ page }) => {
  await prepararConta(page);
  await entrar(page);
  await expect(page.getByText(/Olá, Ana/)).toBeVisible();
  await expect(page.getByText(/de ofensiva/).first()).toBeAttached();
});

test('onboarding da conta nova termina na Central', async ({ page }) => {
  await prepararConta(page, { onboarding: false });
  await entrar(page);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: 'Passar no ENEM' }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: '30 min' }).click();
  await page.getByRole('button', { name: /Noite/ }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: /Prefiro não informar agora/ }).click();
  await page.getByRole('button', { name: /Começar minha jornada/ }).click();
  await expect(page.getByText(/Olá, Ana/)).toBeVisible();
});

test('quiz com IA: responde, vê a explicação e o resultado vai para a fila', async ({ page }) => {
  const { chamadas } = await prepararConta(page);
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'quiz');
  await page.getByText('Matemática', { exact: true }).first().click();
  await page.getByText('Funções', { exact: true }).first().click();
  await page.getByRole('button', { name: /Gerar Quiz/ }).click();
  await expect(page.getByText('Quanto vale f(2) se f(x) = 3x + 1?')).toBeVisible();
  await page.locator('main button').filter({ hasText: /^A/ }).first().click();
  await expect(page.getByText(/Mandou bem/)).toBeVisible();
  await expect(page.getByText('f(2) = 3 · 2 + 1 = 7.')).toBeVisible();
  await expect.poll(() => chamadas.some((c) => c.caminho === '/rest/v1/rpc/aplicar_operacao')).toBe(false);
  await page.getByRole('button', { name: /Próxima/i }).click();
  await page.locator('main button').filter({ hasText: /^A/ }).first().click();
  await page.getByRole('button', { name: /resultado|finalizar|concluir|próxima/i }).first().click();
  await expect.poll(() => chamadas.filter((c) => c.caminho === '/rest/v1/rpc/aplicar_operacao').map((c) => c.corpo.p_tipo)).toContain('quiz_resultado');
});

test('Mentor responde, e mensagem de risco recebe o CVV sem passar pela IA', async ({ page }) => {
  await prepararConta(page);
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'chat');
  const caixa = page.locator('textarea').first();
  await caixa.fill('O que é mitose?');
  await caixa.press('Control+Enter');
  await expect(page.getByText('Mitose gera duas células iguais à original.')).toBeVisible();
  await caixa.fill('não aguento mais, quero me matar');
  await caixa.press('Control+Enter');
  await expect(page.getByText(/CVV, no número 188/)).toBeVisible();
});

test('redação digitada é corrigida pelas 5 competências', async ({ page }) => {
  await prepararConta(page);
  await page.route('**/api/generate', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      notaFinal: 760, competencias: [160, 160, 140, 160, 140].map((nota, i) => ({ nome: `C${i + 1}`, nota, comentario: 'ok' })), pontosFortes: ['tese clara'], pontosMelhorar: ['repertório'], resumo: 'Boa base.',
    }) }] } }] }) }),
  );
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'essay');
  await page.locator('textarea').first().fill('A inclusão digital no Brasil enfrenta desafios históricos. '.repeat(30));
  await page.getByRole('button', { name: /Corrigir Redação/ }).click();
  // A nota do anel e a nota de cada competência (o anel conta de 0 até a nota).
  await expect(page.getByText('760', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('C1').first()).toBeVisible();
});

test('foco: o cronômetro começa', async ({ page }) => {
  await prepararConta(page);
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'foco');
  await page.getByRole('button', { name: /Iniciar Foco/ }).click();
  await expect(page.getByText('24:5', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
});

test('sem internet o quiz usa o banco do app e sincroniza quando a rede volta', async ({ page, context }) => {
  const { chamadas } = await prepararConta(page);
  await entrar(page);
  await fecharAvisos(page);
  // Carrega a tela do quiz com rede (o service worker faria isso no build).
  await abrirAba(page, 'quiz');
  await abrirAba(page, 'dashboard');
  await context.setOffline(true);
  await abrirAba(page, 'quiz');
  await page.getByText('Matemática', { exact: true }).first().click();
  await page.getByText('Funções', { exact: true }).first().click();
  await page.getByRole('button', { name: /Gerar Quiz/ }).click();
  await expect(page.getByText(/Sem internet/).first()).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const alt = page.locator('main button').filter({ hasText: /^A/ }).first();
    if (!(await alt.isVisible().catch(() => false))) break;
    await alt.click();
    await page.getByRole('button', { name: /próxima|resultado|finalizar|concluir/i }).first().click();
  }
  const guardadas = await page.evaluate(() => JSON.parse(localStorage.getItem('mm_fila_offline') || '[]').length);
  expect(guardadas).toBeGreaterThan(0);
  await context.setOffline(false);
  await expect.poll(() => chamadas.filter((c) => c.caminho === '/rest/v1/rpc/aplicar_operacao').length, { timeout: 20_000 }).toBe(guardadas);
});

test('link de turma abre o Perfil com o código preenchido', async ({ page }) => {
  await prepararConta(page);
  await entrar(page, '/turma/ABC-123');
  await expect(page.locator('input').filter({ hasText: '' }).and(page.locator('[value="ABC123"]'))).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});
