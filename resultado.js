/* ==========================================================
   MAD — resultado.js
   Página resultado.html?id=...
   Lê o diagnóstico em /api/resultado e monta a tela.
   Tudo é escrito com textContent (nunca innerHTML).
   ========================================================== */
(function (global) {
  'use strict';

  const WA_MAD = '5512981156417';

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

  function linkDaPagina() {
    return global.location.origin + global.location.pathname + global.location.search;
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

  /* Copia o link do resultado (com alternativa para navegadores antigos) */
  async function copiarTexto(url) {
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        await global.navigator.clipboard.writeText(url);
        return true;
      }
    } catch (e) { /* segue para o método antigo */ }

    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, url.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Carregamento ---------- */
  async function carregar() {
    const app = document.getElementById('app');
    const params = new URLSearchParams(global.location.search);
    const id = params.get('id');
    if (!id) { mostrarNaoDisponivel(app); return; }

    try {
      const r = await fetch('/api/resultado?id=' + encodeURIComponent(id));
      if (!r.ok) { mostrarNaoDisponivel(app); return; }
      const d = await r.json();
      render(app, d);
    } catch (e) {
      console.error(e);
      mostrarNaoDisponivel(app);
    }
  }

  /* Diagnóstico inexistente ou expirado: a mesma mensagem para os dois casos */
  function mostrarNaoDisponivel(app) {
    app.replaceChildren();

    const card = el('div', 'res-card');
    txt(card, 'h3', 'Diagnóstico não disponível');
    txt(card, 'p', 'Não encontramos este diagnóstico. Ele pode ter expirado (ficamos com ele por 90 dias) ou o link pode estar incompleto. Fale com a gente para gerar um novo.');
    app.appendChild(card);

    const wa = el('a', 'btn btn-primary');
    wa.href = 'https://wa.me/' + WA_MAD + '?text=' + encodeURIComponent('Olá! Quero um novo diagnóstico do meu Instagram.');
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    wa.textContent = 'Quer um novo diagnóstico? Fale com a gente →';
    app.appendChild(wa);
  }

  /* ---------- Tela do resultado ---------- */
  function render(app, d) {
    app.replaceChildren();

    // Botões do topo
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

    const copiarBtn = el('button', 'btn btn-ghost');
    copiarBtn.type = 'button';
    copiarBtn.textContent = 'Copiar link';
    copiarBtn.addEventListener('click', async () => {
      const ok = await copiarTexto(linkDaPagina());
      copiarBtn.textContent = ok ? 'Link copiado ✓' : 'Copie o link da barra do navegador';
      setTimeout(() => { copiarBtn.textContent = 'Copiar link'; }, 3000);
    });
    topBar.appendChild(copiarBtn);

    app.appendChild(topBar);

    // Aviso sobre guardar o link
    const guarde = el('p', 'guardar');
    guarde.textContent = 'Guarde este link ou baixe o PDF para consultar depois.';
    app.appendChild(guarde);

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

    // Ações práticas
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

    // Próximos passos (diagnóstico antigo pode vir em outro campo)
    const passos = Array.isArray(d.proximos_passos) ? d.proximos_passos : [];
    if (passos.length) {
      app.appendChild(blocoLista('Próximos passos recomendados', passos));
    }

    // Botões do fim
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

    // Data + prazo de disponibilidade
    const rod = el('p', 'center');
    rod.style.fontSize = '12px';
    rod.style.color = 'rgba(255,255,255,.5)';
    rod.textContent = 'Gerado em ' + new Date(d.created_at || Date.now()).toLocaleString('pt-BR');
    app.appendChild(rod);

    if (d.expira_em) {
      const prazo = el('p', 'center');
      prazo.style.fontSize = '12px';
      prazo.style.color = 'rgba(255,255,255,.5)';
      prazo.textContent = 'Este diagnóstico fica disponível até ' + new Date(d.expira_em).toLocaleDateString('pt-BR') + '.';
      app.appendChild(prazo);
    }
  }

  /* ---------- PDF ---------- */
  function baixarPdf(d) {
    if (!global.jspdf) { alert('PDF indisponível agora.'); return; }
    const { jsPDF } = global.jspdf;
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
      doc.setTextColor(255, 255, 255);
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

    const passos = Array.isArray(d.proximos_passos) ? d.proximos_passos : [];
    if (passos.length) secao('Próximos passos recomendados', passos);

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

  const api = { waLink, copiarTexto, linkDaPagina, baixarPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MADResultado = api;

  if (typeof document !== 'undefined') carregar();

})(typeof window !== 'undefined' ? window : globalThis);
