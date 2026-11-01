/* ==========================================================
   MAD — chatbot.js
   Widget de chat (botão flutuante + painel) e useChat hook.
   Carregado no site via <script src="chatbot.js"></script>
   ========================================================== */

(function() {
'use strict';

// ==================== useChat (hook inspirado no Vercel AI SDK) ====================
function useChat(config) {
  const apiUrl = config.api || '/api/chat';
  let messages = [];
  let isLoading = false;
  let error = null;
  const listeners = [];
  
  function notify() {
    listeners.forEach(fn => fn({ messages, isLoading, error }));
  }
  
  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }
  
  async function sendMessage(content) {
    if (!content.trim()) return;
    
    const userMessage = { role: 'user', content: content.trim(), id: Date.now() + '-user' };
    messages.push(userMessage);
    isLoading = true;
    error = null;
    notify();
    
    const assistantMessage = { role: 'assistant', content: '', id: Date.now() + '-assistant' };
    messages.push(assistantMessage);
    notify();
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
        })
      });
      
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.mensagem || json.erro || 'Erro ao enviar mensagem');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Resposta em texto puro: cada chunk é recebe o texto direto
        const chunk = decoder.decode(value, { stream: true });
        assistantMessage.content += chunk;
        notify();
      }
      
    } catch (e) {
      console.error('Erro no chat:', e);
      error = e.message;
      messages.pop(); // remove mensagem assistente vazia
    } finally {
      isLoading = false;
      notify();
    }
  }
  
  function reload() {
    if (messages.length > 0) {
      const lastUser = messages.slice().reverse().find(m => m.role === 'user');
      if (lastUser) sendMessage(lastUser.content);
    }
  }
  
  function clearMessages() {
    messages = [];
    isLoading = false;
    error = null;
    notify();
  }
  
  return { subscribe, sendMessage, reload, clearMessages };
}

// ==================== Componente do Chat ====================
function criarChatWidget() {
  const chat = useChat({ api: '/api/chat' });
  
  // Estilo inline (sem arquivo CSS externo)
  const style = document.createElement('style');
  style.textContent = `
    .mad-chat-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--blue, #009FE3);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 159, 227, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .mad-chat-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 159, 227, 0.4);
    }
    .mad-chat-fab:active {
      transform: scale(0.95);
    }
    .mad-chat-fab svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    .mad-chat-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 560px;
      max-height: calc(100vh - 140px);
      background: var(--navy-2, #0d1424);
      border: 1px solid var(--line, #1b2740);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      display: none;
      flex-direction: column;
      z-index: 9998;
      font-family: Inter, Arial, sans-serif;
      color: var(--white, #ffffff);
    }
    .mad-chat-panel.aberto {
      display: flex;
    }
    .mad-chat-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--line, #1b2740);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .mad-chat-header h3 {
      margin: 0;
      font-family: Montserrat, Arial, sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: var(--white, #ffffff);
    }
    .mad-chat-close {
      background: none;
      border: none;
      color: var(--muted, #9aa7bc);
      cursor: pointer;
      font-size: 24px;
      line-height: 1;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .mad-chat-close:hover {
      color: var(--white, #ffffff);
    }
    .mad-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .mad-chat-message {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .mad-chat-message.user {
      flex-direction: row-reverse;
    }
    .mad-chat-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
    }
    .mad-chat-message.user .mad-chat-avatar {
      background: var(--blue, #009FE3);
      color: white;
    }
    .mad-chat-message.assistant .mad-chat-avatar {
      background: var(--line, #1b2740);
      color: var(--light, #80C6FA);
    }
    .mad-chat-bubble {
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .mad-chat-message.user .mad-chat-bubble {
      background: var(--blue, #009FE3);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .mad-chat-message.assistant .mad-chat-bubble {
      background: var(--navy, #090D18);
      color: var(--white, #ffffff);
      border-bottom-left-radius: 4px;
    }
    .mad-chat-bubble p {
      margin: 0 0 8px 0;
    }
    .mad-chat-bubble p:last-child {
      margin-bottom: 0;
    }
    .mad-chat-bubble ul, .mad-chat-bubble ol {
      margin: 8px 0;
      padding-left: 20px;
    }
    .mad-chat-bubble li {
      margin: 4px 0;
    }
    .mad-chat-bubble strong {
      font-weight: 600;
    }
    .mad-chat-bubble a {
      color: var(--light, #80C6FA);
      text-decoration: underline;
    }
    .mad-chat-typing {
      display: flex;
      gap: 4px;
      padding: 8px 0;
    }
    .mad-chat-typing span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted, #9aa7bc);
      animation: mad-typing 1.4s infinite;
    }
    .mad-chat-typing span:nth-child(2) { animation-delay: 0.2s; }
    .mad-chat-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes mad-typing {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    .mad-chat-welcome {
      background: var(--navy, #090D18);
      padding: 16px;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      font-size: 14px;
      line-height: 1.5;
    }
    .mad-chat-welcome h4 {
      margin: 0 0 8px 0;
      font-family: Montserrat, Arial, sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--light, #80C6FA);
    }
    .mad-chat-welcome p {
      margin: 0 0 12px 0;
      color: var(--white, #ffffff);
    }
    .mad-chat-suggestions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .mad-chat-suggestion {
      background: transparent;
      border: 1px solid var(--line, #1b2740);
      color: var(--white, #ffffff);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .mad-chat-suggestion:hover {
      background: var(--navy-2, #0d1424);
      border-color: var(--blue, #009FE3);
    }
    .mad-chat-input-area {
      padding: 16px 20px;
      border-top: 1px solid var(--line, #1b2740);
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }
    .mad-chat-input {
      flex: 1;
      background: var(--navy, #090D18);
      border: 1px solid var(--line, #1b2740);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--white, #ffffff);
      font-family: Inter, Arial, sans-serif;
      font-size: 14px;
      resize: none;
      max-height: 100px;
      transition: border-color 0.2s;
    }
    .mad-chat-input:focus {
      outline: none;
      border-color: var(--blue, #009FE3);
    }
    .mad-chat-input::placeholder {
      color: var(--muted, #9aa7bc);
    }
    .mad-chat-send {
      background: var(--blue, #009FE3);
      border: none;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      padding: 10px 20px;
      cursor: pointer;
      transition: opacity 0.2s;
      white-space: nowrap;
    }
    .mad-chat-send:hover:not(:disabled) {
      opacity: 0.9;
    }
    .mad-chat-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .mad-chat-error {
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.3);
      color: #fca5a5;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mad-chat-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .mad-chat-action {
      background: transparent;
      border: 1px solid var(--line, #1b2740);
      color: var(--light, #80C6FA);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .mad-chat-action:hover {
      background: var(--navy-2, #0d1424);
    }
    @media (max-width: 640px) {
      .mad-chat-panel {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100vh;
        border-radius: 0;
      }
      .mad-chat-fab {
        bottom: 16px;
        right: 16px;
        width: 56px;
        height: 56px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mad-chat-fab,
      .mad-chat-suggestion,
      .mad-chat-action {
        transition: none;
      }
      @keyframes mad-typing {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    }
  `;
  document.head.appendChild(style);
  
  // Estrutura HTML
  const fab = document.createElement('button');
  fab.className = 'mad-chat-fab';
  fab.setAttribute('aria-label', 'Abrir chat');
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
  `;
  
  const panel = document.createElement('div');
  panel.className = 'mad-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat MAD');
  panel.innerHTML = `
    <div class="mad-chat-header">
      <h3>Chat MAD</h3>
      <button class="mad-chat-close" aria-label="Fechar chat">×</button>
    </div>
    <div class="mad-chat-messages" id="mad-chat-messages"></div>
    <div class="mad-chat-input-area">
      <textarea 
        class="mad-chat-input" 
        id="mad-chat-input"
        placeholder="Digite sua mensagem..."
        rows="1"
        aria-label="Mensagem"
      ></textarea>
      <button class="mad-chat-send" id="mad-chat-send">Enviar</button>
    </div>
  `;
  
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  
  const messagesContainer = document.getElementById('mad-chat-messages');
  const input = document.getElementById('mad-chat-input');
  const sendBtn = document.getElementById('mad-chat-send');
  const closeBtn = panel.querySelector('.mad-chat-close');
  
  // Persistência leve (sessionStorage)
  const STORAGE_KEY = 'mad_chat_history';
  function salvarHistorico(messages) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))); // últimas 20
    } catch (e) {}
  }
  
  function carregarHistorico() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
  
  // Renderização
  function renderMessages(state) {
    messagesContainer.innerHTML = '';
    
    if (state.messages.length === 0) {
      // Mensagem de boas-vindas
      const welcome = document.createElement('div');
      welcome.className = 'mad-chat-welcome';
      welcome.innerHTML = `
        <h4>👋 Olá! Sou o assistente da MAD.</h4>
        <p>Posso ajudar com informações sobre nossos serviços, planos e diagnóstico gratuito.</p>
        <div class="mad-chat-suggestions">
          <button class="mad-chat-suggestion">O que a MAD faz?</button>
          <button class="mad-chat-suggestion">Como funciona o diagnóstico gratuito?</button>
          <button class="mad-chat-suggestion">Quais são os planos?</button>
        </div>
      `;
      messagesContainer.appendChild(welcome);
      
      welcome.querySelectorAll('.mad-chat-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
          input.value = btn.textContent;
          input.focus();
          sendBtn.click();
        });
      });
    } else {
      state.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `mad-chat-message ${msg.role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'mad-chat-avatar';
        avatar.textContent = msg.role === 'user' ? 'V' : 'M';
        avatar.setAttribute('aria-hidden', 'true');
        
        const bubble = document.createElement('div');
        bubble.className = 'mad-chat-bubble';
        
        // Renderiza markdown básico (negrito, listas, links)
        let html = msg.content
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n- /g, '<li>')
          .replace(/\n\d+\. /g, '<li>')
          .replace(/<li>/g, '</p><ul><li>')
          .replace(/<\/li>(?!<li>)/g, '</li></ul><p>');
        
        if (!html.startsWith('<p>')) html = '<p>' + html;
        if (!html.endsWith('</p>')) html += '</p>';
        html = html.replace(/<p><\/p>/g, '');
        
        bubble.innerHTML = html;
        
        div.appendChild(avatar);
        div.appendChild(bubble);
        messagesContainer.appendChild(div);
      });
      
      if (state.isLoading) {
        const typing = document.createElement('div');
        typing.className = 'mad-chat-message assistant';
        typing.innerHTML = `
          <div class="mad-chat-avatar">M</div>
          <div class="mad-chat-bubble">
            <div class="mad-chat-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        `;
        messagesContainer.appendChild(typing);
      }
      
      if (state.error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mad-chat-error';
        errorDiv.innerHTML = `
          <span>⚠️</span>
          <div>
            ${state.error}
            <div class="mad-chat-actions">
              <button class="mad-chat-action" id="mad-chat-retry">Tentar novamente</button>
              <button class="mad-chat-action" id="mad-chat-clear">Limpar conversa</button>
            </div>
          </div>
        `;
        messagesContainer.appendChild(errorDiv);
        
        document.getElementById('mad-chat-retry')?.addEventListener('click', () => chat.reload());
        document.getElementById('mad-chat-clear')?.addEventListener('click', () => chat.clearMessages());
      }
    }
    
    // Auto-scroll
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Salva histórico
    salvarHistorico(state.messages);
  }
  
  // Estado e interação
  chat.subscribe(state => {
    renderMessages(state);
    sendBtn.disabled = state.isLoading;
  });
  
  function enviar() {
    const mensagem = input.value.trim();
    if (!mensagem) return;
    
    chat.sendMessage(mensagem);
    input.value = '';
    input.style.height = 'auto';
    input.focus();
  }
  
  sendBtn.addEventListener('click', enviar);
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });
  
  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
  
  // Abrir/fechar
  fab.addEventListener('click', () => {
    panel.classList.add('aberto');
    input.focus();
  });
  
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('aberto');
  });
  
  // ESC fecha
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('aberto')) {
      panel.classList.remove('aberto');
    }
  });
}

// Inicialização quando DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', criarChatWidget);
} else {
  criarChatWidget();
}

})();
