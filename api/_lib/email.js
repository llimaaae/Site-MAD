/* ============================================================
   MAD — api/_lib/email.js
   Envio de e-mail pelo Resend (usado no aviso de diagnóstico).
   Não usa SDK: só fetch. Nada de segredo no código — tudo vem
   de variáveis de ambiente da Vercel.
   ============================================================ */
'use strict';

const TIMEOUT_MS = 3000;   // o envio não pode segurar a função além do maxDuration
const REMETENTE_PADRAO = 'onboarding@resend.dev';

/* ---------- Escapa HTML ----------
   Impede que um campo do visitante vire código ou link malicioso no e-mail. */
function escaparHtml(valor) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, (c) => mapa[c]);
}

/* ---------- Links seguros ----------
   Só gera link se o conteúdo for exatamente o esperado. */
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

/* ---------- Envio ----------
   Nunca lança exceção: quem chama decide o que fazer se falhar.
   O log do servidor não recebe nenhum dado do visitante. */
async function enviarEmail({ assunto, html, texto }) {
  const key = process.env.RESEND_API_KEY;
  const para = process.env.LEAD_EMAIL;

  if (!key || !para) {
    console.error('envio-e-mail: faltam RESEND_API_KEY ou LEAD_EMAIL');
    return { ok: false, motivo: 'config' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || REMETENTE_PADRAO,
        to: [para],
        subject: String(assunto || '').replace(/[\r\n]+/g, ' ').slice(0, 120),
        html: String(html || ''),
        text: String(texto || '')
      }),
      signal: controller.signal
    });

    if (!resposta.ok) {
      console.error('envio-e-mail: resend respondeu', resposta.status);
      return { ok: false, motivo: 'resend' };
    }
    return { ok: true };
  } catch (e) {
    console.error('envio-e-mail: falha na chamada', e && e.name);
    return { ok: false, motivo: 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { enviarEmail, escaparHtml, linkWhats, linkPerfil, TIMEOUT_MS };
