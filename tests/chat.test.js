/* ==========================================================
   MAD — tests/chat.test.js
   Testes da API de chat e validações.
   ========================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Mock simplificado do Vercel AI SDK
const mockStreamText = (shouldFail = false, statusCode = null) => {
  return {
    streamText: () => {
      if (shouldFail) {
        const err = new Error('Rate limit exceeded');
        err.status = statusCode || 429;
        throw err;
      }
      return {
        pipeDataStreamToResponse: (res) => {
          res.write('0:"Olá! "');
          res.write('0:"Sou o assistente da MAD."');
          res.end();
        }
      };
    }
  };
};

const { criarRes } = require('./helpers/mock');

// Helper para criar requisição no formato esperado pela API
function criarReq(metodo, url, body = null) {
  return {
    method: metodo,
    url,
    headers: {},
    body: body || {}
  };
}

// Testes de validação

test('POST /api/chat exige array messages', async () => {
  // Limpa cache do require para forçar recarga
  delete require.cache[require.resolve('../api/chat')];
  process.env.ANTHROPIC_API_KEY = 'sk-test-mock';
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('POST', '/api/chat', {});
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'messages-obrigatorio');
});

test('POST /api/chat rejeita messages vazio', async () => {
  delete require.cache[require.resolve('../api/chat')];
  process.env.ANTHROPIC_API_KEY = 'sk-test-mock';
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('POST', '/api/chat', { messages: [] });
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'messages-obrigatorio');
});

test('POST /api/chat rejeita mensagem sem role', async () => {
  delete require.cache[require.resolve('../api/chat')];
  process.env.ANTHROPIC_API_KEY = 'sk-test-mock';
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('POST', '/api/chat', { 
    messages: [{ content: 'teste' }] 
  });
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'formato-mensagem-invalido');
});

test('POST /api/chat rejeita mensagem sem content', async () => {
  delete require.cache[require.resolve('../api/chat')];
  process.env.ANTHROPIC_API_KEY = 'sk-test-mock';
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('POST', '/api/chat', { 
    messages: [{ role: 'user' }] 
  });
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'formato-mensagem-invalido');
});

test('POST /api/chat rejeita mensagem muito longa (>10k chars)', async () => {
  delete require.cache[require.resolve('../api/chat')];
  process.env.ANTHROPIC_API_KEY = 'sk-test-mock';
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('POST', '/api/chat', { 
    messages: [{ role: 'user', content: 'a'.repeat(10001) }] 
  });
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'mensagem-muito-longa');
});

test('POST /api/chat rejeita histórico com mais de 50 mensagens', async () => {
  delete require.cache[require.resolve('../api/chat')];
  process.env.ANTHROPIC_API_KEY = 'sk-test-mock';
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const messages = Array(51).fill(null).map(() => ({ 
    role: 'user', 
    content: 'teste' 
  }));
  const req = criarReq('POST', '/api/chat', { messages });
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.corpo.erro, 'historico-muito-longo');
});

test('POST /api/chat responde 503 se ANTHROPIC_API_KEY ausente', async () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete require.cache[require.resolve('../api/chat')];
  
  const module = await import('../api/chat.js?t=' + Date.now());
  const handler = module.default;
  const req = criarReq('POST', '/api/chat', { 
    messages: [{ role: 'user', content: 'Olá' }] 
  });
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.corpo.erro, 'chat-indisponivel');
  assert.match(res.corpo.mensagem, /temporariamente indisponível/i);
  
  // Restaura
  if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
});

test('POST /api/chat retorna 405 para GET', async () => {
  delete require.cache[require.resolve('../api/chat')];
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('GET', '/api/chat');
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 405);
  assert.ok(res.corpo && res.corpo.erro === 'Método não permitido');
});

test('OPTIONS /api/chat retorna 200', async () => {
  delete require.cache[require.resolve('../api/chat')];
  
  const module = await import('../api/chat.js');
  const handler = module.default;
  const req = criarReq('OPTIONS', '/api/chat');
  const res = criarRes();
  
  await handler(req, res);
  
  assert.strictEqual(res.statusCode, 200);
});

// Testes de conteúdo (system prompt e knowledge)

test('System prompt menciona MAD e sua função', () => {
  const { SYSTEM_PROMPT } = require('../lib/chatbot/system-prompt');
  
  assert.match(SYSTEM_PROMPT, /MAD/);
  assert.match(SYSTEM_PROMPT, /marketing digital/i);
  assert.match(SYSTEM_PROMPT, /base de conhecimento/i);
});

test('System prompt tem instruções anti-jailbreak', () => {
  const { SYSTEM_PROMPT } = require('../lib/chatbot/system-prompt');
  
  assert.match(SYSTEM_PROMPT, /NUNCA revele/i);
  assert.match(SYSTEM_PROMPT, /IGNORE/i);
  assert.match(SYSTEM_PROMPT, /jailbreak/i);
});

test('Knowledge menciona serviços da MAD', () => {
  const { CONHECIMENTO_MAD } = require('../lib/chatbot/knowledge');
  
  assert.match(CONHECIMENTO_MAD, /tráfego pago/i);
  assert.match(CONHECIMENTO_MAD, /redes sociais/i);
  assert.match(CONHECIMENTO_MAD, /Google Ads/i);
  assert.match(CONHECIMENTO_MAD, /Meta Ads/i);
});

test('Knowledge menciona planos (START, GROW, PERFORMANCE)', () => {
  const { CONHECIMENTO_MAD } = require('../lib/chatbot/knowledge');
  
  assert.match(CONHECIMENTO_MAD, /START/);
  assert.match(CONHECIMENTO_MAD, /GROW/);
  assert.match(CONHECIMENTO_MAD, /PERFORMANCE/);
});

test('Knowledge menciona diagnóstico gratuito', () => {
  const { CONHECIMENTO_MAD } = require('../lib/chatbot/knowledge');
  
  assert.match(CONHECIMENTO_MAD, /diagnóstico gratuito/i);
  assert.match(CONHECIMENTO_MAD, /2 etapas/i);
});

test('Knowledge menciona contato WhatsApp', () => {
  const { CONHECIMENTO_MAD } = require('../lib/chatbot/knowledge');
  
  assert.match(CONHECIMENTO_MAD, /\(12\) 98115-6417/);
});
