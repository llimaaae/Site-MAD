/* ==========================================================
   MAD — tests/resultado-pagina.test.js
   Página de resultado: link do WhatsApp, copiar link e PDF.
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const pagina = require('../resultado.js');

/* ---------- carrega sem DOM (não quebra em Node) ---------- */
test('o script da página carrega sem DOM', () => {
  assert.strictEqual(typeof pagina.baixarPdf, 'function');
  assert.strictEqual(typeof pagina.copiarTexto, 'function');
});

/* ---------- WhatsApp ---------- */
test('o botão de WhatsApp aponta para o número da MAD', () => {
  const link = pagina.waLink('@estudioc');
  assert.ok(link.startsWith('https://wa.me/5512981156417?text='));
  assert.ok(decodeURIComponent(link).includes('@estudioc'));
});

/* ---------- PDF (stub do jsPDF) ---------- */
test('o PDF é gerado em A4, com quebra de linha e nome de arquivo seguro', () => {
  const chamadas = { texto: [], salvou: null, paginas: 0, formatos: [] };

  class JsPDFStub {
    constructor(opcoes) { chamadas.formatos.push(opcoes); }
    setFillColor() {} setTextColor() {} setFont() {} setFontSize() {}
    rect() {} text(t) { chamadas.texto.push(t); }
    splitTextToSize(t, w) { chamadas.larguras = w; return [t]; }
    addPage() { chamadas.paginas++; }
    setPage() {}
    getNumberOfPages() { return 1 + chamadas.paginas; }
    save(nome) { chamadas.salvou = nome; }
  }

  global.jspdf = { jsPDF: JsPDFStub };

  pagina.baixarPdf({
    nome: 'Carla Dias',
    instagram: '@estud.io_c',
    created_at: '2026-10-19T12:00:00Z',
    nota_geral: 62,
    resumo: 'Resumo do diagnóstico',
    pontos_fortes: ['a', 'b', 'c'],
    pontos_a_melhorar: ['d', 'e', 'f'],
    acoes_praticas: [{ acao: 'Fazer stories', prioridade: 'alta' }],
    proximos_passos: ['passo 1', 'passo 2']
  });

  assert.deepStrictEqual(chamadas.formatos[0], { unit: 'mm', format: 'a4' });
  assert.ok(chamadas.texto.some(t => String(t).includes('Próximos passos recomendados')));
  assert.ok(chamadas.texto.some(t => String(t).includes('Fazer stories')));
  assert.ok(chamadas.larguras <= 200, 'o texto quebra dentro da página');
  assert.strictEqual(chamadas.salvou, 'diagnostico-mad-estudioc.pdf');
});

/* ---------- segurança ---------- */
test('a página usa textContent e nunca innerHTML', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'resultado.js'), 'utf8');
  // ignora os comentários do arquivo
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/innerHTML/.test(codigo), 'nenhum innerHTML no resultado.js');
  assert.ok(fonte.includes('textContent'), 'renderiza com textContent');
});

test('a página tem o aviso de prévia, o texto para guardar o link e o botão de copiar', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'resultado.js'), 'utf8');
  assert.ok(fonte.includes('Não é uma auditoria completa do perfil'));
  assert.ok(fonte.includes('Guarde este link ou baixe o PDF para consultar depois'));
  assert.ok(fonte.includes('Copiar link'));
  assert.ok(fonte.includes('Quer um novo diagnóstico?'));
});
