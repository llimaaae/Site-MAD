/* ==========================================================
   MAD — tests/resultado.test.js
   GET /api/resultado?id=...
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { instalarFetch, criarReq, criarRes } = require('./helpers/mock');

process.env.SUPABASE_URL = 'https://utbiafditbvpsgpejmli.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste';

const resultado = require('../api/resultado.js');

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

function diagnosticoDeExemplo(extra) {
  return Object.assign({
    id: '44444444-4444-4444-8444-444444444444',
    token: TOKEN,
    created_at: '2026-10-19T12:00:00Z',
    expira_em: '2027-01-17T12:00:00Z',
    nome: 'Carla Dias',
    instagram: '@estudioc',
    diagnostico: {
      nota_geral: 62,
      resumo: 'Resumo do diagnóstico',
      pontos_fortes: ['a', 'b', 'c'],
      pontos_a_melhorar: ['d', 'e', 'f'],
      acoes_praticas: [{ acao: 'x', prioridade: 'alta' }],
      proximos_passos: ['passo 1', 'passo 2']
    }
  }, extra || {});
}

test('devolve o diagnóstico pelo token público', async () => {
  instalarFetch({ diagnosticos: [diagnosticoDeExemplo()] });
  const res = criarRes();
  await resultado(criarReq({ method: 'GET', query: { id: TOKEN } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.corpo.nota_geral, 62);
  assert.strictEqual(res.corpo.resumo, 'Resumo do diagnóstico');
  assert.deepStrictEqual(res.corpo.proximos_passos, ['passo 1', 'passo 2']);
  assert.strictEqual(res.corpo.expira_em, '2027-01-17T12:00:00Z');
});

test('id inexistente devolve a MESMA resposta do id expirado', async () => {
  instalarFetch({ diagnosticos: [] });
  const res1 = criarRes();
  await resultado(criarReq({ method: 'GET', query: { id: TOKEN } }), res1);
  assert.strictEqual(res1.statusCode, 404);
  assert.strictEqual(res1.corpo.erro, 'nao-disponivel');

  const vencido = diagnosticoDeExemplo({ expira_em: '2020-01-01T00:00:00Z' });
  instalarFetch({ diagnosticos: [vencido] });
  const res2 = criarRes();
  await resultado(criarReq({ method: 'GET', query: { id: TOKEN } }), res2);
  assert.strictEqual(res2.statusCode, 404);
  assert.strictEqual(res2.corpo.erro, 'nao-disponivel');

  assert.deepStrictEqual(res1.corpo, res2.corpo, 'não revela qual dos dois casos é');
});

test('id malformado devolve 400', async () => {
  instalarFetch({ diagnosticos: [] });
  const res = criarRes();
  await resultado(criarReq({ method: 'GET', query: { id: 'abc' } }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'id-invalido');
});

test('diagnóstico antigo (schemavelho) ainda renderiza os próximos passos', async () => {
  const antigo = diagnosticoDeExemplo();
  antigo.diagnostico = {
    nota_geral: 50, resumo: 'r',
    pontos_fortes: ['a', 'b', 'c'], pontos_a_melhorar: ['d', 'e', 'f'],
    acoes_praticas: [],
    oportunidades_para_a_MAD: ['o 1', 'o 2']
  };
  instalarFetch({ diagnosticos: [antigo] });
  const res = criarRes();
  await resultado(criarReq({ method: 'GET', query: { id: TOKEN } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.corpo.proximos_passos, ['o 1', 'o 2']);
});
