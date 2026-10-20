/* ==========================================================
   MAD — tests/helpers/mock.js
   Dublês de fetch (Supabase, Groq e Resend) + req/res de
   serverless. Sem dependências externas.
   ========================================================== */
'use strict';

const SUPABASE = 'https://utbiafditbvpsgpejmli.supabase.co';

function jsonRes(status, body, headers) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: { get: (k) => (headers && headers[k] != null ? headers[k] : null) },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

/* Cria o dublê de fetch.
   estado = { leads, diagnosticos, analises, emails, groq, contarLog } */
function instalarFetch(estado) {
  const s = estado;

  s.leads = s.leads || [];
  s.diagnosticos = s.diagnosticos || [];
  s.analises = s.analises || [];
  s.emails = s.emails || [];
  s.groqChamadas = s.groqChamadas || [];
  s.contarLog = s.contarLog || 0;
  s.respostasGroq = s.respostasGroq || [respostaGroqValida()];

  global.fetch = async function (url, opts) {
    opts = opts || {};
    const u = String(url);
    const metodo = (opts.method || 'GET').toUpperCase();
    const corpo = opts.body ? JSON.parse(opts.body) : null;

    /* ---------- Groq ---------- */
    if (u.indexOf('api.groq.com') !== -1) {
      s.groqChamadas.push(corpo);
      const proxima = s.respostasGroq.length > 1 ? s.respostasGroq.shift() : s.respostasGroq[0];
      if (proxima && proxima.erro) return jsonRes(proxima.erro, { error: 'mock' });
      return jsonRes(200, { choices: [{ message: { content: proxima.conteudo } }] });
    }

    /* ---------- Resend ---------- */
    if (u.indexOf('api.resend.com') !== -1) {
      s.emails.push(corpo);
      if (s.falharEmail) return jsonRes(500, { message: 'mock: resend fora do ar' });
      return jsonRes(200, { id: 'mock-email' });
    }

    /* ---------- Supabase ---------- */
    if (u.indexOf(SUPABASE) === 0) {
      const semBase = u.slice(SUPABASE.length);
      const [caminho, consulta] = semBase.split('?');
      const tabela = caminho.replace('/rest/v1/', '');
      const filtros = parseFiltro(consulta || '');

      if (metodo === 'POST') {
        if (tabela === 'diagnosticos') {
          // simula a restrição de unicidade do banco
          if (corpo.lead_id && s.diagnosticos.some(d => d.lead_id === corpo.lead_id)) {
            return jsonRes(409, { message: 'duplicate key' });
          }
          if (corpo.token && s.diagnosticos.some(d => d.token === corpo.token)) {
            return jsonRes(409, { message: 'duplicate key' });
          }
          const linha = Object.assign({ created_at: new Date().toISOString() }, corpo);
          s.diagnosticos.push(linha);
          return jsonRes(201, linha, { 'content-range': '0-0/1' });
        }
        if (tabela === 'analises_log') {
          s.analises.push(Object.assign({ created_at: new Date().toISOString() }, corpo));
          return jsonRes(201, {}, { 'content-range': '0-0/1' });
        }
        if (tabela === 'leads') {
          s.leads.push(Object.assign({ created_at: new Date().toISOString() }, corpo));
          return jsonRes(201, corpo, { 'content-range': '0-0/1' });
        }
        return jsonRes(201, {});
      }

      if (metodo === 'PATCH') {
        let linhas = [];
        if (tabela === 'leads') linhas = s.leads;
        else if (tabela === 'diagnosticos') linhas = s.diagnosticos;
        const alvo = linhas.filter(l => Object.keys(filtros).every(k => {
          const v = filtros[k];
          if (v.eq != null) return String(l[k]) === String(v.eq);
          return true;
        }));
        if (!alvo.length) return jsonRes(404, { message: 'mock: nada para atualizar' });
        Object.assign(alvo[0], corpo);
        return jsonRes(200, alvo[0]);
      }

      if (metodo === 'GET') {
        if (tabela === 'analises_log') {
          const total = s.contarLog;
          return jsonRes(200, [], { 'content-range': '0-0/' + total });
        }
        let linhas = [];
        if (tabela === 'leads') linhas = s.leads;
        else if (tabela === 'diagnosticos') linhas = s.diagnosticos;
        linhas = linhas.filter(l => Object.keys(filtros).every(k => {
          const v = filtros[k];
          if (v.eq != null) return String(l[k]) === String(v.eq);
          return true;
        }));
        return jsonRes(200, linhas, { 'content-range': '0-' + Math.max(0, linhas.length - 1) + '/' + linhas.length });
      }

      if (metodo === 'DELETE') {
        let linhas = [];
        if (tabela === 'diagnosticos') linhas = s.diagnosticos;
        else if (tabela === 'analises_log') linhas = s.analises;
        const mantidas = linhas.filter(l => {
          for (const campo of Object.keys(filtros.lt)) {
            const limite = filtros.lt[campo];
            if (l[campo] != null && String(l[campo]) < limite) return false;
          }
          return true;
        });
        const apagadas = linhas.length - mantidas.length;
        if (tabela === 'diagnosticos') s.diagnosticos = mantidas;
        else if (tabela === 'analises_log') s.analises = mantidas;
        const resposta = linhas.filter(l => !mantidas.includes(l));
        return jsonRes(200, resposta, { 'content-range': '0-' + Math.max(0, apagadas - 1) + '/' + apagadas });
      }
    }

    return jsonRes(404, { message: 'mock: rota não encontrada' });
  };

  return s;
}

/* Interpreta filtros simples do PostgREST: campo=eq.valor, campo=lt.valor */
function parseFiltro(consulta) {
  const out = { lt: {} };
  if (!consulta) return out;
  for (const parte of consulta.split('&')) {
    const [campo, resto] = parte.split('=');
    if (!resto) continue;
    if (resto.indexOf('eq.') === 0) out[campo] = { eq: decodeURIComponent(resto.slice(3)) };
    else if (resto.indexOf('lt.') === 0) out.lt[campo] = decodeURIComponent(resto.slice(3));
  }
  return out;
}

function respostaGroqValida() {
  return {
    conteudo: JSON.stringify({
      nota_geral: 62,
      resumo: 'Perfil com boa base de conteúdo e.some pontos a ajustar.',
      pontos_fortes: ['Consistência', 'Bio clara', 'Reels regularly'],
      pontos_a_melhorar: ['Falta stories', 'Bio sem CTA', 'Poucos saves'],
      acoes_praticas: [
        { acao: 'Criar stories', prioridade: 'alta' },
        { acao: 'Ajustar bio', prioridade: 'media' },
        { acao: 'Reels', prioridade: 'baixa' }
      ],
      proximos_passos: [
        'Uma conversa para montar um plano para o seu caso',
        'Definir o calendário de conteúdo das próximas 4 semanas'
      ]
    })
  };
}

/* ---------- req/res de serverless ---------- */
function criarReq({ method = 'GET', headers = {}, query = {}, body = null } = {}) {
  return { method, headers, query, body };
}

function criarRes() {
  const res = {
    statusCode: 200,
    corpo: null,
    finalizado: false,
    setHeader(k, v) { res.headers[k] = v; },
    status(c) { res.statusCode = c; return res; },
    json(b) { res.corpo = b; res.finalizado = true; return res; },
    end() { res.finalizado = true; return res; }
  };
  res.headers = {};
  return res;
}

module.exports = {
  SUPABASE, instalarFetch, criarReq, criarRes, respostaGroqValida, jsonRes
};
