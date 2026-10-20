/* ============================================================
   MAD — api/resultado.js
   GET /api/resultado?id=...

   Devolve apenas o diagnóstico pedido (pelo token público).
   A tabela não é legível pelo navegador (RLS ativo, sem policy
   pública). Nenhum dado pessoal além do necessário para a tela.
   ============================================================ */
'use strict';

const { aplicarCors } = require('./_lib/cors');
const { validarTokenPublico, validarUuidV4 } = require('./_lib/validation');
const { buscarUm } = require('./_lib/supabase');

module.exports = async (req, res) => {
  if (aplicarCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ erro: 'metodo-invalido' });

  const id = (req.query && req.query.id) ? String(req.query.id) : '';
  if (!validarTokenPublico(id)) return res.status(400).json({ erro: 'id-invalido' });

  try {
    // token público (padrão) ou uuid (links antigos)
    let row = await buscarUm('diagnosticos', 'token=eq.' + encodeURIComponent(id));
    if (!row && validarUuidV4(id)) {
      row = await buscarUm('diagnosticos', 'id=eq.' + encodeURIComponent(id));
    }

    // inexistente e expirado devolvem a MESMA resposta (não revela qual é)
    if (!row) return res.status(404).json({ erro: 'nao-disponivel' });

    if (row.expira_em) {
      const expira = new Date(row.expira_em).getTime();
      if (!isNaN(expira) && expira < Date.now()) {
        return res.status(404).json({ erro: 'nao-disponivel' });
      }
    }

    const d = row.diagnostico || {};

    return res.status(200).json({
      id: row.token || row.id,
      created_at: row.created_at,
      expira_em: row.expira_em || null,
      nome: row.nome,
      instagram: row.instagram,
      nota_geral: (d.nota_geral != null) ? d.nota_geral : null,
      resumo: d.resumo,
      pontos_fortes: d.pontos_fortes,
      pontos_a_melhorar: d.pontos_a_melhorar,
      acoes_praticas: d.acoes_praticas,
      // diagnóstico novo usa "proximos_passos"; o antigo, "oportunidades_para_a_MAD"
      proximos_passos: d.proximos_passos || d.oportunidades_para_a_MAD
    });
  } catch (e) {
    console.error('erro resultado:', e && e.message);
    return res.status(500).json({ erro: 'erro-interno' });
  }
};

module.exports.config = { maxDuration: 10 };
