/* ============================================================
   MAD — /api/_lib/groq.js
   Chamada à API da Groq (chat completions). Preparado para
   reuso pelo chatbot no futuro.
   ============================================================ */
'use strict';

const MODELO_PADRAO = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function chamarGroq({ system, user, model, maxTokens, temperature } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('groq-key-ausente');
    err.status = 500;
    throw err;
  }
  const m = model || MODELO_PADRAO;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: m,
      messages: [
        { role: 'system', content: String(system || '') },
        { role: 'user', content: String(user || '') }
      ],
      temperature: (typeof temperature === 'number') ? temperature : 0.4,
      max_tokens: (typeof maxTokens === 'number') ? maxTokens : 900,
      response_format: { type: 'json_object' }
    })
  });
  if (!r.ok) {
    const detalhe = await r.text();
    const err = new Error('groq-falhou');
    err.status = r.status;
    err.detail = String(detalhe).slice(0, 500);
    throw err;
  }
  const data = await r.json();
  const texto = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!texto) {
    const err = new Error('groq-vazio');
    err.status = 502;
    throw err;
  }
  return String(texto);
}

module.exports = { chamarGroq, MODELO_PADRAO };
