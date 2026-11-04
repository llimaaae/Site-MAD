/* ==========================================================
   MAD — tests/formulario.test.js
   Formulário comercial simplificado (1 etapa).
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { instalarFetch, criarReq, criarRes } = require('./helpers/mock');

const SUPABASE_URL = 'https://utbiafditbvpsgpejmli.supabase.co';
const SUPABASE_KEY = 'sb_publishable_teste';

const form = require('../formulario.js');

const DADOS_VALIDOS = {
  nome: 'Ana Souza',
  empresa: 'Clínica Aurora',
  whatsapp: '(12) 98115-6417',
  instagram: '@clinicaaurora',
  email: 'ana@clinica.com',
  investe_marketing: 'Invisto todo mês',
  interesses: ['Reels', 'Carrosséis'],
  consent: true,
  website: '' // honeypot vazio
};

const DADOS_MINIMOS = {
  nome: 'Bruno',
  empresa: 'Studio B',
  whatsapp: '(11) 90000-0000',
  instagram: '@studiob',
  email: 'b@studio.com',
  investe_marketing: 'Ainda não invisto',
  interesses: ['Fotos'],
  consent: true,
  website: ''
};

/* ---------- normalizarInstagram ---------- */
test('normalizarInstagram adiciona @ e remove espaços', () => {
  assert.strictEqual(form.normalizarInstagram('clinicaaurora'), '@clinicaaurora');
  assert.strictEqual(form.normalizarInstagram('@clinicaaurora'), '@clinicaaurora');
  assert.strictEqual(form.normalizarInstagram('  @clinica  '), '@clinica');
  assert.strictEqual(form.normalizarInstagram('@@duplicado'), '@duplicado');
  assert.strictEqual(form.normalizarInstagram(''), '');
});

/* ---------- validarEmail ---------- */
test('validarEmail aceita e-mails válidos e rejeita inválidos', () => {
  assert.strictEqual(form.validarEmail('a@b.com'), true);
  assert.strictEqual(form.validarEmail('ana@clinica.com.br'), true);
  assert.strictEqual(form.validarEmail(''), false);
  assert.strictEqual(form.validarEmail('invalido'), false);
  assert.strictEqual(form.validarEmail('a@b'), false);
  assert.strictEqual(form.validarEmail('@sem-local.com'), false);
});

/* ---------- validarWhatsApp ---------- */
test('validarWhatsApp aceita 10 ou 11 dígitos', () => {
  assert.strictEqual(form.validarWhatsApp('(12) 98115-6417'), true); // 11 dígitos
  assert.strictEqual(form.validarWhatsApp('(11) 9000-0000'), true); // 10 dígitos
  assert.strictEqual(form.validarWhatsApp('12981156417'), true);
  assert.strictEqual(form.validarWhatsApp('11900000000'), true);
  assert.strictEqual(form.validarWhatsApp('123'), false);
  assert.strictEqual(form.validarWhatsApp(''), false);
});

/* ---------- validarInstagram ---------- */
test('validarInstagram aceita formato válido até 30 chars', () => {
  assert.strictEqual(form.validarInstagram('@clinicaaurora'), true);
  assert.strictEqual(form.validarInstagram('clinicaaurora'), true);
  assert.strictEqual(form.validarInstagram('@' + 'a'.repeat(30)), true);
  assert.strictEqual(form.validarInstagram('@' + 'a'.repeat(31)), false);
  assert.strictEqual(form.validarInstagram('@invalido!'), false);
  assert.strictEqual(form.validarInstagram(''), false);
});

/* ---------- validar (formulário completo) ---------- */
test('validar aceita dados completos e válidos', () => {
  const r = form.validar(DADOS_VALIDOS);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.erros, []);
});

test('validar rejeita campos obrigatórios vazios', () => {
  const semNome = form.validar({ ...DADOS_VALIDOS, nome: '' });
  assert.strictEqual(semNome.ok, false);
  assert.ok(semNome.erros.includes('nome'));

  const semEmpresa = form.validar({ ...DADOS_VALIDOS, empresa: '' });
  assert.ok(semEmpresa.erros.includes('empresa'));

  const semWhatsApp = form.validar({ ...DADOS_VALIDOS, whatsapp: '' });
  assert.ok(semWhatsApp.erros.includes('whatsapp'));

  const semInstagram = form.validar({ ...DADOS_VALIDOS, instagram: '' });
  assert.ok(semInstagram.erros.includes('instagram'));

  const semEmail = form.validar({ ...DADOS_VALIDOS, email: '' });
  assert.ok(semEmail.erros.includes('email'));

  const emailInvalido = form.validar({ ...DADOS_VALIDOS, email: 'invalido' });
  assert.ok(emailInvalido.erros.includes('email'));
});

test('validar exige consentimento', () => {
  const semConsent = form.validar({ ...DADOS_VALIDOS, consent: false });
  assert.strictEqual(semConsent.ok, false);
  assert.ok(semConsent.erros.includes('consent'));
});

test('validar exige investe_marketing válido', () => {
  const invalido = form.validar({ ...DADOS_VALIDOS, investe_marketing: 'Opção inexistente' });
  assert.strictEqual(invalido.ok, false);
  assert.ok(invalido.erros.includes('investe_marketing'));

  const vazio = form.validar({ ...DADOS_VALIDOS, investe_marketing: '' });
  assert.ok(vazio.erros.includes('investe_marketing'));
});

test('validar exige interesses (array não vazio com opções válidas)', () => {
  const vazio = form.validar({ ...DADOS_VALIDOS, interesses: [] });
  assert.strictEqual(vazio.ok, false);
  assert.ok(vazio.erros.includes('interesses'));

  const invalido = form.validar({ ...DADOS_VALIDOS, interesses: ['Opção inexistente'] });
  assert.ok(invalido.erros.includes('interesses'));

  const multiplo = form.validar({ ...DADOS_VALIDOS, interesses: ['Reels', 'Anúncios'] });
  assert.strictEqual(multiplo.ok, true);
});

test('validar honeypot: se preenchido, simula sucesso (erro honeypot)', () => {
  const preenchido = form.validar({ ...DADOS_VALIDOS, website: 'spam' });
  assert.strictEqual(preenchido.ok, false);
  assert.ok(preenchido.erros.includes('honeypot'));
});

test('validar limite de caracteres', () => {
  const nomeLongo = form.validar({ ...DADOS_VALIDOS, nome: 'a'.repeat(101) });
  assert.ok(nomeLongo.erros.includes('nome'));

  const empresaLonga = form.validar({ ...DADOS_VALIDOS, empresa: 'a'.repeat(101) });
  assert.ok(empresaLonga.erros.includes('empresa'));

  const emailLongo = form.validar({ ...DADOS_VALIDOS, email: 'a'.repeat(150) + '@b.com' });
  assert.ok(emailLongo.erros.includes('email'));
});

/* ---------- montarPayload ---------- */
test('montarPayload limpa e normaliza dados', () => {
  const payload = form.montarPayload(DADOS_VALIDOS);
  assert.strictEqual(payload.nome, 'Ana Souza');
  assert.strictEqual(payload.empresa, 'Clínica Aurora');
  assert.strictEqual(payload.whatsapp, '12981156417'); // só números
  assert.strictEqual(payload.instagram, '@clinicaaurora');
  assert.strictEqual(payload.email, 'ana@clinica.com');
  assert.strictEqual(payload.investe_marketing, 'Invisto todo mês');
  assert.deepStrictEqual(payload.interesses, ['Reels', 'Carrosséis']);
});

test('montarPayload corta nos limites', () => {
  const payload = form.montarPayload({
    ...DADOS_VALIDOS,
    nome: 'a'.repeat(150),
    empresa: 'b'.repeat(150),
    email: 'c'.repeat(200) + '@d.com',
    instagram: '@' + 'x'.repeat(50)
  });
  assert.strictEqual(payload.nome.length, 100);
  assert.strictEqual(payload.empresa.length, 100);
  assert.strictEqual(payload.email.length, 150);
  assert.strictEqual(payload.instagram.length, 31); // @ + 30
});

/* ---------- INVESTE_OPCOES e INTERESSES_OPCOES exportados ---------- */
test('constantes de opções exportadas', () => {
  assert.ok(Array.isArray(form.INVESTE_OPCOES));
  assert.strictEqual(form.INVESTE_OPCOES.length, 4);
  assert.ok(form.INVESTE_OPCOES.includes('Ainda não invisto'));

  assert.ok(Array.isArray(form.INTERESSES_OPCOES));
  assert.strictEqual(form.INTERESSES_OPCOES.length, 6);
  assert.ok(form.INTERESSES_OPCOES.includes('Reels'));
  assert.ok(form.INTERESSES_OPCOES.includes('Anúncios'));
});

/* ---------- salvarLead (integração com mock) ---------- */
test('salvarLead insere lead no Supabase via anon key', async () => {
  const estado = instalarFetch({});
  const payload = form.montarPayload(DADOS_VALIDOS);

  await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload);

  assert.strictEqual(estado.leads.length, 1);
  const lead = estado.leads[0];
  assert.strictEqual(lead.nome, 'Ana Souza');
  assert.strictEqual(lead.email, 'ana@clinica.com');
  assert.deepStrictEqual(lead.interesses, ['Reels', 'Carrosséis']);
});

/* ---------- notifica-lead (webhook) ---------- */
test('webhook notifica-lead envia e-mail via Resend', async () => {
  const estado = instalarFetch({});

  // insere lead direto no mock
  const payload = form.montarPayload(DADOS_VALIDOS);
  await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload);
  const lead = estado.leads[0];

  process.env.WEBHOOK_SECRET = 'segredo-de-teste';
  process.env.RESEND_API_KEY = 'resend-de-teste';
  process.env.LEAD_EMAIL = 'mad@exemplo.com';
  process.env.SITE_URL = 'https://mad.vercel.app';
  delete require.cache[require.resolve('../api/notifica-lead.js')];
  const notifica = require('../api/notifica-lead.js');

  const req = criarReq({
    method: 'POST',
    headers: { 'x-webhook-secret': 'segredo-de-teste' },
    body: { type: 'INSERT', table: 'leads', record: lead }
  });
  const res = criarRes();
  await notifica(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(estado.emails.length, 1);
  const email = estado.emails[0];
  assert.strictEqual(email.to[0], 'mad@exemplo.com');
  assert.ok(email.subject.startsWith('Novo lead: '));
  assert.ok(email.subject.includes('Ana Souza'));
  assert.ok(email.subject.includes('Clínica Aurora'));
  assert.ok(email.text.includes('12981156417')); // whatsapp limpo
  assert.ok(email.text.includes('@clinicaaurora'));
  assert.ok(email.text.includes('Reels'));
  assert.ok(email.text.includes('Carrosséis'));
});

test('webhook rejeita sem segredo', async () => {
  const estado = instalarFetch({});
  const payload = form.montarPayload(DADOS_VALIDOS);
  await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload);
  const lead = estado.leads[0];

  process.env.WEBHOOK_SECRET = 'segredo-de-teste';
  delete require.cache[require.resolve('../api/notifica-lead.js')];
  const notifica = require('../api/notifica-lead.js');

  const req = criarReq({
    method: 'POST',
    headers: {},
    body: { type: 'INSERT', table: 'leads', record: lead }
  });
  const res = criarRes();
  await notifica(req, res);

  assert.strictEqual(res.statusCode, 401);
});

test('webhook rejeita segredo errado', async () => {
  const estado = instalarFetch({});
  const payload = form.montarPayload(DADOS_VALIDOS);
  await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload);
  const lead = estado.leads[0];

  process.env.WEBHOOK_SECRET = 'segredo-correto';
  delete require.cache[require.resolve('../api/notifica-lead.js')];
  const notifica = require('../api/notifica-lead.js');

  const req = criarReq({
    method: 'POST',
    headers: { 'x-webhook-secret': 'segredo-errado' },
    body: { type: 'INSERT', table: 'leads', record: lead }
  });
  const res = criarRes();
  await notifica(req, res);

  assert.strictEqual(res.statusCode, 401);
});