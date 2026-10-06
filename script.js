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

  // Pega o que a pessoa preencheu
  const dados = {
    nome: nome.value.trim(),
    empresa: empresa.value.trim(),
    whatsapp: whats.value.trim(),
    instagram: insta.value.trim(),
    cidade: cidade.value.trim(),
    investimento: invest.value,
    servico: servico.value
  };

  // Troca o formulário pela tela de "enviando"
  form.style.display = 'none';
  status.style.display = 'block';
  msg.textContent = 'Enviando...';
  setTimeout(() => bar.style.width = '100%', 50);

  try {
    await salvarLead(dados);

    msg.textContent = 'Dados salvos ✓';
    setTimeout(() => msg.textContent = 'Analisando presença digital...', 900);
    setTimeout(() => msg.textContent = 'Recebemos! A MAD entrará em contato em breve.', 1800);

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
