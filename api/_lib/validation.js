/* ============================================================
   MAD — api/_lib/validation.js
   Validação e normalização:
   - Parte 2 do formulário (dados do Instagram para a avaliação)
   - JSON devolvido pela IA (schema fixo)
   - formato dos identificadores (lead_id e token público)
   ============================================================ */
'use strict';

const MAX = {
  nome: 80, empresa: 120, whatsapp: 20, instagram: 40, cidade: 80,
  investimento: 60, servico: 60, seguidores: 40, posts: 40,
  engajamento: 40, frequencia_stories: 40, bio: 300, objetivo: 80,
  dificuldade: 120
};

const SEGUIDORES_VALIDOS = [
  'Até 1.000', '1.000 a 5.000', '5.000 a 10.000',
  '10.000 a 50.000', 'Acima de 50.000'
];
const POSTS_VALIDOS = ['Não posto com regularidade', '1', '2-3', '4-6', '7 ou mais'];
const CONTEUDOS_VALIDOS = ['Reels', 'Carrosséis', 'Stories', 'Fotos', 'Lives', 'Anúncios'];
const ENGAJAMENTO_VALIDOS = ['Alto', 'Médio', 'Baixo', 'Não sei'];
const FREQUENCIA_STORIES_VALIDOS = [
  'Todos os dias', '3 a 5 vezes por semana', '1 a 2 vezes por semana',
  'Raramente', 'Não sei / varia muito'
];
const OBJETIVOS_VALIDOS = [
  'Ganhar mais clientes', 'Aumentar seguidores', 'Vender online',
  'Autoridade no nicho', 'Reconhecimento da marca'
];
const DIFICULDADES_VALIDOS = [
  'Gerar conteúdo com consistência',
  'Ganhar mais clientes',
  'Vender mais pelo Instagram',
  'Crescer nas buscas (Google)',
  'Criar uma identidade visual forte',
  'Melhorar anúncios e campanhas',
  'Organizar tempo e rotina',
  'Não sei / quero explicar na conversa'
];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baixa'];

function limparTexto(v, max) {
  if (v == null) return '';
  return String(v).trim().replace(/\s+/g, ' ').slice(0, max);
}

/* Normaliza texto (sem acentos, minúsculo) para comparar "Não sei" etc. */
function normalizar(v) {
  return String(v == null ? '' : v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* "Não sei" = informação ausente. A IA não deve inventar número
   para esse campo; deve dizer que não dá para avaliar e sugerir como medir. */
function ehDesconhecido(valor) {
  const n = normalizar(valor);
  return n.indexOf('nao sei') !== -1 || n.indexOf('varia muito') !== -1;
}

/* ============================================================
   Parte 2 do formulário
   ============================================================ */
function validarParte2(body) {
  const campos = [];
  const b = body || {};

  const seguidores = limparTexto(b.seguidores, MAX.seguidores);
  const posts = limparTexto(b.posts, MAX.posts);
  const engajamento = limparTexto(b.engajamento, MAX.engajamento);
  const frequenciaStories = limparTexto(b.frequenciaStories, MAX.frequencia_stories);
  const objetivo = limparTexto(b.objetivo, MAX.objetivo);
  const dificuldade = limparTexto(b.dificuldade, MAX.dificuldade);
  const bio = String(b.bio || '').trim().slice(0, MAX.bio);

  const conteudos = Array.isArray(b.conteudos)
    ? b.conteudos.map(x => limparTexto(x, 40)).filter(Boolean)
    : [];

  const linkBioRaw = b.linkBio != null ? String(b.linkBio).toLowerCase() : '';
  const linkBio = linkBioRaw === 'true' || linkBioRaw === 'sim' || linkBioRaw === 'yes';

  if (SEGUIDORES_VALIDOS.indexOf(seguidores) === -1) campos.push('seguidores');
  if (POSTS_VALIDOS.indexOf(posts) === -1) campos.push('posts');
  if (!conteudos.length || conteudos.some(c => CONTEUDOS_VALIDOS.indexOf(c) === -1)) campos.push('conteudos');
  if (ENGAJAMENTO_VALIDOS.indexOf(engajamento) === -1) campos.push('engajamento');
  if (FREQUENCIA_STORIES_VALIDOS.indexOf(frequenciaStories) === -1) campos.push('frequenciaStories');
  if (['sim', 'não', 'nao', 'true', 'false', ''].indexOf(linkBioRaw) === -1
    && linkBioRaw !== 'yes' && linkBioRaw !== 'no') campos.push('linkBio');
  if (!bio) campos.push('bio');
  if (bio.length > MAX.bio) campos.push('bio');
  if (OBJETIVOS_VALIDOS.indexOf(objetivo) === -1) campos.push('objetivo');
  if (DIFICULDADES_VALIDOS.indexOf(dificuldade) === -1) campos.push('dificuldade');

  if (campos.length) return { ok: false, campos };

  // campos que a pessoa não sabe responder (informação ausente)
  const faltando = [];
  if (ehDesconhecido(engajamento)) faltando.push('engajamento');
  if (ehDesconhecido(frequenciaStories)) faltando.push('frequenciaStories');
  if (ehDesconhecido(dificuldade)) faltando.push('dificuldade');

  return {
    ok: true,
    dados: {
      seguidores, posts, conteudos, engajamento, frequenciaStories,
      linkBio, bio, objetivo, dificuldade, faltando
    }
  };
}

/* ============================================================
   JSON devolvido pela IA (schema fixo)
   ============================================================ */
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

  function arrValido(arr, n) {
    return Array.isArray(arr) && arr.length === n && arr.every(x => typeof x === 'string' && x.trim());
  }
  if (!arrValido(obj.pontos_fortes, 3)) erros.push('pontos_fortes');
  if (!arrValido(obj.pontos_a_melhorar, 3)) erros.push('pontos_a_melhorar');

  // acoes_praticas: 3 itens com prioridade
  if (!Array.isArray(obj.acoes_praticas) || obj.acoes_praticas.length !== 3) erros.push('acoes_praticas');
  else {
    for (const a of obj.acoes_praticas) {
      if (!a || typeof a !== 'object') { erros.push('acoes_praticas-item'); break; }
      if (typeof a.acao !== 'string' || !a.acao.trim()) { erros.push('acoes_praticas-acao'); break; }
      if (PRIORIDADES_VALIDAS.indexOf(a.prioridade) === -1) { erros.push('acoes_praticas-prioridade'); break; }
    }
  }

  // proximos_passos: 2 ou 3 itens.
  // Compatibilidade: respostas antigas podem vir em "oportunidades_para_a_MAD".
  let passos = obj.proximos_passos;
  if (!Array.isArray(passos) && Array.isArray(obj.oportunidades_para_a_MAD)) {
    passos = obj.oportunidades_para_a_MAD;
  }
  if (!Array.isArray(passos)) erros.push('proximos_passos');
  else if (passos.length < 2 || passos.length > 3) erros.push('proximos_passos-count');
  else if (!passos.every(x => typeof x === 'string' && x.trim())) erros.push('proximos_passos-item');

  if (erros.length) return { ok: false, erros };

  return {
    ok: true,
    dados: {
      nota_geral: Math.round(obj.nota_geral),
      resumo: obj.resumo.trim().slice(0, 1200),
      pontos_fortes: obj.pontos_fortes.map(s => s.trim().slice(0, 300)),
      pontos_a_melhorar: obj.pontos_a_melhorar.map(s => s.trim().slice(0, 300)),
      acoes_praticas: obj.acoes_praticas.map(a => ({
        acao: a.acao.trim().slice(0, 400),
        prioridade: a.prioridade
      })),
      proximos_passos: passos.map(s => s.trim().slice(0, 400))
    }
  };
}

/* ============================================================
   Identificadores
   ============================================================ */

/* lead_id: uuid v4 gerado no navegador */
function validarUuidV4(str) {
  return typeof str === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/* token público do resultado: base64url aleatório (32 a 64 caracteres).
   Aceita também uuid v4 (links gerados antes desta versão). */
function validarTokenPublico(str) {
  if (typeof str !== 'string') return false;
  if (/^[A-Za-z0-9_-]{32,64}$/.test(str)) return true;
  return validarUuidV4(str);
}

function hashSha256(texto) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

module.exports = {
  MAX,
  SEGUIDORES_VALIDOS, POSTS_VALIDOS, CONTEUDOS_VALIDOS,
  ENGAJAMENTO_VALIDOS, FREQUENCIA_STORIES_VALIDOS,
  OBJETIVOS_VALIDOS, DIFICULDADES_VALIDOS,
  limparTexto, normalizar, ehDesconhecido,
  validarParte2, validarDiagnostico,
  validarUuidV4, validarTokenPublico, hashSha256
};
