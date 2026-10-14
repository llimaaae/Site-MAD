/* ==========================================================
   MAD — resultado.js
   Página resultado.html?id=...
   ========================================================== */
const WA_MAD = '5512981156417';

const app = document.getElementById('app');

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function txt(parent, tag, texto, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.textContent = texto;
  parent.appendChild(e);
  return e;
}

function waLink(handle) {
  const msg = 'Olá! Fiz o diagnóstico do meu Instagram (' + (handle || '') + ') no site da MAD e gostaria de conversar.';
  return 'https://wa.me/' + WA_MAD + '?text=' + encodeURIComponent(msg);
}

function li(parent, texto) {
  const e = document.createElement('li');
  e.textContent = texto;
  parent.appendChild(e);
}

function blocoLista(titulo, itens) {
  const card = el('div', 'res-card');
  txt(card, 'h3', titulo);
  if (!Array.isArray(itens) || !itens.length) return card;
  const ul = el('ul', 'lista');
  for (const i of itens) li(ul, String(i));
  card.appendChild(ul);
  return card;
}

async function carregar() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { app.textContent = 'Link inválido.'; return; }

  try {
    const r = await fetch('/api/resultado?id=' + encodeURIComponent(id));
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      app.replaceChildren();
      const p = el('p', 'err');
      p.textContent = j.erro === 'nao-encontrado' ? 'Diagnóstico não encontrado.' : 'Não foi possível carregar o diagnóstico.';
      app.appendChild(p);
      return;
    }
    const d = await r.json();
    render(d);
  } catch (e) {
    console.error(e);
    app.textContent = 'Erro ao carregar. Tente novamente.';
  }
}

function render(d) {
  app.replaceChildren();

  // Botão WhatsApp no topo
  const topBar = el('div', 'btn-row');
  const waTop = el('a', 'btn btn-primary');
  waTop.href = waLink(d.instagram);
  waTop.target = '_blank';
  waTop.rel = 'noopener noreferrer';
  waTop.textContent = 'Falar com a MAD no WhatsApp →';
  topBar.appendChild(waTop);
  const pdfBtn = el('button', 'btn btn-ghost');
  pdfBtn.type = 'button';
  pdfBtn.textContent = 'Baixar PDF';
  pdfBtn.addEventListener('click', () => baixarPdf(d));
  topBar.appendChild(pdfBtn);
  app.appendChild(topBar);

  // Nota + resumo
  const card = el('div', 'res-card');
  const notaWrap = el('div', 'nota-wrap');
  const nota = el('span', 'nota');
  nota.textContent = d.nota_geral != null ? d.nota_geral : '—';
  notaWrap.appendChild(nota);
  const lbl = el('span', 'nota-label');
  lbl.textContent = 'Nota geral (0-100)';
  notaWrap.appendChild(lbl);
  card.appendChild(notaWrap);
  if (d.nome || d.instagram) {
    const sub = el('p');
    sub.textContent = [d.nome, d.instagram].filter(Boolean).join(' · ');
    card.appendChild(sub);
  }
  if (d.resumo) {
    const p = el('p');
    p.textContent = d.resumo;
    card.appendChild(p);
  }
  app.appendChild(card);

  // Aviso
  const aviso = el('div', 'aviso');
  aviso.textContent = 'Prévia baseada nas informações que você nos passou. Não é uma auditoria completa do perfil.';
  app.appendChild(aviso);

  app.appendChild(blocoLista('Pontos fortes', d.pontos_fortes));

  app.appendChild(blocoLista('Pontos a melhorar', d.pontos_a_melhorar));

  // ações práticas
  if (Array.isArray(d.acoes_praticas) && d.acoes_praticas.length) {
    const cardA = el('div', 'res-card');
    txt(cardA, 'h3', 'Ações práticas');
    for (const a of d.acoes_praticas) {
      const div = el('div', 'acao');
      const p = el('p');
      p.textContent = a.acao;
      const prio = el('span', 'prio ' + (a.prioridade || ''));
      prio.textContent = a.prioridade;
      p.appendChild(prio);
      div.appendChild(p);
      cardA.appendChild(div);
    }
    app.appendChild(cardA);
  }

  if (Array.isArray(d.oportunidades_para_a_MAD) && d.oportunidades_para_a_MAD.length) {
    app.appendChild(blocoLista('Oportunidades para a MAD', d.oportunidades_para_a_MAD));
  }

  // botão WhatsApp no fim
  const bottom = el('div', 'btn-row center');
  const waBot = el('a', 'btn btn-primary');
  waBot.href = waLink(d.instagram);
  waBot.target = '_blank';
  waBot.rel = 'noopener noreferrer';
  waBot.textContent = 'Falar com a MAD no WhatsApp →';
  bottom.appendChild(waBot);
  const pdfBot = el('button', 'btn btn-ghost');
  pdfBot.type = 'button';
  pdfBot.textContent = 'Baixar PDF';
  pdfBot.addEventListener('click', () => baixarPdf(d));
  bottom.appendChild(pdfBot);
  app.appendChild(bottom);

  // data
  const rod = el('p', 'center');
  rod.style.fontSize = '12px';
  rod.style.color = 'rgba(255,255,255,.5)';
  rod.textContent = 'Gerado em ' + new Date(d.created_at || Date.now()).toLocaleString('pt-BR');
  app.appendChild(rod);
}

function baixarPdf(d) {
  if (!window.jspdf) { alert('PDF indisponível agora.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const azul = [0, 159, 227];
  const azulClaro = [128, 198, 250];
  const escuro = [9, 13, 24];

  // cabeçalho
  doc.setFillColor(...escuro);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(...azul);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MAD — Diagnóstico de Instagram', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(...azulClaro);
  doc.text('Prévia baseada nas informações fornecidas. Não é auditoria completa.', 14, 24);

  let y = 40;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Cliente: ' + (d.nome || '—'), 14, y); y += 6;
  doc.text('Instagram: ' + (d.instagram || '—'), 14, y); y += 6;
  doc.text('Data: ' + new Date(d.created_at || Date.now()).toLocaleString('pt-BR'), 14, y); y += 10;

  doc.setFontSize(30);
  doc.setTextColor(...azul);
  doc.text('Nota geral: ' + (d.nota_geral != null ? d.nota_geral : '—') + ' / 100', 14, y);
  y += 10;

  function secao(titulo, linhas) {
    if (y > 270) { doc.addPage(); doc.setFillColor(...escuro); doc.rect(0,0,210,297,'F'); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...azul);
    doc.text(titulo, 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    for (const l of linhas) {
      const parts = doc.splitTextToSize('• ' + l, 182);
      for (const part of parts) {
        if (y > 282) { doc.addPage(); doc.setFillColor(...escuro); doc.rect(0,0,210,297,'F'); y = 20; }
        doc.text(part, 14, y); y += 5.2;
      }
    }
    y += 3;
  }

  if (d.resumo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...azul);
    doc.text('Resumo', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(255,255,255);
    const parts = doc.splitTextToSize(d.resumo, 182);
    for (const p of parts) { if (y > 282) { doc.addPage(); doc.setFillColor(...escuro); doc.rect(0,0,210,297,'F'); y = 20; } doc.text(p,14,y); y+=5.2; }
    y += 3;
  }

  secao('Pontos fortes', d.pontos_fortes || []);
  secao('Pontos a melhorar', d.pontos_a_melhorar || []);

  if (Array.isArray(d.acoes_praticas)) {
    const linhas = d.acoes_praticas.map(a => (a.acao || '') + ' (prioridade: ' + (a.prioridade || '-') + ')');
    secao('Ações práticas', linhas);
  }
  if (Array.isArray(d.oportunidades_para_a_MAD)) {
    secao('Oportunidades para a MAD', d.oportunidades_para_a_MAD);
  }

  // rodapé
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(...azulClaro);
    doc.text('Contato: mautomacaoodigital@gmail.com · WhatsApp: +55 12 98115-6417', 14, 290);
    doc.text('Página ' + i + ' de ' + total, 180, 290);
  }

  const handle = String(d.instagram || 'cliente').replace(/[^A-Za-z0-9]/g, '');
  doc.save('diagnostico-mad-' + (handle || 'cliente') + '.pdf');
}

carregar();
