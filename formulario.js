/* ==========================================================
   MAD — formulario.js
   Lógica do formulário em 2 partes (sem DOM):
   - validação do que a pessoa preencheu;
   - montagem dos payloads (Parte 1 e Parte 2);
   - geração do lead_id que liga as duas partes.

   É carregado como script no site e também é importado pelos
   testes (Node), por isso não depende de DOM.
   ========================================================== */
(function (global) {
  'use strict';

  /* ---------- lead_id (uuid v4) ----------
     Gera no navegador e viaja para o banco (tabela leads).
     Serve para ligar a Parte 1 e a Parte 2 sem duplicar o lead. */
  function gerarLeadId() {
    const c = global.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();

    // Fallback para navegadores sem randomUUID
    const b = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(b);
    } else {
      for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    }
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.prototype.map.call(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
      h.slice(16, 20) + '-' + h.slice(20);
  }

  function texto(v) {
    return String(v == null ? '' : v).trim();
  }

  /* ---------- Parte 1: dados da empresa e do contato ---------- */
  function validarParte1(d) {
    const erros = [];
    d = d || {};

    if (!texto(d.nome)) erros.push('nome');
    if (!texto(d.empresa)) erros.push('empresa');
    if (!texto(d.whatsapp)) erros.push('whatsapp');
    if (!texto(d.instagram)) erros.push('instagram');
    if (d.consent !== true) erros.push('consent');

    return { ok: erros.length === 0, erros };
  }

  function montarPayloadParte1(d, leadId) {
    d = d || {};
    return {
      nome: texto(d.nome),
      empresa: texto(d.empresa),
      whatsapp: texto(d.whatsapp),
      instagram: texto(d.instagram),
      cidade: texto(d.cidade),
      investimento: texto(d.investimento),
      servico: texto(d.servico),
      lead_id: leadId
    };
  }

  /* ---------- Parte 2: dados do Instagram para a avaliação ---------- */
  function validarParte2(d) {
    const erros = [];
    d = d || {};

    if (!texto(d.seguidores)) erros.push('seguidores');
    if (!texto(d.posts)) erros.push('posts');
    if (!Array.isArray(d.conteudos) || !d.conteudos.length) erros.push('conteudos');
    if (!texto(d.engajamento)) erros.push('engajamento');
    if (!texto(d.frequenciaStories)) erros.push('frequenciaStories');
    if (!texto(d.linkBio)) erros.push('linkBio');
    if (!texto(d.bio)) erros.push('bio');
    if (texto(d.bio).length > 300) erros.push('bio');
    if (!texto(d.objetivo)) erros.push('objetivo');
    if (!texto(d.dificuldade)) erros.push('dificuldade');

    return { ok: erros.length === 0, erros };
  }

  function montarPayloadParte2(d, leadId) {
    d = d || {};
    return {
      lead_id: leadId,
      seguidores: texto(d.seguidores),
      posts: texto(d.posts),
      conteudos: (d.conteudos || []).map(texto).filter(Boolean),
      engajamento: texto(d.engajamento),
      frequenciaStories: texto(d.frequenciaStories),
      linkBio: texto(d.linkBio),
      bio: texto(d.bio).slice(0, 300),
      objetivo: texto(d.objetivo),
      dificuldade: texto(d.dificuldade)
    };
  }

  /* ---------- Parte 1: salva o lead no Supabase ----------
     O e-mail de aviso para a MAD é disparado pelo webhook do
     Supabase quando o registro entra na tabela "leads".

     Se o lead já foi salvo antes (a pessoa voltou para corrigir
     algo), o registro é atualizado no lugar — nunca duplicado.
     leadId anterior: '' quando é a primeira vez. */
  async function salvarLead(url, chave, dados, leadIdAnterior) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': chave,
      'Prefer': 'return=minimal'
    };

    if (leadIdAnterior && leadIdAnterior === dados.lead_id) {
      // atualiza o lead já existente (sem criar outro registro)
      const atualizou = await fetch(url + '/rest/v1/leads?lead_id=eq.' + encodeURIComponent(dados.lead_id), {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(dados)
      });
      if (atualizou.ok) return { criado: false };
      // sem permissão de update: tenta inserir (e trata o conflito como "já salvo")
    }

    const resposta = await fetch(url + '/rest/v1/leads', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(dados)
    });

    if (resposta.ok) return { criado: true };
    if (resposta.status === 409) return { criado: false };  // lead_id já existe

    const detalhe = await resposta.text();
    throw new Error('Erro ' + resposta.status + ': ' + detalhe);
  }

  /* ---------- Parte 2: pede o diagnóstico ---------- */
  async function enviarDiagnostico(payload) {
    const resposta = await fetch('/api/diagnostico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let json = {};
    try { json = await resposta.json(); } catch (e) { json = {}; }
    return { ok: resposta.ok, status: resposta.status, json: json };
  }

  const api = {
    gerarLeadId,
    salvarLead,
    enviarDiagnostico,
    validarParte1,
    montarPayloadParte1,
    validarParte2,
    montarPayloadParte2
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MADFormulario = api;

})(typeof window !== 'undefined' ? window : globalThis);
