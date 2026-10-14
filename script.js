/* ==========================================================
   MAD — script.js
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
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error('Erro ' + resposta.status + ': ' + detalhe);
  }
}


/* ---------- Formulário ---------- */
const form = document.getElementById('form');
const status = document.getElementById('status');
const msg = document.getElementById('msg');
const bar = document.getElementById('bar');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Pega o que a pessoa preencheu (dados de contato)
  const conteudos = Array.from(document.querySelectorAll('input[name="igConteudo"]:checked')).map(cb => cb.value);

  const dados = {
    nome: nome.value.trim(),
    empresa: empresa.value.trim(),
    whatsapp: whats.value.trim(),
    instagram: igPerfil.value.trim(),
    cidade: cidade.value.trim(),
    investimento: invest.value,
    servico: servico.value
  };

  const payloadDiag = {
    nome: dados.nome,
    empresa: dados.empresa,
    whatsapp: dados.whatsapp,
    instagram: dados.instagram,
    cidade: dados.cidade,
    investimento: dados.investimento,
    servico: dados.servico,
    seguidores: igSeg.value,
    posts: igPosts.value,
    bio: igBio.value.trim(),
    conteudos: conteudos,
    linkBio: igLink.value,
    objetivo: igObj.value,
    consent: document.getElementById('consent').checked
  };

  // consentimento obrigatório
  if (!payloadDiag.consent) {
    alert('Você precisa concordar com a Política de Privacidade para continuar.');
    return;
  }

  // Troca o formulário pela tela de "analisando"
  form.style.display = 'none';
  status.style.display = 'block';
  msg.textContent = 'Enviando...';
  setTimeout(() => bar.style.width = '100%', 50);

  try {
    await salvarLead(dados);

    msg.textContent = 'Dados salvos ✓';
    await new Promise(r => setTimeout(r, 600));
    msg.textContent = 'Analisando presença digital...';
    bar.style.width = '30%';

    const resp = await fetch('/api/diagnostico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadDiag)
    });

    let json = {};
    try { json = await resp.json(); } catch (e) { json = {}; }

    if (resp.ok && json.id) {
      bar.style.width = '100%';
      msg.textContent = 'Diagnóstico pronto! Redirecionando...';
      setTimeout(() => { window.location.href = 'resultado.html?id=' + encodeURIComponent(json.id); }, 600);
      return;
    }

    // erro de limite de uso
    if (resp.status === 429 && (json.erro === 'limite-excedido' || json.erro === 'ia-rate-limit')) {
      const texto = json.erro === 'limite-excedido'
        ? 'Você já fez várias análises hoje. Fale com a MAD para continuar.'
        : 'A IA está com muitas solicitações agora. Tente novamente em alguns minutos.';
      msg.textContent = texto;
      bar.style.width = '0';
      mostrarBotaoWhats(status);
      return;
    }

    // dados inválidos
    if (resp.status === 400) {
      msg.textContent = 'Alguns campos precisam ser revisados. Volte e tente novamente.';
    } else {
      msg.textContent = 'Ops, não conseguimos gerar seu diagnóstico agora. Fale com a MAD no WhatsApp.';
    }
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
});

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