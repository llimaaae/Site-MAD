/* ==========================================================
   MAD — playwright-form.js
   Testes funcionais e responsivos do formulário e dos planos.
   Uso: node playwright-form.js
   Requer: playwright-core + chromium do cache ms-playwright,
           servidor estático em http://localhost:8787
   ========================================================== */
'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const EXEC_PATH = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');

const PASS = [];
const FAIL = [];
function registrar(nome, ok, extra) {
  (ok ? PASS : FAIL).push(nome + (extra ? ' :: ' + extra : ''));
  process.stdout.write((ok ? 'PASSOU ' : 'FALHOU ') + nome + (extra ? ' :: ' + extra : '') + '\n');
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC_PATH });
  const url = 'http://localhost:8787/index.html';

  /* ---------- teste funcional do formulário ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errosConsole = [];
  page.on('pageerror', e => errosConsole.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errosConsole.push(m.text()); });
  const requestsFail = [];
  page.on('response', r => { if (r.status() >= 500) requestsFail.push(r.url() + ' -> ' + r.status()); });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#form');

  registrar('cartão do formulário simplificado presente', !!(await page.$('#investe_marketing')) && !!(await page.$('#interesses-checks')));

  // Campos obrigatórios: submeter vazio deve permanecer no formulário
  await page.click('#form button[type="submit"]');
  const nomeAviso = await page.locator('#nome:invalid').count();
  registrar('campos obrigatórios bloqueiam envio vazio', nomeAviso > 0, 'contador inválidos=' + nomeAviso);

  // E-mail inválido
  await page.fill('#email', 'invalido');
  const emailInvalido = await page.locator('#email:invalid').count();
  registrar('e-mail inválido bloqueado pelo type=email', emailInvalido === 1);

  // WhatsApp inválido
  await page.fill('#whats', '(12) 34-68');
  await page.fill('#email', 'a@b.com');
  const waValido = await page.evaluate(() => {
    const f = window.MADFormulario;
    return !f.validarWhatsApp('(12) 34-68') && f.validarWhatsApp('(12) 98115-6417');
  });
  registrar('whatsapp: validador recusa formato curto e aceita 10/11 dígitos', !!waValido);

  // Normalização do @ do Instagram
  await page.fill('#instagram', '@@clinic   teste');
  const ig = await page.inputValue('#instagram');
  registrar('normaliza @ duplicado e espaços -> @ + valor limpo', ig === '@clinicteste', 'valor=' + ig);

  // Consentimento obrigatório
  const consentRequired = await page.locator('#consent[required]').count();
  registrar('checkbox de consentimento obrigatório', consentRequired === 1);

  // Interesses múltiplos
  await page.check('input[name="interesses"][value="Site"]');
  await page.check('input[name="interesses"][value="Chatbot de WhatsApp"]');
  const valores = await page.$$eval('input[name="interesses"]:checked', els => els.map(e => e.value));
  registrar('múltiplos interesses coletados', valores.length === 2, JSON.stringify(valores));

  // Honeypot preenchido -> validar() retorna erro e o envio simulado NÃO chama Supabase
  const honeypotOk = await page.evaluate(() => {
    const f = window.MADFormulario;
    const r = f.validar({ nome: 'A', empresa: 'B', whatsapp: '11987654321', instagram: '@x', email: 'a@b.com', investe_marketing: 'Invisto todo mês', interesses: ['Site'], consent: true, website: 'spam' });
    return r.erros.includes('honeypot');
  });
  registrar('honeypot interrompe envio real', !!honeypotOk);

  // Proteção contra envio duplicado
  const dupGuard = await page.evaluate(() => {
    const script = Array.from(document.querySelectorAll('script')).map(s => s.src).find(s => s.includes('script.js'));
    return typeof window.MADFormulario !== 'undefined';
  });
  registrar('MADFormulario presente na página', !!dupGuard);

  // Injeta o marcador [TESTE] e envia de verdade (INSERT pode falhar por schema pendente)
  await page.fill('#nome', '[TESTE]madweb');
  await page.fill('#empresa', '[TESTE]madwebco');
  await page.fill('#whats', '(11) 98115-6417');
  await page.fill('#email', 'madweb@teste.com');
  await page.fill('#instagram', '@madwebteste');
  await page.selectOption('#investe_marketing', 'Invisto todo mês');
  await page.check('input[name="interesses"][value="Site"]');
  await page.check('#consent');
  const respostaSupabase = [];
  page.on('response', r => { if (r.url().includes('/rest/v1/leads')) respostaSupabase.push(r.status()); });
  await page.click('#form button[type="submit"]');
  await page.waitForTimeout(3000);

  const textoSucesso = 'Nossa equipe vai entrar em contato';
  const sucessoTela = (await page.locator('#msg').textContent()).includes(textoSucesso)
    || respostaSupabase.some(s => s === 201 || s === 0);
  registrar('envio real do lead com [TESTE] concluído (schema aplicado?)', respostaSupabase[0] === 201, 'status=' + respostaSupabase.join(','));

  // Honeypot na tela: preenche via script e clica de novo — deve simular sucesso sem chamar Supabase
  const statusAntes = respostaSupabase.length;
  await page.evaluate(() => { const i = document.querySelector('input[name="website"]'); i.value = 'spambot'; });
  await page.evaluate(() => { document.getElementById('msg').textContent = ''; document.getElementById('form').style.display = 'block'; document.getElementById('status').hidden = true; });
  await page.click('#form button[type="submit"]');
  await page.waitForTimeout(1500);
  const honeypotTela = (await page.locator('#msg').textContent()).includes(textoSucesso)
    && respostaSupabase.length === statusAntes;
  registrar('honeypot: simula sucesso e não toca no banco', !!honeypotTela, 'chamadas=' + respostaSupabase.length);

  // Console e rede limpos
  registrar('console sem erros', errosConsole.length === 0, errosConsole.slice(0, 3).join(' | '));
  registrar('sem 5xx em rede', requestsFail.length === 0, requestsFail.join(' | '));

  await ctx.close();

  /* ---------- testes responsivos ---------- */
  for (const largura of [360, 768, 1280]) {
    const ctxR = await browser.newContext({ viewport: { width: largura, height: 900 } });
    const pageR = await ctxR.newPage();
    await pageR.goto(url, { waitUntil: 'load' });
    await pageR.addStyleTag({ content: '.reveal{opacity:1 !important;transform:none !important;} html.js [hidden]{display:none !important;}' });
    const overflow = await pageR.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    registrar('sem overflow horizontal @' + largura + 'px', overflow <= 1, 'excesso=' + overflow);
    // planos legíveis
    const planos = await pageR.$$('.plan');
    registrar('3 cards de plano visíveis @' + largura + 'px', planos.length === 3);
    const texto = await pageR.textContent('#planos');
    registrar('preços visíveis @' + largura + 'px', texto.includes('R$ 349,99') && texto.includes('R$ 649,99') && texto.includes('R$ 1.249,99'));
    await ctxR.close();
  }

  await browser.close();

  fs.writeFileSync(__dirname + '/resultados.txt',
    PASS.map(s => 'PASSOU ' + s).concat(FAIL.map(s => 'FALHOU ' + s)).join('\n'));
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error('erro:', e.message); process.exit(2); });