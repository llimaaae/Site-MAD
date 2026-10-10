/* ==========================================================
   MAD — api/notifica-lead.js  (função serverless da Vercel)

   Fluxo:
   1. O visitante preenche o formulário -> Supabase (INSERT na
      tabela "leads"). Isso já funciona, nada muda aqui.
   2. O Webhook do Supabase vê o INSERT e faz um POST para
      esta função.
   3. Esta função valida o segredo e envia o e-mail de aviso
      para o LEAD_EMAIL.

   Segurança:
   - O Webhook do Supabase envia o segredo no cabeçalho
     "x-webhook-secret" (em HTTP Headers, não em HTTP Parameters).
     Se ele não vier, aceita "Authorization: Bearer ..." como alternativa.
   - O segredo é comparado com sha256 + timingSafeEqual (sem vazar tempo).
   - Todo campo do lead passa por escape de HTML antes de entrar no e-mail.
   - Links de WhatsApp/Instagram só são criados se o dado for válido.

   Variáveis de ambiente (configuradas na Vercel, nunca no código):
   - WEBHOOK_SECRET : segredo combinado com o Webhook do Supabase
   - RESEND_API_KEY : chave da API do Resend
   - LEAD_EMAIL     : e-mail que recebe o aviso de lead novo
   - SITE_URL       : endereço do seu site (ex.: https://seu-site.vercel.app)
========================================================== */

const crypto = require('crypto');

const SECRET = process.env.WEBHOOK_SECRET;
const RESEND_KEY = process.env.RESEND_API_KEY;
const LEAD_EMAIL = process.env.LEAD_EMAIL;
const SITE_URL = process.env.SITE_URL;

// Se faltar alguma variável, avisa no log da Vercel (não exibe o valor)
if (!SECRET || !RESEND_KEY || !LEAD_EMAIL || !SITE_URL) {
  console.error('Faltou: WEBHOOK_SECRET, RESEND_API_KEY, LEAD_EMAIL ou SITE_URL');
}

/* ---------- Escapa HTML de qualquer campo ----------
   Impede que um campo do formulário vire código/link malicioso no e-mail. */
function escaparHtml(valor) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, (c) => mapa[c]);
}

/* ---------- Compara o segredo de forma segura ----------
   Usa hash + timingSafeEqual: a comparação sempre demora o mesmo tempo,
   então não "vaza" informação sobre o valor esperado. */
function segredoConfere(recebido) {
  if (!SECRET || !recebido) return false;
  const digA = crypto.createHash('sha256').update(SECRET).digest();
  const digB = crypto.createHash('sha256').update(String(recebido)).digest();
  return crypto.timingSafeEqual(digA, digB);
}

/* ---------- Links seguros ----------
   Só gera link se o conteúdo for exatamente o esperado.
   WhatsApp: apenas números, com ou sem +55 no começo (10 a 13 dígitos).
   Instagram: apenas letras, números, "_" e ".". */
function linkWhats(numero) {
  const soDigitos = String(numero || '').replace(/\D/g, '');
  if (!/^\d{10,13}$/.test(soDigitos)) return null;
  const completo = soDigitos.length <= 11 ? '55' + soDigitos : soDigitos;
  return 'https://wa.me/' + completo;
}

function linkPerfil(instagram) {
  const limpo = String(instagram || '').replace('@', '').trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(limpo)) return null;
  return 'https://instagram.com/' + limpo;
}

/* ---------- Assunto do e-mail sem quebra de linha ---------- */
function limparAssunto(texto) {
  return String(texto || '').replace(/[\r\n]+/g, ' ').slice(0, 80);
}

/* ---------- Resposta negada (genérica, não revela o motivo) ---------- */
function negar(res) {
  return res.status(401).json({ erro: 'nao-autorizado' });
}

module.exports = async (req, res) => {
  // 1) Só aceita POST
  if (req.method !== 'POST') return negar(res);

  // 2) Lê o segredo: primeiro do cabeçalho "x-webhook-secret" (valor puro);
  //    se não vier, usa o "Authorization: Bearer ..." como alternativa.
  const doCabecalho = (req.headers['x-webhook-secret'] || '').trim();
  const autorizacao = req.headers['authorization'] || '';
  const doAutorizacao = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7).trim() : '';
  const recebido = doCabecalho || doAutorizacao;
  if (!segredoConfere(recebido)) return negar(res);

  // 3) Confere que é um INSERT na tabela de leads
  const evento = req.body || {};
  if (evento.type !== 'INSERT' || evento.table !== 'leads') {
    return res.status(200).json({ ok: true });
  }

  const lead = evento.record || {};

  // 4) Links rápidos (ficam vazios se o dado for inválido)
  const whats = linkWhats(lead.whatsapp);
  const insta = linkPerfil(lead.instagram);
  const painel = SITE_URL + '/admin.html';

  // 5) Monta o corpo do e-mail — TODOS os campos passam por escaparHtml
  const linha = (label, valor) =>
    '<tr>' +
      '<td style="padding:6px 12px;color:#80C6FA;white-space:nowrap;">' + escaparHtml(label) + '</td>' +
      '<td style="padding:6px 12px;">' + escaparHtml(valor) + '</td>' +
    '</tr>';

  const links = [];
  if (whats) links.push('<a href="' + whats + '" style="color:#80C6FA;">WhatsApp</a>');
  if (insta) links.push('<a href="' + insta + '" style="color:#80C6FA;">Instagram</a>');
  links.push('<a href="' + painel + '" style="color:#009FE3;">Abrir painel de leads</a>');

  const html =
    '<div style="background:#0d1424;color:#ffffff;font-family:Arial,sans-serif;padding:24px;border-radius:12px;">' +
      '<h2 style="color:#009FE3;margin:0 0 16px;">Novo lead — Diagnóstico gratuito</h2>' +
      '<table style="font-size:14px;border-collapse:collapse;">' +
        linha('Nome', lead.nome) +
        linha('Empresa', lead.empresa) +
        linha('WhatsApp', lead.whatsapp) +
        linha('Instagram', lead.instagram) +
        linha('Cidade', lead.cidade) +
        linha('Investe em marketing', lead.investimento) +
        linha('O que procura', lead.servico) +
      '</table>' +
      '<p style="margin:16px 0 8px;font-size:14px;">' + links.join(' · ') + '</p>' +
    '</div>';

  const textoPuro =
    'Novo lead no site MAD\n\n' +
    'Nome: ' + (lead.nome || '—') + '\n' +
    'Empresa: ' + (lead.empresa || '—') + '\n' +
    'WhatsApp: ' + (lead.whatsapp || '—') + '\n' +
    'Instagram: ' + (lead.instagram || '—') + '\n' +
    'Cidade: ' + (lead.cidade || '—') + '\n' +
    'Investe em marketing: ' + (lead.investimento || '—') + '\n' +
    'O que procura: ' + (lead.servico || '—') + '\n\n' +
    (whats ? 'WhatsApp: ' + whats + '\n' : '') +
    (insta ? 'Instagram: ' + insta + '\n' : '') +
    'Painel de leads: ' + painel + '\n';

  // 6) Envia o e-mail pelo Resend (fetch nativo do Node, sem dependências)
  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RESEND_KEY
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', // provisório até verificar o domínio (passo 3)
        to: [LEAD_EMAIL],
        subject: 'Novo lead: ' + limparAssunto(lead.nome || lead.empresa),
        html: html,
        text: textoPuro
      })
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error('Resend falhou:', resposta.status, detalhe);
      return res.status(500).json({ erro: 'email-nao-enviado' });
    }
  } catch (erro) {
    console.error('Erro ao chamar o Resend:', erro.message);
    return res.status(500).json({ erro: 'email-nao-enviado' });
  }

  return res.status(200).json({ ok: true });
};