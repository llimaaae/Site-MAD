/* ==========================================================
   MAD — admin.js (painel de leads)
========================================================== */

const SUPABASE_URL = "https://utbiafditbvpsgpejmli.supabase.co";
const SUPABASE_KEY = "sb_publishable_vxN-iui3nbTm1kGxRMmI4Q_yKDwZWHP";

const STATUS = ['Novo', 'Contatado', 'Proposta', 'Cliente', 'Perdido'];

const loginBox = document.getElementById('login-box');
const painel = document.getElementById('painel');
const loginForm = document.getElementById('login-form');
const loginErro = document.getElementById('login-erro');
const corpo = document.getElementById('leads-body');
const vazio = document.getElementById('vazio');

let token = sessionStorage.getItem('mad_token');


/* ---------- Chamadas ao Supabase ---------- */

async function entrar(email, senha) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password: senha })
  });

  const dados = await r.json();
  if (!r.ok) {
    console.error('Erro de login:', r.status, dados);
    throw new Error(dados.error_description || dados.msg || dados.message || 'Falha no login');
  }
  return dados.access_token;
}

function api(caminho, opcoes = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      ...(opcoes.headers || {})
    }
  });
}


/* ---------- Telas ---------- */

function mostrarLogin() {
  token = null;
  sessionStorage.removeItem('mad_token');
  painel.hidden = true;
  loginBox.hidden = false;
}

function mostrarPainel() {
  loginBox.hidden = true;
  painel.hidden = false;
  carregarLeads();
}


/* ---------- Leads ---------- */

async function carregarLeads() {
  const r = await api('leads?select=*&order=created_at.desc');

  if (!r.ok) {
    const detalhe = await r.text();
    console.error('Erro ao carregar leads:', r.status, detalhe);
    mostrarLogin();
    loginErro.textContent = 'Erro ' + r.status + ': ' + detalhe;
    return;
  }

  const leads = await r.json();
  desenharTabela(leads);
}

function celula(texto) {
  const td = document.createElement('td');
  td.textContent = texto || '—';   // textContent evita injeção de código
  return td;
}

function celulaLink(texto, url) {
  const td = document.createElement('td');
  const a = document.createElement('a');
  a.textContent = texto;
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  td.appendChild(a);
  return td;
}

function desenharTabela(leads) {
  corpo.replaceChildren();
  vazio.hidden = leads.length > 0;

  for (const lead of leads) {
    const tr = document.createElement('tr');

    tr.appendChild(celula(new Date(lead.created_at).toLocaleString('pt-BR')));
    tr.appendChild(celula(lead.empresa));
    tr.appendChild(celula(lead.nome));

    // WhatsApp: abre a conversa
    let numero = (lead.whatsapp || '').replace(/\D/g, '');
    if (numero.length <= 11) numero = '55' + numero;
    tr.appendChild(celulaLink(lead.whatsapp, `https://wa.me/${numero}`));

    // Instagram: abre o perfil
    const perfil = (lead.instagram || '').replace('@', '').trim();
    tr.appendChild(celulaLink(lead.instagram, `https://instagram.com/${encodeURIComponent(perfil)}`));

    tr.appendChild(celula(lead.cidade));
    tr.appendChild(celula(lead.investimento));
    tr.appendChild(celula(lead.servico));

    // Status editável
    const tdStatus = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'admin-status';
    for (const s of STATUS) {
      const op = document.createElement('option');
      op.value = s;
      op.textContent = s;
      if (s === lead.status) op.selected = true;
      select.appendChild(op);
    }
    select.addEventListener('change', () => atualizarStatus(lead.id, select.value));
    tdStatus.appendChild(select);
    tr.appendChild(tdStatus);

    corpo.appendChild(tr);
  }

  document.getElementById('st-total').textContent = leads.length;
  document.getElementById('st-novos').textContent = leads.filter(l => l.status === 'Novo').length;
  document.getElementById('st-clientes').textContent = leads.filter(l => l.status === 'Cliente').length;
}

async function atualizarStatus(id, status) {
  const r = await api(`leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ status })
  });
  if (!r.ok) alert('Não foi possível salvar o status.');
  else carregarLeads();
}


/* ---------- Eventos ---------- */

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErro.textContent = '';
  try {
    token = await entrar(email.value.trim(), senha.value);
    sessionStorage.setItem('mad_token', token);
    mostrarPainel();
    } catch (erro) {
    loginErro.textContent = 'Erro: ' + erro.message;
  }
});

document.getElementById('sair').addEventListener('click', mostrarLogin);

// Se já havia sessão aberta nesta aba, entra direto
if (token) mostrarPainel();