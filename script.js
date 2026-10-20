/* ==========================================================
   MAD — script.js
   Formulário em 2 partes (mesmo cartão), animações e carrossel.
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


/* ---------- Envia o lead (Parte 1) para o Supabase ----------
   O e-mail de aviso para a MAD é disparado pelo webhook do
   Supabase quando o registro entra na tabela "leads".
   Se a pessoa voltou para corrigir a Parte 1, o lead é
   atualizado no lugar (nunca duplicado). */
async function salvarLead(dados, leadIdAnterior) {
  return MADFormulario.salvarLead(SUPABASE_URL, SUPABASE_KEY, dados, leadIdAnterior);
}


/* ---------- Formulário em 2 partes ---------- */
const form = document.getElementById('form');
const status = document.getElementById('status');
const msg = document.getElementById('msg');
const bar = document.getElementById('bar');

const passo1 = document.getElementById('passo1');
const passo2 = document.getElementById('passo2');
const progressoBarra = document.getElementById('progressoBarra');
const progressoTexto = document.getElementById('progressoTexto');
const btnParte1 = document.getElementById('btnParte1');
const btnParte2 = document.getElementById('btnParte2');
const btnVoltar = document.getElementById('btnVoltar');
const cartao = document.getElementById('diagnostico');

let leadId = null;      // liga a Parte 1 e a Parte 2
let passoAtual = 1;

function campo(id) { return document.getElementById(id); }

/* Mostra um dos passos e ajusta a barra de progresso */
function mostrarPasso(n) {
  passoAtual = n;
  passo1.hidden = n !== 1;
  passo2.hidden = n !== 2;

  progressoBarra.style.width = n === 1 ? '50%' : '100%';
  progressoTexto.textContent = 'Passo ' + n + ' de 2';

  // o navegador valida só os campos do passo visível
  passo1.querySelectorAll('[required]').forEach(el => { el.required = n === 1; });
  passo2.querySelectorAll('[required]').forEach(el => { el.required = n === 2; });

  if (n === 2) {
    if (cartao && typeof cartao.scrollIntoView === 'function') {
      cartao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const primeiro = campo('igSeg');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }
}

/* ---------- Parte 1: dados da empresa e do contato ---------- */
async function enviarParte1() {
  const dados = {
    nome: campo('nome').value.trim(),
    empresa: campo('empresa').value.trim(),
    whatsapp: campo('whats').value.trim(),
    instagram: campo('igPerfil').value.trim(),
    cidade: campo('cidade').value.trim(),
    investimento: campo('invest').value,
    servico: campo('servico').value,
    consent: campo('consent').checked
  };

  const check = MADFormulario.validarParte1(dados);
  if (!check.ok) {
    if (check.erros.indexOf('consent') !== -1) {
      alert('Você precisa concordar com a Política de Privacidade para continuar.');
    }
    return;   // campos vazios: o navegador mostra o aviso dele
  }

  // lead_id: um por lead. Se a pessoa voltou para corrigir a Parte 1,
  // o mesmo lead_id é reaproveitado (o registro é atualizado, não duplicado).
  if (!leadId) leadId = MADFormulario.gerarLeadId();
  const payload = MADFormulario.montarPayloadParte1(dados, leadId);

  const rotuloBotao = btnParte1.textContent;
  btnParte1.disabled = true;
  btnParte1.textContent = 'Enviando...';

  try {
    await salvarLead(payload, leadId);
  } catch (erro) {
    console.error('erro ao salvar lead:', erro);
    btnParte1.disabled = false;
    btnParte1.textContent = rotuloBotao;
    mostrarAviso('Não conseguimos salvar seus dados agora. Tente novamente em alguns segundos — se persistir, fale com a MAD no WhatsApp.');
    mostrarBotaoWhats(cartao);
    return;
  }

  btnParte1.disabled = false;
  btnParte1.textContent = rotuloBotao;

  // Lead salvo: a equipe já recebe o e-mail. Agora vai para a Parte 2.
  mostrarPasso(2);
}

/* ---------- Parte 2: dados do Instagram para a avaliação ---------- */
async function enviarParte2() {
  const dados = {
    seguidores: campo('igSeg').value,
    posts: campo('igPosts').value,
    conteudos: Array.from(document.querySelectorAll('input[name="igConteudo"]:checked')).map(cb => cb.value),
    engajamento: campo('igEng').value,
    frequenciaStories: campo('igFreq').value,
    linkBio: campo('igLink').value,
    bio: campo('igBio').value.trim(),
    objetivo: campo('igObj').value,
    dificuldade: campo('igDif').value
  };

  const check = MADFormulario.validarParte2(dados);
  if (!check.ok) {
    mostrarAviso('Revise as respostas antes de gerar o diagnóstico.');
    return;
  }

  const payload = MADFormulario.montarPayloadParte2(dados, leadId);

  // Tela "Analisando..."
  form.style.display = 'none';
  status.style.display = 'block';
  msg.textContent = 'Analisando...';
  bar.style.width = '30%';

  try {
    const resp = await MADFormulario.enviarDiagnostico(payload);
    const json = resp.json;

    if (resp.ok && json.id) {
      bar.style.width = '100%';
      msg.textContent = 'Diagnóstico pronto! Redirecionando...';
      setTimeout(() => { window.location.href = 'resultado.html?id=' + encodeURIComponent(json.id); }, 600);
      return;
    }

    // limite de análises
    if (resp.status === 429 && (json.erro === 'limite-excedido' || json.erro === 'ia-rate-limit')) {
      msg.textContent = json.erro === 'limite-excedido'
        ? 'Você já fez várias análises hoje. Fale com a MAD para continuar.'
        : 'A IA está com muitas solicitações agora. Tente novamente em alguns minutos.';
      bar.style.width = '0';
      mostrarBotaoWhats(status);
      return;
    }

    // diagnóstico já gerado para este lead
    if (resp.status === 409) {
      msg.textContent = 'Este diagnóstico já foi gerado. Fale com a MAD para receber o link novamente.';
      bar.style.width = '0';
      mostrarBotaoWhats(status);
      return;
    }

    if (resp.status === 400) {
      msg.textContent = json.erro === 'lead-invalido'
        ? 'Não encontramos seu cadastro. Volte e preencha o formulário de novo.'
        : 'Alguns campos precisam ser revisados. Volte e tente novamente.';
      bar.style.width = '0';
      mostrarBotaoVoltar(status);
      return;
    }

    msg.textContent = 'Ops, não conseguimos gerar seu diagnóstico agora. Fale com a MAD no WhatsApp.';
    bar.style.width = '0';
    mostrarBotaoWhats(status);

  } catch (erro) {
    console.error(erro);
    msg.textContent = 'Ops, algo deu errado. Tente novamente.';
    bar.style.width = '0';
    setTimeout(() => {
      status.style.display = 'none';
      form.style.display = 'block';
    }, 2500);
  }
}

/* ---------- Avisos dentro do cartão ---------- */
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
  a.href = 'https://wa.me/5512981156417?text=' + encodeURIComponent('Olá! Tentei gerar meu diagnóstico no site da MAD e preciso de ajuda.');
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'btn btn-primary wa-cta';
  a.style.marginTop = '12px';
  a.textContent = 'Falar com a MAD no WhatsApp →';
  container.appendChild(a);
}

function mostrarBotaoVoltar(container) {
  const existente = container.querySelector('.voltar-cta');
  if (existente) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-ghost voltar-cta';
  b.style.marginTop = '12px';
  b.textContent = '← Voltar e revisar as respostas';
  b.addEventListener('click', () => {
    container.style.display = 'none';
    form.style.display = 'block';
  });
  container.appendChild(b);
}

/* ---------- Envio ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const aviso = cartao.querySelector('.aviso-form');
  if (aviso) aviso.hidden = true;

  if (passoAtual === 1) await enviarParte1();
  else await enviarParte2();
});

btnVoltar.addEventListener('click', () => mostrarPasso(1));

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
