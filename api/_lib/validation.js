/* ============================================================
   MAD — /api/_lib/validation.js
   Validação e normalização de entrada e do JSON da IA.
   Reutilizável pelo chatbot no futuro.
   ============================================================ */
'use strict';

const MAX = {
  nome: 80, empresa: 120, whatsapp: 20, instagram: 40, cidade: 80,
  investimento: 60, servico: 60, seguidores: 40, posts: 40,
  bio: 300, objetivo: 80, email: 120
};

const SEGUIDORES_VALIDOS = [
  'Até 1.000', '1.000 a 5.000', '5.000 a 10.000',
  '10.000 a 50.000', 'Acima de 50.000'
];
const POSTS_VALIDOS = ['0 (não posta)', '1', '2-3', '4-6', '7 ou mais'];
const CONTEUDOS_VALIDOS = ['Reels', 'Carrosséis', 'Stories', 'Fotos', 'Lives', 'Anúncios'];
const OBJETIVOS_VALIDOS = [
  'Ganhar mais clientes', 'Aumentar seguidores', 'Vender online',
  'Autoridade no nicho', 'Reconhecimento da marca'
];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baixa'];

function limparTexto(v, max) {
  if (v == null) return '';
  return String(v).trim().replace(/\s+/g, ' ').slice(0, max);
}

function validarEntrada(body) {
  const campos = [];
  const b = body || {};

  const nome = limparTexto(b.nome, MAX.nome);
  const empresa = limparTexto(b.empresa, MAX.empresa);
  const whatsapp = limparTexto(b.whatsapp, MAX.whatsapp);
  const instagram = limparTexto(b.instagram, MAX.instagram).replace(/^@+/, '');
  const cidade = limparTexto(b.cidade, MAX.cidade);
  const investimento = limparTexto(b.investimento, MAX.investimento);
  const servico = limparTexto(b.servico, MAX.servico);

  const seguidores = limparTexto(b.seguidores, MAX.seguidores);
  const posts = limparTexto(b.posts, MAX.posts) || limparTexto(b.postsSemana, MAX.posts);
  const objetivo = limparTexto(b.objetivo, MAX.objetivo);
  const bio = String(b.bio || '').trim().slice(0, MAX.bio);
  const email = limparTexto(b.email, MAX.email).toLowerCase();

  const conteudos = Array.isArray(b.conteudos)
    ? b.conteudos.map(x => limparTexto(x, 40)).filter(Boolean)
    : [];
  const linkBioRaw = b.linkBio != null ? String(b.linkBio).toLowerCase() : '';
  const linkBio = linkBioRaw === 'true' || linkBioRaw === 'sim' || linkBioRaw === 'yes';

  if (!nome) campos.push('nome');
  if (!empresa) campos.push('empresa');
  if (!whatsapp) campos.push('whatsapp');
  if (!instagram) campos.push('instagram');
  if (SEGUIDORES_VALIDOS.indexOf(seguidores) === -1) campos.push('seguidores');
  if (POSTS_VALIDOS.indexOf(posts) === -1) campos.push('posts');
  if (!conteudos.length || conteudos.some(c => CONTEUDOS_VALIDOS.indexOf(c) === -1)) campos.push('conteudos');
  if (!bio) campos.push('bio');
  if (bio.length > MAX.bio) campos.push('bio');
  if (['sim', 'não', 'nao', 'true', 'false', ''].indexOf(linkBioRaw) === -1 && linkBioRaw !== 'yes' && linkBioRaw !== 'no') campos.push('linkBio');
  if (OBJETIVOS_VALIDOS.indexOf(objetivo) === -1) campos.push('objetivo');
  if (b.consent !== true && String(b.consent).toLowerCase() !== 'true' && String(b.consent) !== '1') campos.push('consent');

  if (campos.length) return { ok: false, campos };

  const dados = {
    nome, empresa, whatsapp, instagram: '@' + instagram.replace(/^@/, ''),
    cidade, investimento, servico,
    seguidores, posts, conteudos, bio, linkBio,
    objetivo, email: email || null
  };
  return { ok: true, dados };
}

function validarDiagnostico(obj) {
  const erros = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, erros: ['nao-objeto'] };
  }
  // nota_geral
  if (typeof obj.nota_geral !== 'number' || !Number.isFinite(obj.nota_geral)) erros.push('nota_geral');
  else if (obj.nota_geral < 0 || obj.nota_geral > 100) erros.push('nota_geral-range');
  // resumo
  if (typeof obj.resumo !== 'string' || !obj.resumo.trim()) erros.push('resumo');
  // arrays de 3
  function arrValido(arr, n) {
    return Array.isArray(arr) && arr.length === n && arr.every(x => typeof x === 'string' && x.trim());
  }
  if (!arrValido(obj.pontos_fortes, 3)) erros.push('pontos_fortes');
  if (!arrValido(obj.pontos_a_melhorar, 3)) erros.push('pontos_a_melhorar');
  // acoes_praticas 3 com prioridade
  if (!Array.isArray(obj.acoes_praticas) || obj.acoes_praticas.length !== 3) erros.push('acoes_praticas');
  else {
    for (const a of obj.acoes_praticas) {
      if (!a || typeof a !== 'object') { erros.push('acoes_praticas-item'); break; }
      if (typeof a.acao !== 'string' || !a.acao.trim()) { erros.push('acoes_praticas-acao'); break; }
      if (PRIORIDADES_VALIDAS.indexOf(a.prioridade) === -1) { erros.push('acoes_praticas-prioridade'); break; }
    }
  }
  // oportunidades 2-3
  if (!Array.isArray(obj.oportunidades_para_a_MAD)) erros.push('oportunidades');
  else if (obj.oportunidades_para_a_MAD.length < 2 || obj.oportunidades_para_a_MAD.length > 3) erros.push('oportunidades-count');
  else if (!obj.oportunidades_para_a_MAD.every(x => typeof x === 'string' && x.trim())) erros.push('oportunidades-item');

  if (erros.length) return { ok: false, erros };

  const dados = {
    nota_geral: Math.round(obj.nota_geral),
    resumo: obj.resumo.trim().slice(0, 1200),
    pontos_fortes: obj.pontos_fortes.map(s => s.trim().slice(0, 300)),
    pontos_a_melhorar: obj.pontos_a_melhorar.map(s => s.trim().slice(0, 300)),
    acoes_praticas: obj.acoes_praticas.map(a => ({
      acao: a.acao.trim().slice(0, 400),
      prioridade: a.prioridade
    })),
    oportunidades_para_a_MAD: obj.oportunidades_para_a_MAD.map(s => s.trim().slice(0, 400))
  };
  return { ok: true, dados };
}

function validarUuidV4(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function hashSha256(texto) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

module.exports = {
  MAX, SEGUIDORES_VALIDOS, POSTS_VALIDOS, CONTEUDOS_VALIDOS, OBJETIVOS_VALIDOS,
  limparTexto, validarEntrada, validarDiagnostico, validarUuidV4, hashSha256
};
