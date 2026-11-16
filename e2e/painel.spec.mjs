import { expect, test } from '@playwright/test';
import { entrar, prepararConta } from './ambiente.mjs';

test('professor baixa o relatório da turma em dois cliques', async ({ page }) => {
  await prepararConta(page, { papel: 'teacher' });
  await entrar(page);
  await page.getByRole('tab', { name: /Relatório/ }).click();
  await expect(page.getByText('Funções')).toBeVisible();
  const [arquivo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Baixar planilha/ }).click()]);
  expect(arquivo.suggestedFilename()).toMatch(/^relatorio_3_A_30d_\d{4}-\d{2}-\d{2}\.csv$/);
});

test('responsável abre o link de vínculo com o código preenchido', async ({ page }) => {
  await prepararConta(page, { papel: 'parent' });
  await entrar(page, '/vinculo/a1b2c3d4');
  await expect(page.locator('[value="A1B2C3D4"]')).toBeVisible();
});
