const { test, expect } = require('@playwright/test');

const widths = [360, 768, 1280];
const url = 'https://mad-marketing-six.vercel.app';

for (const width of widths) {
  test.describe(`Formulário @ ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url);
    });

    test('preenche, marca chips, aceita política, envia, vê loading/sucesso', async ({ page }) => {
      await page.fill('#nome', 'Teste Playwright');
      await page.fill('#email', 'teste@playwright.com');
      await page.fill('#whats', '11999999999');
      await page.fill('#instagram', '@teste');
      await page.selectOption('#investe_marketing', 'Invisto de vez em quando');

      // Marcar 2 chips
      await page.locator('input[name="interesses"][value="Reels"]').check();
      await page.locator('input[name="interesses"][value="Carrosséis"]').check();

      // Aceitar política
      await page.locator('#consent').check();

      // Enviar
      const btn = page.locator('button[type="submit"]');
      await btn.click();

      // Loading
      await expect(btn).toHaveText(/Enviando/i);
      await expect(btn).toBeDisabled();

      // Sucesso - role=status com aria-live
      await expect(page.locator('#status[role="status"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#status')).toContainText(/Recebemos seus dados/i);

      // Botão volta ao normal
      await expect(btn).toHaveText(/Enviar/i);
      await expect(btn).toBeEnabled();
    });

    test('simula erro de rede mostra role=alert com botão WhatsApp', async ({ page }) => {
      await page.fill('#nome', 'Teste Erro');
      await page.fill('#email', 'erro@playwright.com');
      await page.fill('#whats', '11999999999');
      await page.fill('#instagram', '@erro');
      await page.selectOption('#investe_marketing', 'Invisto de vez em quando');
      await page.locator('input[name="interesses"][value="Reels"]').check();
      await page.locator('#consent').check();

      // Bloquear requisição para simular erro
      await page.route('**/api/diagnostico', route => route.abort('failed'));

      await page.locator('button[type="submit"]').click();

      // Erro - role=alert
      await expect(page.locator('#status[role="alert"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#status')).toContainText(/Erro ao enviar/i);
      await expect(page.locator('#status a[href*="wa.me"]')).toBeVisible();
    });
  });
}