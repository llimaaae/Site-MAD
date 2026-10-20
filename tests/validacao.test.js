/* ==========================================================
   MAD — tests/validacao.test.js
   Validação da Parte 2, do JSON da IA e dos identificadores.
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const v = require('../api/_lib/validation.js');

const PARTE2_OK = {
  seguidores: '1.000 a 5.000',
  posts: '2-3',
  conteudos: ['Reels', 'Stories'],
  engajamento: 'Médio',
  frequenciaStories: '3 a 5 vezes por semana',
  linkBio: 'sim',
  bio: 'Bio do perfil',
  objetivo: 'Ganhar mais clientes',
  dificuldade: 'Gerar conteúdo com consistência'
};

/* ---------- Parte 2 ---------- */
test('validarParte2 aceita uma resposta completa', () => {
  const r = v.validarParte2(PARTE2_OK);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.dados.faltando, []);
});

test('validarParte2 aceita "Não sei" como informação ausente', () => {
  const r = v.validarParte2(Object.assign({}, PARTE2_OK, {
    engajamento: 'Não sei',
    frequenciaStories: 'Não sei / varia muito'
  }));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.dados.faltando.sort(), ['engajamento', 'frequenciaStories']);
});

test('validarParte2 recusa valores fora das opções', () => {
  const r = v.validarParte2(Object.assign({}, PARTE2_OK, { seguidores: 'milhares' }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.campos.includes('seguidores'));

  const r2 = v.validarParte2(Object.assign({}, PARTE2_OK, { posts: 'Não sei' }));
  assert.strictEqual(r2.ok, false, '"Não sei" não é opção de posts por semana');

  const r3 = v.validarParte2(Object.assign({}, PARTE2_OK, { conteudos: ['Podcast'] }));
  assert.strictEqual(r3.ok, false);
});

test('validarParte2 recusa bio vazia e tipo de conteúdo vazio', () => {
  assert.ok(v.validarParte2(Object.assign({}, PARTE2_OK, { bio: '   ' })).campos.includes('bio'));
  assert.ok(v.validarParte2(Object.assign({}, PARTE2_OK, { conteudos: [] })).campos.includes('conteudos'));
});

/* ---------- JSON da IA ---------- */
test('validarDiagnostico aceita o schema novo (proximos_passos)', () => {
  const ok = v.validarDiagnostico({
    nota_geral: 70,
    resumo: 'Resumo',
    pontos_fortes: ['a', 'b', 'c'],
    pontos_a_melhorar: ['a', 'b', 'c'],
    acoes_praticas: [
      { acao: 'x', prioridade: 'alta' },
      { acao: 'y', prioridade: 'media' },
      { acao: 'z', prioridade: 'baixa' }
    ],
    proximos_passos: ['passo 1', 'passo 2']
  });
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.dados.proximos_passos, ['passo 1', 'passo 2']);
});

test('validarDiagnostico aceita o schema antigo (compatibilidade)', () => {
  const ok = v.validarDiagnostico({
    nota_geral: 70,
    resumo: 'Resumo',
    pontos_fortes: ['a', 'b', 'c'],
    pontos_a_melhorar: ['a', 'b', 'c'],
    acoes_praticas: [
      { acao: 'x', prioridade: 'alta' },
      { acao: 'y', prioridade: 'media' },
      { acao: 'z', prioridade: 'baixa' }
    ],
    oportunidades_para_a_MAD: ['o 1', 'o 2']
  });
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.dados.proximos_passos, ['o 1', 'o 2']);
});

test('validarDiagnostico recusa JSON fora do schema', () => {
  assert.strictEqual(v.validarDiagnostico(null).ok, false);
  assert.strictEqual(v.validarDiagnostico({}).ok, false);
  assert.strictEqual(v.validarDiagnostico({
    nota_geral: 200, resumo: 'x',
    pontos_fortes: ['a', 'b', 'c'], pontos_a_melhorar: ['a', 'b', 'c'],
    acoes_praticas: [{ acao: 'a', prioridade: 'alta' }, { acao: 'b', prioridade: 'media' }, { acao: 'c', prioridade: 'baixa' }],
    proximos_passos: ['1', '2']
  }).ok, false, 'nota fora de 0-100');
  assert.strictEqual(v.validarDiagnostico({
    nota_geral: 50, resumo: 'x',
    pontos_fortes: ['a', 'b'], pontos_a_melhorar: ['a', 'b', 'c'],
    acoes_praticas: [{ acao: 'a', prioridade: 'alta' }, { acao: 'b', prioridade: 'media' }, { acao: 'c', prioridade: 'baixa' }],
    proximos_passos: ['1', '2']
  }).ok, false, 'pontos_fortes com 2 itens');
});

/* ---------- Identificadores ---------- */
test('validarTokenPublico aceita token longo e uuid', () => {
  assert.strictEqual(v.validarTokenPublico('a'.repeat(32)), true);
  assert.strictEqual(v.validarTokenPublico('a'.repeat(64)), true);
  assert.strictEqual(v.validarTokenPublico('corta'), false);
  assert.strictEqual(v.validarTokenPublico('11111111-1111-4111-8111-111111111111'), true);
  assert.strictEqual(v.validarTokenPublico(''), false);
  assert.strictEqual(v.validarTokenPublico(null), false);
});

test('validarUuidV4 aceita o lead_id do navegador', () => {
  assert.strictEqual(v.validarUuidV4('11111111-1111-4111-8111-111111111111'), true);
  assert.strictEqual(v.validarUuidV4('11111111-1111-1111-8111-111111111111'), false);
  assert.strictEqual(v.validarUuidV4('lixo'), false);
});

test('ehDesconhecido reconhece "Não sei" e "varia muito"', () => {
  assert.strictEqual(v.ehDesconhecido('Não sei'), true);
  assert.strictEqual(v.ehDesconhecido('Não sei / varia muito'), true);
  assert.strictEqual(v.ehDesconhecido('nao sei'), true);
  assert.strictEqual(v.ehDesconhecido('Médio'), false);
  assert.strictEqual(v.ehDesconhecido('Não posto com regularidade'), false);
});
