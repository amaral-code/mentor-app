import { expect, test } from '@playwright/test';
import { abrirAba, entrar, fecharAvisos, prepararConta } from './ambiente.mjs';

/** LGPD (#70), feedback do beta (#74) e páginas públicas (#76). */

test('baixar meus dados entrega um JSON com o perfil', async ({ page }) => {
  const { chamadas } = await prepararConta(page);
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'profile');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar meus dados' }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(/^meus-dados-midnight-mentor-\d{4}-\d{2}-\d{2}\.json$/);
  expect(chamadas.some((c) => c.caminho === '/rest/v1/rpc/exportar_meus_dados')).toBe(true);
});

test('excluir a conta exige a palavra, chama o servidor e volta ao login', async ({ page }) => {
  await prepararConta(page);
  let pedido = null;
  await page.route('**/api/conta/excluir', async (route) => {
    pedido = { corpo: route.request().postDataJSON(), sessao: route.request().headers()['x-supabase-auth'] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"arquivos":0}' });
  });
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'profile');
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  const botao = page.getByRole('button', { name: 'Excluir para sempre' });
  await expect(botao).toBeDisabled();
  await page.getByLabel(/Para confirmar, digite/).fill('excluir');
  await botao.click();
  await expect(page.locator('#campo-email')).toBeVisible({ timeout: 15_000 });
  expect(pedido.corpo).toEqual({ confirmacao: 'EXCLUIR' });
  expect(pedido.sessao).toBeTruthy();
});

test('feedback vai com o tipo, a nota e a tela de onde veio', async ({ page }) => {
  const { chamadas } = await prepararConta(page);
  await entrar(page);
  await fecharAvisos(page);
  await abrirAba(page, 'profile');
  const secao = page.locator('#secao-feedback');
  await secao.getByRole('radio', { name: 'Tenho uma ideia' }).click();
  await secao.locator('textarea').fill('Queria simulado cronometrado.');
  await secao.getByRole('button', { name: '9', exact: true }).click();
  await secao.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText(/Obrigado por ajudar/)).toBeVisible();
  const envio = chamadas.find((c) => c.caminho === '/rest/v1/rpc/enviar_feedback');
  expect(envio.corpo).toMatchObject({ p_tipo: 'ideia', p_nota: 9, p_tela: 'profile', p_texto: 'Queria simulado cronometrado.' });
});

test('landing abre sem login e leva às páginas legais e ao app', async ({ page }) => {
  await page.goto('/conheca/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ENEM');
  await page.getByRole('link', { name: 'Política de privacidade' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeVisible();
  await page.getByRole('link', { name: 'Termos de uso' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir o app' }).click();
  await expect(page.locator('#campo-email')).toBeVisible();
});
