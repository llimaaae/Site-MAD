/* ==========================================================
   MAD — tests/formulario.test.js
   Lógica do formulário em 2 partes (parte 1 e parte 2).
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { instalarFetch, criarReq, criarRes } = require('./helpers/mock');

const SUPABASE_URL = 'https://utbiafditbvpsgpejmli.supabase.co';
const SUPABASE_KEY = 'sb_publishable_teste';

const form = require('../formulario.js');

const DADOS_PARTE1 = {
  nome: 'Ana Souza',
  empresa: 'Clínica Aurora',
  whatsapp: '(12) 98115-6417',
  instagram: '@clinic Aurora',
  cidade: 'São Paulo',
  investimento: 'R$ 1.000 a R$ 5.000/mês',
  servico: 'Gestão de redes sociais',
  consent: true
};

const DADOS_PARTE2 = {
  seguidores: '1.000 a 5.000',
  posts: '2-3',
  conteudos: ['Reels', 'Stories'],
  engajamento: 'Médio',
  frequenciaStories: '3 a 5 vezes por semana',
  linkBio: 'sim',
  bio: 'Clínica de estética em SP. Agende pelo link.',
  objetivo: 'Ganhar mais clientes',
  dificuldade: 'Gerar conteúdo com consistência'
};

/* ---------- lead_id ---------- */
test('gerarLeadId devolve um uuid v4 diferente a cada chamada', () => {
  const a = form.gerarLeadId();
  const b = form.gerarLeadId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notStrictEqual(a, b);
});

/* ---------- Parte 1 ---------- */
test('validarParte1 exige nome, empresa, whatsapp, instagram e consentimento', () => {
  assert.strictEqual(form.validarParte1(DADOS_PARTE1).ok, true);

  const semConsent = form.validarParte1(Object.assign({}, DADOS_PARTE1, { consent: false }));
  assert.strictEqual(semConsent.ok, false);
  assert.ok(semConsent.erros.includes('consent'));

  const semNome = form.validarParte1(Object.assign({}, DADOS_PARTE1, { nome: '   ' }));
  assert.ok(semNome.erros.includes('nome'));
});

test('montarPayloadParte1 leva o lead_id e limpa os textos', () => {
  const leadId = form.gerarLeadId();
  const payload = form.montarPayloadParte1(DADOS_PARTE1, leadId);
  assert.strictEqual(payload.lead_id, leadId);
  assert.strictEqual(payload.nome, 'Ana Souza');
  assert.strictEqual(payload.empresa, 'Clínica Aurora');
  assert.strictEqual(payload.whatsapp, '(12) 98115-6417');
  assert.strictEqual(payload.instagram, '@clinic Aurora');
  assert.strictEqual(payload.cidade, 'São Paulo');
  assert.strictEqual(payload.investimento, 'R$ 1.000 a R$ 5.000/mês');
  assert.strictEqual(payload.servico, 'Gestão de redes sociais');
});

/* ---------- Parte 2 ---------- */
test('validarParte2 aponta o campo que falta', () => {
  assert.strictEqual(form.validarParte2(DADOS_PARTE2).ok, true);

  const semConteudo = form.validarParte2(Object.assign({}, DADOS_PARTE2, { conteudos: [] }));
  assert.ok(semConteudo.erros.includes('conteudos'));

  const semBio = form.validarParte2(Object.assign({}, DADOS_PARTE2, { bio: '' }));
  assert.ok(semBio.erros.includes('bio'));
});

test('montarPayloadParte2 corta a bio em 300 caracteres', () => {
  const leadId = form.gerarLeadId();
  const bio = 'x'.repeat(400);
  const payload = form.montarPayloadParte2(Object.assign({}, DADOS_PARTE2, { bio }), leadId);
  assert.strictEqual(payload.bio.length, 300);
  assert.strictEqual(payload.lead_id, leadId);
  assert.deepStrictEqual(payload.conteudos, ['Reels', 'Stories']);
  assert.strictEqual(payload.linkBio, 'sim');
});

/* ---------- Fluxo: abandonar na Parte 1 ---------- */
test('abandonar na Parte 1: o lead chega no banco e o e-mail de aviso é disparado', async () => {
  const estado = instalarFetch({});
  const leadId = form.gerarLeadId();
  const payload = form.montarPayloadParte1(DADOS_PARTE1, leadId);

  await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload);

  // o lead foi gravado (e só uma vez)
  assert.strictEqual(estado.leads.length, 1);
  assert.strictEqual(estado.leads[0].lead_id, leadId);
  assert.strictEqual(estado.leads[0].nome, 'Ana Souza');

  // e nenhum diagnóstico foi pedido
  assert.strictEqual(estado.diagnosticos.length, 0);
  assert.strictEqual(estado.groqChamadas.length, 0);

  // o webhook do Supabase transforma o INSERT no e-mail de aviso (1º e-mail)
  process.env.WEBHOOK_SECRET = 'segredo-de-teste';
  process.env.RESEND_API_KEY = 'resend-de-teste';
  process.env.LEAD_EMAIL = 'mad@exemplo.com';
  process.env.SITE_URL = 'https://mad.vercel.app';
  delete require.cache[require.resolve('../api/notifica-lead.js')];
  const notifica = require('../api/notifica-lead.js');

  const req = criarReq({
    method: 'POST',
    headers: { 'x-webhook-secret': 'segredo-de-teste' },
    body: { type: 'INSERT', table: 'leads', record: estado.leads[0] }
  });
  const res = criarRes();
  await notifica(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(estado.emails.length, 1);
  assert.strictEqual(estado.emails[0].to[0], 'mad@exemplo.com');
  assert.ok(estado.emails[0].subject.includes('Ana Souza'));
});

test('voltar e reenviar a Parte 1 não duplica o lead', async () => {
  const estado = instalarFetch({});
  const leadId = form.gerarLeadId();
  const payload = form.montarPayloadParte1(DADOS_PARTE1, leadId);

  await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload, '');
  assert.strictEqual(estado.leads.length, 1);

  // a pessoa volta, corrige o nome e reenvia com o mesmo lead_id
  const payload2 = form.montarPayloadParte1(Object.assign({}, DADOS_PARTE1, { nome: 'Ana Souza Lima' }), leadId);
  const r = await form.salvarLead(SUPABASE_URL, SUPABASE_KEY, payload2, leadId);

  assert.strictEqual(estado.leads.length, 1, 'continua com um lead só');
  assert.strictEqual(estado.leads[0].nome, 'Ana Souza Lima', 'o lead foi atualizado');
  assert.strictEqual(r.criado, false);
});

/* ---------- Fluxo: as duas partes ---------- */
test('completar as 2 partes: 1 lead, 1 diagnóstico e 2 e-mails', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste';
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.RESEND_API_KEY = 'resend-de-teste';
  process.env.LEAD_EMAIL = 'mad@exemplo.com';
  process.env.SITE_URL = 'https://mad.vercel.app';
  process.env.IP_HASH_SALT = 'salt-de-teste';
  process.env.GROQ_API_KEY = 'groq-de-teste';

  const estado = instalarFetch({
    leads: [{
      id: 1, lead_id: '11111111-1111-4111-8111-111111111111',
      nome: 'Ana Souza', empresa: 'Clínica Aurora', whatsapp: '(12) 98115-6417',
      instagram: '@clinicaaurora', cidade: 'São Paulo',
      investimento: 'R$ 1.000 a R$ 5.000/mês', servico: 'Gestão de redes sociais'
    }]
  });

  const diagnostico = require('../api/diagnostico.js');

  const payload = form.montarPayloadParte2(DADOS_PARTE2, '11111111-1111-4111-8111-111111111111');
  const req = criarReq({ method: 'POST', headers: {}, body: payload });
  const res = criarRes();
  await diagnostico(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.corpo.id, 'devolve o id do diagnóstico');

  // lead continua sendo um só
  assert.strictEqual(estado.leads.length, 1);

  // diagnóstico salvo com as duas partes
  assert.strictEqual(estado.diagnosticos.length, 1);
  const diag = estado.diagnosticos[0];
  assert.strictEqual(diag.lead_id, '11111111-1111-4111-8111-111111111111');
  assert.strictEqual(diag.nome, 'Ana Souza');
  assert.strictEqual(diag.seguidores, '1.000 a 5.000');
  assert.strictEqual(diag.engajamento, 'Médio');
  assert.strictEqual(diag.frequencia_stories, '3 a 5 vezes por semana');
  assert.strictEqual(diag.dificuldade, 'Gerar conteúdo com consistência');
  assert.ok(diag.expira_em, 'tem prazo de expiração');
  assert.match(diag.token, /^[A-Za-z0-9_-]{32,64}$/, 'token público aleatório longo');

  // 1 e-mail de diagnóstico (o 1º, do lead, vem do webhook)
  assert.strictEqual(estado.emails.length, 1);
  const email = estado.emails[0];
  assert.ok(email.subject.includes('Ana Souza'));
  assert.ok(email.subject.includes('@clinicaaurora'));
  assert.ok(email.text.includes('11111111-1111-4111-8111-111111111111'), 'leva o lead_id');
  assert.ok(email.text.includes('https://mad.vercel.app/resultado.html?id='), 'leva o link do resultado');
  assert.ok(!email.text.includes('ip_hash'), 'não leva hash de IP');
  assert.ok(!email.text.includes('service-role'), 'não leva segredo');
});

test('repetir a Parte 2 com o mesmo lead não duplica diagnóstico nem e-mail', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste';
  process.env.RESEND_API_KEY = 'resend-de-teste';
  process.env.LEAD_EMAIL = 'mad@exemplo.com';
  process.env.SITE_URL = 'https://mad.vercel.app';
  process.env.IP_HASH_SALT = 'salt-de-teste';
  process.env.GROQ_API_KEY = 'groq-de-teste';

  const estado = instalarFetch({
    leads: [{
      id: 1, lead_id: '22222222-2222-4222-8222-222222222222',
      nome: 'Bruno Lima', empresa: 'Studio B', whatsapp: '(11) 90000-0000',
      instagram: '@studiob', cidade: 'Campinas', investimento: 'Ainda não', servico: 'Tráfego pago'
    }]
  });

  const diagnostico = require('../api/diagnostico.js');
  const payload = form.montarPayloadParte2(DADOS_PARTE2, '22222222-2222-4222-8222-222222222222');

  const r1 = criarRes();
  await diagnostico(criarReq({ method: 'POST', body: payload }), r1);
  assert.strictEqual(r1.statusCode, 200);

  const r2 = criarRes();
  await diagnostico(criarReq({ method: 'POST', body: payload }), r2);
  assert.strictEqual(r2.statusCode, 409);
  assert.strictEqual(r2.corpo.erro, 'diagnostico-existente');

  assert.strictEqual(estado.diagnosticos.length, 1, 'continua com um diagnóstico só');
  assert.strictEqual(estado.emails.length, 1, 'não envia o e-mail duas vezes');
});
