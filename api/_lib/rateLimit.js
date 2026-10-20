/* ============================================================
   MAD — /api/_lib/rateLimit.js
   Rate limit de análises: máx. N em 24h por WhatsApp e por IP.
   ============================================================ */
'use strict';

const { contar } = require('./supabase');
const { hashSha256 } = require('./validation');

const LIMITE_24H = 3;
const MS_24H = 24 * 60 * 60 * 1000;

function ipDoReq(req) {
  const xf = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
  if (xf) {
    const primeiro = String(xf).split(',')[0].trim();
    if (primeiro) return primeiro;
  }
  return (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

function hashIp(salt, ip) {
  return hashSha256((salt || '') + '|' + (ip || ''));
}

// Retorna { ok: true } se dentro do limite, ou { ok: false, motivo } se estourou.
async function verificarLimite({ whatsapp, ipHash }) {
  const desde = new Date(Date.now() - MS_24H).toISOString();
  // por WhatsApp
  if (whatsapp) {
    const n = await contar('analises_log',
      'whatsapp=eq.' + encodeURIComponent(whatsapp) + '&created_at=gte.' + encodeURIComponent(desde));
    if (n >= LIMITE_24H) return { ok: false, motivo: 'whatsapp' };
  }
  // por IP
  if (ipHash) {
    const n = await contar('analises_log',
      'ip_hash=eq.' + encodeURIComponent(ipHash) + '&created_at=gte.' + encodeURIComponent(desde));
    if (n >= LIMITE_24H) return { ok: false, motivo: 'ip' };
  }
  return { ok: true };
}

module.exports = { LIMITE_24H, ipDoReq, hashIp, verificarLimite };
