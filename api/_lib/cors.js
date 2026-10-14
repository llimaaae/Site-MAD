/* ============================================================
   MAD — /api/_lib/cors.js
   CORS restrito ao próprio site (SITE_URL) + origens locais.
   ============================================================ */
'use strict';

function origensPermitidas() {
  const lista = [];
  if (process.env.SITE_URL) lista.push(String(process.env.SITE_URL).replace(/\/+$/, ''));
  // apoio para testes locais
  lista.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173');
  return lista;
}

// Retorna true se respondeu ao preflight (OPTIONS) e deve encerrar.
function aplicarCors(req, res) {
  const permitidas = origensPermitidas();
  const origin = req.headers && req.headers.origin;
  if (origin && permitidas.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { aplicarCors };
