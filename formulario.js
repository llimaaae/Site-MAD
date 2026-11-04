/* ==========================================================
   MAD — formulario.js
   Lógica do formulário comercial simplificado (1 etapa, sem DOM).
   - validação do que a pessoa preencheu;
   - montagem do payload para o Supabase.
   - honeypot anti-robô.

   É carregado como script no site e também é importado pelos
   testes (Node), por isso não depende de DOM.
   ========================================================== */
(function (global) {
  'use strict';

  function texto(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizarInstagram(v) {
    if (!v) return '';
    const s = String(v).trim().replace(/\s+/g, '');
    // remove @ duplicado
    const limpo = s.replace(/^@+/, '');
    return limpo.length > 0 ? '@' + limpo : '';
  }

  function validarEmail(v) {
    if (!v) return false;
    // RFC 5322 simplificado: local@domain.tld
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function validarWhatsApp(v) {
    if (!v) return false;
    const n = String(v).replace(/\D/g, '');
    return n.length === 10 || n.length === 11;
  }

  function validarInstagram(v) {
    if (!v) return false;
    const limpo = String(v).replace('@', '');
    return /^[A-Za-z0-9._]{1,30}$/.test(limpo);
  }

  const INVESTE_OPCOES = [
    'Ainda não invisto',
    'Invisto de vez em quando',
    'Invisto todo mês',
    'Prefiro conversar sobre isso'
  ];

  const INTERESSES_OPCOES = [
    'Site',
    'Tráfego orgânico',
    'Stories',
    'Carrosséis',
    'Tráfego pago',
    'Chatbot de WhatsApp'
  ];

  /* ---------- Validação do formulário simplificado ---------- */
  function validar(d) {
    const erros = [];
    d = d || {};

    if (!texto(d.nome) || texto(d.nome).length > 100) erros.push('nome');
    if (!texto(d.empresa) || texto(d.empresa).length > 100) erros.push('empresa');
    if (!validarWhatsApp(d.whatsapp)) erros.push('whatsapp');
    if (!validarInstagram(d.instagram)) erros.push('instagram');
    if (!validarEmail(d.email) || texto(d.email).length > 150) erros.push('email');
    if (!INVESTE_OPCOES.includes(texto(d.investe_marketing))) erros.push('investe_marketing');
    if (!Array.isArray(d.interesses) || d.interesses.length === 0 || !d.interesses.every(i => INTERESSES_OPCOES.includes(texto(i)))) erros.push('interesses');
    if (d.consent !== true) erros.push('consent');
    // honeypot: se preenchido, simula sucesso mas não envia
    if (texto(d.website)) erros.push('honeypot');

    return { ok: erros.length === 0, erros };
  }

  /* ---------- Monta payload para o Supabase (tabela leads) ---------- */
  function montarPayload(d) {
    d = d || {};
    return {
      nome: texto(d.nome).slice(0, 100),
      empresa: texto(d.empresa).slice(0, 100),
      whatsapp: texto(d.whatsapp).replace(/\D/g, '').slice(0, 11),
      instagram: normalizarInstagram(d.instagram).slice(0, 31), // @ + 30 chars
      email: texto(d.email).toLowerCase().slice(0, 150),
      investe_marketing: texto(d.investe_marketing),
      interesses: (d.interesses || []).map(texto).filter(Boolean)
    };
  }

  /* ---------- Salva lead no Supabase (INSERT anon) ---------- */
  async function salvarLead(url, chave, dados) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': chave,
      'Prefer': 'return=minimal'
    };

    const resposta = await fetch(url + '/rest/v1/leads', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(dados)
    });

    if (resposta.ok) return { criado: true };
    if (resposta.status === 409) return { criado: false }; // lead_id duplicado (não deve ocorrer)
    if (resposta.status === 42501) {
      const detalhe = await resposta.text();
      throw new Error('Permissão negada: ' + detalhe);
    }

    const detalhe = await resposta.text();
    throw new Error('Erro ' + resposta.status + ': ' + detalhe);
  }

  const api = {
    validar,
    montarPayload,
    salvarLead,
    normalizarInstagram,
    validarEmail,
    validarWhatsApp,
    validarInstagram,
    INVESTE_OPCOES,
    INTERESSES_OPCOES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MADFormulario = api;

})(typeof window !== 'undefined' ? window : globalThis);