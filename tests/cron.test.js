/* ==========================================================
   MAD — tests/cron.test.js
   GET /api/cron/limpeza (rotina diária de limpeza)
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { instalarFetch, criarReq, criarRes } = require('./helpers/mock');

process.env.SUPABASE_URL = 'https://utbiafditbvpsgpejmli.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste';
process.env.CRON_SECRET = 'segredo-cron-de-teste';

const limpeza = require('../api/cron/limpeza.js');

test('sem o segredo, a rotina não roda', async () => {
  instalarFetch({});
  const res = criarRes();
  await limpeza(criarReq({ method: 'GET', headers: {} }), res);
  assert.strictEqual(res.statusCode, 401);
});

test('com o segredo errado, a rotina não roda', async () => {
  instalarFetch({});
  const res = criarRes();
  await limpeza(criarReq({ method: 'GET', headers: { authorization: 'Bearer errado' } }), res);
  assert.strictEqual(res.statusCode, 401);
});

test('a rotina apaga diagnósticos vencidos e logs antigos, mas nunca os leads', async () => {
  const agora = new Date();
  const vencido = '2020-01-01T00:00:00.000Z';
  const futuro = new Date(agora.getTime() + 86400000 * 30).toISOString();

  const estado = instalarFetch({
    leads: [{ id: 1, lead_id: 'x', nome: 'Lead que continua' }],
    diagnosticos: [
      { id: 'a', token: 'vencido1', expira_em: vencido },
      { id: 'b', token: 'vencido2', expira_em: vencido },
      { id: 'c', token: 'valido', expira_em: futuro }
    ],
    analises: [
      { id: 'l1', created_at: vencido },
      { id: 'l2', created_at: new Date(agora.getTime() - 3600000).toISOString() }
    ]
  });

  const res = criarRes();
  await limpeza(criarReq({ method: 'GET', headers: { authorization: 'Bearer segredo-cron-de-teste' } }), res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.corpo.diagnosticos, 2, 'apagou os 2 vencidos');
  assert.strictEqual(res.corpo.logs, 1, 'apagou o log de mais de 24h');
  assert.strictEqual(estado.diagnosticos.length, 1, 'o diagnóstico válido continua');
  assert.strictEqual(estado.leads.length, 1, 'a tabela leads não é tocada');
});
