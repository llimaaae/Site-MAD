/* ==========================================================
   MAD — api/chat.js
   Chat com IA: chamada direta à API da Anthropic (sem SDK),
   com streaming de texto puro, CORS, rate limit e validação.
   ========================================================== */

import { aplicarCors } from './_lib/cors.js';
import { SYSTEM_PROMPT } from '../lib/chatbot/system-prompt.js';

// Rate limit simples em memória (Map com TTL)
const rateLimitMap = new Map();
const LIMITE_POR_IP = 20; // mensagens por janela
const JANELA_MS = 3600000; // 1 hora

const MODELO_PADRAO = process.env.CHAT_MODEL || 'claude-sonnet-4-5';
const API_ANTHROPIC = 'https://api.anthropic.com/v1/messages';

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

export default async (req, res) => {
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
    // Só user/assistant: o system vem sempre do servidor, nunca do cliente
    if (msg.role !== 'user' && msg.role !== 'assistant') {
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
  const modelo = MODELO_PADRAO;

  try {
    const resposta = await fetch(API_ANTHROPIC, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: modelo,
        system: SYSTEM_PROMPT,
        max_tokens: 1024,
        temperature: 0.7,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    // Erro da Anthropic antes do streaming: devolve status amigável
    if (!resposta.ok || !resposta.body) {
      const detalhe = await resposta.text().catch(() => '');
      console.error('Anthropic respondeu', resposta.status, detalhe.slice(0, 500));

      if (resposta.status === 429) {
        return res.status(429).json({
          erro: 'ia-rate-limit',
          mensagem: 'A IA está com muitas solicitações agora. Tente novamente em alguns minutos.'
        });
      }
      if (resposta.status === 401 || resposta.status === 403) {
        return res.status(503).json({
          erro: 'chat-indisponivel',
          mensagem: 'Chat indisponível no momento. Fale com a MAD pelo WhatsApp (12) 98115-6417.'
        });
      }
      if (resposta.status === 404) {
        console.error('Modelo configurado não existe:', modelo);
        return res.status(503).json({
          erro: 'chat-indisponivel',
          mensagem: 'Chat em manutenção. Fale com a MAD pelo WhatsApp.'
        });
      }
      return res.status(500).json({
        erro: 'erro-interno',
        mensagem: 'Erro ao processar sua mensagem. Tente novamente.'
      });
    }

    // Streaming: lê o SSE da Anthropic e encaminha só o texto gerado
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.status(200);

    const reader = resposta.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split('\n');
      buffer = linhas.pop();

      for (const linha of linhas) {
        if (!linha.startsWith('data:')) continue;
        const dado = linha.slice(5).trim();
        if (!dado) continue;

        let evento;
        try {
          evento = JSON.parse(dado);
        } catch (e) {
          continue;
        }

        if (evento.type === 'content_block_delta' &&
            evento.delta &&
            evento.delta.type === 'text_delta' &&
            typeof evento.delta.text === 'string') {
          res.write(evento.delta.text);
        } else if (evento.type === 'error') {
          console.error('Anthropic errou no stream:',
            JSON.stringify(evento.error || evento).slice(0, 300));
          res.end();
          return;
        }
      }
    }

    res.end();

  } catch (erro) {
    console.error('Erro ao chamar Anthropic:', erro?.message || String(erro));

    // Erro antes de enviar cabeçalhos: responde JSON com status correto
    if (!res.headersSent) {
      return res.status(500).json({
        erro: 'erro-interno',
        mensagem: 'Erro ao processar sua mensagem. Tente novamente.'
      });
    }

    // Erro no meio do stream: encerra normalmente
    res.end();
  }
};
