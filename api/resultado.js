/* ============================================================
   MAD — api/resultado.js
   GET /api/resultado?id=...
   Devolve apenas o diagnóstico solicitado. A tabela não é
   legível pelo navegador (RLS ativo, sem policy pública).
   ============================================================ */
'use strict';

const { aplicarCors } = require('./_lib/cors');
const { validarUuidV4 } = require('./_lib/validation');
const { buscarUm } = require('./_lib/supabase');

module.exports = async (req, res) => {
  if (aplicarCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ erro: 'metodo-invalido' });

  const id = (req.query && req.query.id) ? String(req.query.id) : '';
  if (!validarUuidV4(id)) return res.status(400).json({ erro: 'id-invalido' });

  try {
    const row = await buscarUm('diagnosticos', 'id=eq.' + encodeURIComponent(id));
    if (!row) return res.status(404).json({ erro: 'nao-encontrado' });

    // devolve só o necessário para a tela de resultado
    return res.status(200).json({
      id: row.id,
      created_at: row.created_at,
      nome: row.nome,
      instagram: row.instagram,
      nota_geral: (row.diagnostico && row.diagnostico.nota_geral) != null ? row.diagnostico.nota_geral : null,
      resumo: row.diagnostico && row.diagnostico.resumo,
      pontos_fortes: row.diagnostico && row.diagnostico.pontos_fortes,
      pontos_a_melhorar: row.diagnostico && row.diagnostico.pontos_a_melhorar,
      acoes_praticas: row.diagnostico && row.diagnostico.acoes_praticas,
      oportunidades_para_a_MAD: row.diagnostico && row.diagnostico.oportunidades_para_a_MAD
    });
  } catch (e) {
    console.error('erro resultado:', e && e.message);
    return res.status(500).json({ erro: 'erro-interno' });
  }
};

module.exports.config = { maxDuration: 10 };
