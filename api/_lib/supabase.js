/* ============================================================
   MAD — /api/_lib/supabase.js
   Acesso ao Supabase via REST com service_role (somente backend).
   ============================================================ */
'use strict';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://utbiafditbvpsgpejmli.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

function headersBase(extra) {
  if (!SERVICE_KEY) throw new Error('service-role-ausente');
  return Object.assign({
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY
  }, extra || {});
}

async function inserir(tabela, registro, prefer) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + tabela, {
    method: 'POST',
    headers: headersBase({ 'Prefer': prefer || 'return=minimal' }),
    body: JSON.stringify(registro)
  });
  if (!r.ok) {
    const detalhe = await r.text();
    const err = new Error('supabase-insert-falhou');
    err.status = r.status;
    err.detail = detalhe;
    throw err;
  }
  if (prefer && prefer.indexOf('return=representation') !== -1) {
    return r.json();
  }
  return null;
}

async function contar(tabela, filtroQuery) {
  // filtroQuery: string no formato PostgREST, ex: "email=eq.foo&created_at=gte.2024-..."
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + tabela + '?select=id&' + filtroQuery, {
    method: 'GET',
    headers: headersBase({ 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' })
  });
  if (!r.ok) {
    const detalhe = await r.text();
    const err = new Error('supabase-count-falhou');
    err.status = r.status;
    err.detail = detalhe;
    throw err;
  }
  // content-range: 0-0/123
  const cr = r.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+)$/);
  if (m) return parseInt(m[1], 10);
  const dados = await r.json().catch(() => []);
  return Array.isArray(dados) ? dados.length : 0;
}

/* Remove as linhas que batem com o filtro (PostgREST DELETE).
   Usado só pela rotina de limpeza (diagnósticos vencidos e log antigo).
   filterExample: "expira_em=lt.2026-01-01T00:00:00Z" */
async function remover(tabela, filtroQuery) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + tabela + '?' + filtroQuery, {
    method: 'DELETE',
    headers: headersBase({ 'Prefer': 'return=representation' })
  });
  if (!r.ok) {
    const detalhe = await r.text();
    const err = new Error('supabase-delete-falhou');
    err.status = r.status;
    err.detail = detalhe;
    throw err;
  }
  const dados = await r.json().catch(() => []);
  return Array.isArray(dados) ? dados.length : 0;
}

async function buscarUm(tabela, filtroQuery) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + tabela + '?select=*&' + filtroQuery + '&limit=1', {
    method: 'GET',
    headers: headersBase()
  });
  if (!r.ok) {
    const detalhe = await r.text();
    const err = new Error('supabase-select-falhou');
    err.status = r.status;
    err.detail = detalhe;
    throw err;
  }
  const dados = await r.json();
  return Array.isArray(dados) && dados.length ? dados[0] : null;
}

module.exports = { inserir, contar, buscarUm, remover, SUPABASE_URL };
