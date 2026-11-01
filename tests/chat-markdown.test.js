/* ==========================================================
   MAD — tests/chat-markdown.test.js
   Renderer de markdown do chatbot: escapamento anti-XSS,
   negrito, listas (simples e aninhadas), links e títulos.
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { renderizarMarkdown } = require('../chatbot.js');

test('texto simples vira um parágrafo', () => {
  assert.strictEqual(renderizarMarkdown('olá tudo bem'), '<p>olá tudo bem</p>');
});

test('escapa HTML na resposta (anti-XSS)', () => {
  const saida = renderizarMarkdown('<script>alert(1)</script>');
  assert.ok(saida.includes('&lt;script&gt;'));
  assert.ok(!saida.includes('<script>'));
});

test('escapa aspas e e-comercial', () => {
  const saida = renderizarMarkdown('manual de marca "v1" & catálogo');
  assert.ok(saida.includes('&quot;v1&quot;'));
  assert.ok(saida.includes('&amp;'));
});

test('negrito ** vira <strong>', () => {
  assert.strictEqual(
    renderizarMarkdown('a **b** c'),
    '<p>a <strong>b</strong> c</p>'
  );
});

test('lista simples vira <ul> com itens', () => {
  assert.strictEqual(
    renderizarMarkdown('- a\n- b'),
    '<ul><li>a</li><li>b</li></ul>'
  );
});

test('lista ordenada vira <ol> com itens', () => {
  assert.strictEqual(
    renderizarMarkdown('1. x\n2. y'),
    '<ol><li>x</li><li>y</li></ol>'
  );
});

test('lista aninhada com recuo de 2 espaços', () => {
  const saida = renderizarMarkdown('- a\n  - b\n- c');
  assert.ok(saida.startsWith('<ul><li>a</li><ul><li>b</li></ul></ul>'));
  assert.ok(saida.endsWith('<ul><li>c</li></ul>'));
});

test('link http vira <a> com rel noopener', () => {
  assert.strictEqual(
    renderizarMarkdown('veja [MAD](https://mad.com.br) aqui'),
    '<p>veja <a href="https://mad.com.br" target="_blank" rel="noopener noreferrer">MAD</a> aqui</p>'
  );
});

test('link com javascript: NUNCA vira <a>', () => {
  const saida = renderizarMarkdown('[x](javascript:alert(1))');
  assert.ok(!saida.includes('<a '));
  assert.ok(saida.includes('javascript:alert(1)'));
});

test('título ## vira <h4>', () => {
  assert.strictEqual(renderizarMarkdown('## Título'), '<h4>Título</h4>');
});

test('título ### vira <h5>', () => {
  assert.strictEqual(renderizarMarkdown('### Serviços'), '<h5>Serviços</h5>');
});

test('quebra de linha simples no parágrafo vira <br>', () => {
  assert.strictEqual(renderizarMarkdown('a\nb'), '<p>a<br>b</p>');
});

test('negrito dentro de item de lista', () => {
  assert.strictEqual(
    renderizarMarkdown('- **Tráfego pago:** campanhas'),
    '<ul><li><strong>Tráfego pago:</strong> campanhas</li></ul>'
  );
});

test('vazio devolve string vazia', () => {
  assert.strictEqual(renderizarMarkdown(''), '');
  assert.strictEqual(renderizarMarkdown(null), '');
  assert.strictEqual(renderizarMarkdown(undefined), '');
});
