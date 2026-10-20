/* ============================================================
   MAD — api/cron/limpeza.js
   GET /api/cron/limpeza

   Rotina diária (Vercel Cron, 1x por dia no plano Hobby):
   - apaga os diagnósticos vencidos (mais de 90 dias);
   - apaga as linhas antigas de "analises_log" (mais de 24h);
   - NÃO apaga nada da tabela "leads" (o lead comercial tem
     outra finalidade e outro prazo de retenção).

   Segurança: exige o segredo CRON_SECRET no cabeçalho
   "Authorization: Bearer ...". Sem isso, ninguém aciona de fora.

   Variável de ambiente: CRON_SECRET
   ============================================================ */
'use strict';

const crypto = require('crypto');
const { remover } = require('../_lib/supabase');

const HORAS_LOG = 24;

function comparar(a, b) {
  if (!a || !b) return false;
  const digA = crypto.createHash('sha256').update(String(a)).digest();
  const digB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(digA, digB);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'metodo-invalido' });

  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error('limpeza: CRON_SECRET nao configurado');
    return res.status(500).json({ erro: 'erro-interno' });
  }

  const autorizacao = String((req.headers && req.headers.authorization) || '');
  const recebido = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7).trim() : '';
  if (!comparar(recebido, segredo)) {
    return res.status(401).json({ erro: 'nao-autorizado' });
  }

  const agora = new Date();
  const antes = new Date(agora.getTime() - HORAS_LOG * 60 * 60 * 1000).toISOString();

  let diagnosticos = 0;
  let logs = 0;

  try {
    diagnosticos = await remover('diagnosticos', 'expira_em=lt.' + encodeURIComponent(agora.toISOString()));
    logs = await remover('analises_log', 'created_at=lt.' + encodeURIComponent(antes));
  } catch (e) {
    console.error('limpeza: falha ao apagar', e && e.message);
    return res.status(500).json({ erro: 'erro-interno' });
  }

  console.log('limpeza concluida: diagnosticos=' + diagnosticos + ' logs=' + logs);
  return res.status(200).json({ ok: true, diagnosticos, logs });
};

module.exports.config = { maxDuration: 10 };
