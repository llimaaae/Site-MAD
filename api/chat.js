/* ==========================================================
   MAD — api/chat.js
   Rota de chat com streaming via Vercel AI SDK + Anthropic.
   ========================================================== */

const { streamText } = require('ai');
const { anthropic } = require('@ai-sdk/anthropic');
const { aplicarCors } = require('./_lib/cors');
const { SYSTEM_PROMPT } = require('../lib/chatbot/system-prompt');

// Rate limit simples em memória (Map com TTL)
const rateLimitMap = new Map();
const LIMITE_POR_IP = 20; // mensagens por janela
const JANELA_MS = 3600000; // 1 hora

function limparExpirados() {
  const agora = Date.now();
  for (const [chave, dados] of rateLimitMap.entries()) {
    if (agora > dados.expira) rateLimitMap.delete(chave);
  }
}

function verificarRateLimit(ip) {
  limparExpirados();
  const agora = Date.now();
  const dados = rateLimitMap.get(ip);
  
  if (!dados) {
    rateLimitMap.set(ip, { count: 1, expira: agora + JANELA_MS });
    return { ok: true };
  }
  
  if (dados.count >= LIMITE_POR_IP) {
    return { ok: false, resetaEm: new Date(dados.expira).toISOString() };
  }
  
  dados.count++;
  return { ok: true };
}

function obterIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
}

module.exports = async (req, res) => {
  aplicarCors(req, res);
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  
  // Chave ausente = resposta educada (não quebra o site)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ 
      erro: 'chat-indisponivel',
      mensagem: 'O chat está temporariamente indisponível. Por favor, entre em contato pelo WhatsApp (12) 98115-6417 ou preencha o diagnóstico gratuito.'
    });
  }
  
  // Rate limit por IP
  const ip = obterIp(req);
  const rl = verificarRateLimit(ip);
  if (!rl.ok) {
    return res.status(429).json({ 
      erro: 'rate-limit',
      mensagem: 'Você fez muitas perguntas recentemente. Tente novamente mais tarde ou fale conosco pelo WhatsApp.',
      resetaEm: rl.resetaEm
    });
  }
  
  // Validação do payload
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ erro: 'payload-invalido' });
  }
  
  const { messages } = body;
  
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ erro: 'messages-obrigatorio' });
  }
  
  // Limita histórico (evita payloads gigantes)
  const MAX_MESSAGES = 50;
  const MAX_CONTENT_LENGTH = 10000;
  
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ 
      erro: 'historico-muito-longo',
      mensagem: 'Histórico de mensagens muito longo. Reinicie a conversa.' 
    });
  }
  
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      return res.status(400).json({ erro: 'formato-mensagem-invalido' });
    }
    if (msg.content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ 
        erro: 'mensagem-muito-longa',
        mensagem: 'Mensagem muito longa. Seja mais conciso.' 
      });
    }
  }
  
  // Modelo (variável de ambiente ou default)
  const modelo = process.env.CHAT_MODEL || 'claude-3-5-sonnet-20241022';
  
  try {
    const result = streamText({
      model: anthropic(modelo, { apiKey }),
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: 1024,
      temperature: 0.7,
    });
    
    // Retorna stream direto (Vercel AI SDK cuida do formato)
    result.pipeDataStreamToResponse(res);
    
  } catch (erro) {
    console.error('Erro ao chamar Anthropic:', erro);
    
    if (erro.message?.includes('rate limit') || erro.status === 429) {
      return res.status(429).json({ 
        erro: 'ia-rate-limit',
        mensagem: 'A IA está com muitas solicitações agora. Tente novamente em alguns minutos.' 
      });
    }
    
    if (erro.status === 401 || erro.message?.includes('authentication')) {
      return res.status(503).json({ 
        erro: 'chat-indisponivel',
        mensagem: 'Erro na configuração do chat. Entre em contato conosco.' 
      });
    }
    
    return res.status(500).json({ 
      erro: 'erro-interno',
      mensagem: 'Erro ao processar sua mensagem. Tente novamente.' 
    });
  }
};
