/* ==========================================================
   MAD — script.js
   Formulário comercial simplificado (1 etapa), animações e carrossel.
   ========================================================== */

/* ---------- Configuração do Supabase ---------- */
const SUPABASE_URL = "https://utbiafditbvpsgpejmli.supabase.co";
const SUPABASE_KEY = "sb_publishable_vxN-iui3nbTm1kGxRMmI4Q_yKDwZWHP";

/* ---------- Animação de entrada ao rolar a página ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('show');
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));
document.documentElement.classList.add('js');

/* ---------- Envia o lead para o Supabase ---------- */
async function salvarLead(dados) {
  return MADFormulario.salvarLead(SUPABASE_URL, SUPABASE_KEY, dados);
}

/* ---------- Formulário simplificado (1 etapa) ---------- */
const form = document.getElementById('form');
const status = document.getElementById('status');
const msg = document.getElementById('msg');
const cartao = document.getElementById('diagnostico');
const btnEnviar = form.querySelector('button[type="submit"]');

let enviando = false; // proteção contra envio duplicado

function campo(id) { return document.getElementById(id); }

/* ---------- Coleta e valida dados do formulário ---------- */
function coletarDados() {
  const interesses = Array.from(form.querySelectorAll('input[name="interesses"]:checked')).map(cb => cb.value);

  return {
    nome: campo('nome').value,
    empresa: campo('empresa').value,
    whatsapp: campo('whats').value,
    instagram: campo('instagram').value,
    email: campo('email').value,
    investe_marketing: campo('investe_marketing').value,
    interesses: interesses,
    consent: campo('consent').checked,
    // honeypot
    website: form.querySelector('input[name="website"]').value
  };
}

/* ---------- Envio do formulário ---------- */
async function enviar() {
  if (enviando) return;
  enviando = true;

  // limpa avisos anteriores
  const avisoExistente = cartao.querySelector('.aviso-form');
  if (avisoExistente) avisoExistente.hidden = true;

  const dados = coletarDados();
  const check = MADFormulario.validar(dados);

  if (!check.ok) {
    // honeypot: simula sucesso, não envia
    if (check.erros.includes('honeypot')) {
      sucesso();
      enviando = false;
      return;
    }

    // consent não marcado
    if (check.erros.includes('consent')) {
      mostrarAviso('Você precisa autorizar o contato para enviar.');
    }
    // outros erros: o navegador mostra validação nativa (required, pattern, type="email")
    enviando = false;
    return;
  }

  const payload = MADFormulario.montarPayload(dados);

  const rotuloOriginal = btnEnviar.textContent;
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  try {
    await salvarLead(payload);
  } catch (erro) {
    console.error('erro ao salvar lead:', erro);
    btnEnviar.disabled = false;
    btnEnviar.textContent = rotuloOriginal;
    mostrarAviso('Não conseguimos salvar seus dados agora. Tente novamente em alguns segundos — se persistir, fale com a MAD no WhatsApp.');
    mostrarBotaoWhats(cartao);
    enviando = false;
    return;
  }

  btnEnviar.disabled = false;
  btnEnviar.textContent = rotuloOriginal;

  // Sucesso
  sucesso();
  enviando = false;
}

/* ---------- Tela de sucesso ---------- */
function sucesso() {
  form.style.display = 'none';
  status.hidden = false;
  status.classList.add('success');
  msg.innerHTML = `
    <h2>Enviado com sucesso!</h2>
    <p>Nossa equipe vai analisar seu perfil e entrar em contato pelo WhatsApp ou e-mail.</p>
    <div class="success-actions">
      <a href="https://wa.me/5512981156417?text=${encodeURIComponent('Olá! Preenchi o formulário no site da MAD e gostaria de falar com a equipe.')}" 
         target="_blank" rel="noopener noreferrer" class="btn btn-primary">Falar no WhatsApp →</a>
      <button class="btn btn-ghost" onclick="resetarFormulario()">Enviar outro</button>
    </div>
  `;
}

/* ---------- Reset do formulário ---------- */
function resetarFormulario() {
  form.reset();
  form.style.display = 'block';
  status.hidden = true;
  status.classList.remove('success');
  msg.innerHTML = '';
}

/* ---------- Avisos e botão WhatsApp ---------- */
function mostrarAviso(texto) {
  let aviso = cartao.querySelector('.aviso-form');
  if (!aviso) {
    aviso = document.createElement('p');
    aviso.className = 'aviso-form';
    cartao.appendChild(aviso);
  }
  aviso.textContent = texto;
  aviso.hidden = false;
}

function mostrarBotaoWhats(container) {
  const existente = container.querySelector('.wa-cta');
  if (existente) return;
  const a = document.createElement('a');
  a.href = 'https://wa.me/5512981156417?text=' + encodeURIComponent('Olá! Preenchi o formulário no site da MAD e gostaria de falar com a equipe.');
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'btn btn-primary wa-cta';
  a.style.marginTop = '12px';
  a.textContent = 'Falar com a MAD no WhatsApp →';
  container.appendChild(a);
}

/* ---------- Envio ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await enviar();
});

/* ---------- Normalização do Instagram: exibe @, remove espaços, normaliza @ duplicado ---------- */
const campoIg = document.getElementById('instagram');
campoIg.addEventListener('input', () => {
  let v = campoIg.value.trim().replace(/\s+/g, '');
  // remove @ duplicado do começo
  v = v.replace(/^@+/, '');
  if (v.length > 0) v = '@' + v;
  campoIg.value = v;
});

/* ---------- Máscara do WhatsApp: só números, formato (00) 00000-0000 ---------- */
const campoWhats = document.getElementById('whats');

campoWhats.addEventListener('input', () => {
  // Tira tudo que não for número e limita a 11 dígitos
  let n = campoWhats.value.replace(/\D/g, '').slice(0, 11);

  if (n.length > 10) {
    n = n.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (n.length > 6) {
    n = n.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
  } else if (n.length > 2) {
    n = n.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  } else if (n.length > 0) {
    n = '(' + n;
  }

  campoWhats.value = n;
});

/* ---------- Faixa de serviços: arrastar com o mouse ---------- */
const trilho = document.querySelector('.svc-grid');
let arrastando = false;
let inicioX = 0;
let scrollInicial = 0;

trilho.addEventListener('mousedown', (e) => {
  arrastando = true;
  trilho.classList.add('dragging');
  inicioX = e.pageX;
  scrollInicial = trilho.scrollLeft;
});

window.addEventListener('mouseup', () => {
  arrastando = false;
  trilho.classList.remove('dragging');
});

window.addEventListener('mousemove', (e) => {
  if (!arrastando) return;
  e.preventDefault();
  trilho.scrollLeft = scrollInicial - (e.pageX - inicioX);
});