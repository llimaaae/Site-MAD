# Chatbot com IA — MAD

Chatbot integrado ao site da MAD usando Anthropic Claude via Vercel AI SDK.

## Arquivos Criados

### Backend
- **`api/chat.js`**: Rota serverless que recebe mensagens e retorna respostas em streaming.
- **`lib/chatbot/system-prompt.js`**: Persona, tom e regras do chatbot (português BR, anti-jailbreak).
- **`lib/chatbot/knowledge.js`**: Base de conhecimento extraída do site (serviços, planos, FAQs, contato).

### Frontend
- **`chatbot.js`**: Widget flutuante (botão + painel) e lógica de chat com streaming.
- **`index.html`** (editado): Carrega `chatbot.js` no final.

### Configuração
- **`package.json`**: Dependências `ai` e `@ai-sdk/anthropic` (versões atuais, sem vulnerabilidades).
- **`.env.example`**: Template das variáveis de ambiente (sem valores reais).
- **`.gitignore`** (editado): Garante que `.env*` (exceto `.env.example`) não vá para o Git.

### Testes
- **`tests/chat.test.js`**: 15 testes cobrindo validação, rate limit, erros e conteúdo.

---

## Variáveis de Ambiente (Vercel)

Configure em **Settings > Environment Variables** da Vercel:

1. **`ANTHROPIC_API_KEY`** (obrigatória)  
   Sua chave da API Anthropic. Obtenha em [console.anthropic.com](https://console.anthropic.com/).

2. **`CHAT_MODEL`** (opcional)  
   Modelo Claude a usar. Padrão: `claude-3-5-sonnet-20241022`.  
   Outros modelos: `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`.

**Aplique em:** Production, Preview e Development.

**Sem a chave:** O chat mostra mensagem educada ("chat indisponível, fale pelo WhatsApp") e o resto do site continua funcionando.

---

## Deploy na Vercel

1. **Adicione as variáveis** conforme acima.
2. **Redeploy** (Deployments > ⋯ > Redeploy, ou novo push no GitHub).
3. **Teste o chat** no site publicado:
   - Clique no botão azul (inferior direito).
   - Pergunte "O que a MAD faz?", "Quais são os planos?" ou "Como funciona o diagnóstico?".
   - Espere a resposta em streaming token a token.

---

## Como Testar Localmente

```bash
# 1. Instale dependências
npm install

# 2. Crie .env.local com sua chave
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
echo "CHAT_MODEL=claude-3-5-sonnet-20241022" >> .env.local

# 3. Rode com Vercel CLI
npx vercel dev

# 4. Abra http://localhost:3000 e clique no botão do chat
```

**Testes automatizados:**
```bash
npm test
```

---

## Como Editar a Base de Conhecimento

**Arquivo:** `lib/chatbot/knowledge.js`

Edite o conteúdo da constante `CONHECIMENTO_MAD` (formato Markdown). Depois:

```bash
git add lib/chatbot/knowledge.js
git commit -m "docs: atualiza base de conhecimento do chatbot"
git push origin main
```

A Vercel faz redeploy automático.

---

## Como Editar o System Prompt

**Arquivo:** `lib/chatbot/system-prompt.js`

Ajuste a persona, o tom ou as regras. Depois commit e push (igual acima).

---

## Segurança e Limites

- **Rate limit:** 20 mensagens por hora por IP (em memória, reseta a cada deploy).
- **Tamanho:** Máximo 50 mensagens no histórico, 10.000 caracteres por mensagem.
- **Anti-injection:** System prompt instrui o modelo a ignorar tentativas de jailbreak.
- **Graceful degradation:** Sem chave = erro 503 com mensagem amigável, site não quebra.
- **Dados sensíveis:** A chave NUNCA vai para o navegador (só usada no servidor).

---

## Visual

O widget segue a identidade visual MAD:
- **Cores:** Navy (`#090D18`, `#0d1424`), blue (`#009FE3`), light (`#80C6FA`), white.
- **Fontes:** Montserrat (títulos), Inter (textos).
- **Design:** Dark tech minimalista, sem gradientes em texto nem brilhos espalhados.
- **Responsivo:** Em mobile, o painel ocupa a tela toda.
- **Acessível:** aria-labels, navegação por teclado, respeita `prefers-reduced-motion`.

---

## Estrutura do Código

### Frontend (`chatbot.js`)

1. **`useChat`**: Hook inspirado no Vercel AI SDK, gerencia histórico, loading, erro e streaming.
2. **`criarChatWidget`**: Cria botão (FAB), painel, input, mensagens e sugestões rápidas.
3. **Renderização de markdown básico:** `**negrito**`, listas, links.
4. **Persistência:** `sessionStorage` guarda últimas 20 mensagens (não sobrevive ao fechar aba).

### Backend (`api/chat.js`)

1. **CORS** via `aplicarCors` (já existente no projeto).
2. **Validação** do payload (mensagens obrigatórias, formato correto, tamanho).
3. **Rate limit** em memória (Map com TTL de 1 hora).
4. **Streaming** via `streamText` do Vercel AI SDK (retorna tokens conforme a IA gera).

---

## Troubleshooting

**Chat não aparece no site:**
- Confirme que `chatbot.js` está carregado: inspecione o HTML (`<script src="chatbot.js">`).
- Verifique o console do navegador por erros.

**Chat mostra "indisponível":**
- `ANTHROPIC_API_KEY` ausente ou inválida na Vercel.
- Chave expirada ou sem créditos ([console.anthropic.com](https://console.anthropic.com/)).

**Erro 429 (rate limit):**
- Usuário fez muitas perguntas (20/hora). Espere ou aumente o limite em `api/chat.js` (linha 13).
- IA da Anthropic com rate limit: aparece mensagem específica, tente em alguns minutos.

**Respostas lentas:**
- Normal: o streaming leva ~2-5s para começar, depois tokens chegam rápido.
- Se persistir: teste o modelo diretamente no [console da Anthropic](https://console.anthropic.com/workbench).

---

## Próximos Passos (Opcional)

- **Métricas:** Logar perguntas frequentes para melhorar a base de conhecimento.
- **Feedback:** Botão de 👍/👎 nas respostas para avaliar qualidade.
- **Histórico persistente:** Trocar `sessionStorage` por um banco (Supabase) se precisar.
- **Rate limit distribuído:** Usar Vercel KV ou Upstash Redis no lugar de Map em memória.

---

**Commit:** `1fa2f0d` (feat: adiciona chatbot com IA)  
**Repositório:** [https://github.com/llimaaae/Site-MAD](https://github.com/llimaaae/Site-MAD)
