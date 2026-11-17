/* Worker de entrada — Site MAD.
   Roteia /api/* para os handlers originais (adaptados via shim)
   e serve o site estático via assets. Cron diário mantido. */
import chat from '../api/chat.js';
import diagnostico from '../api/diagnostico.js';
import notificaLead from '../api/notifica-lead.js';
import resultado from '../api/resultado.js';
import limpeza from '../api/cron/limpeza.js';
import { criarReq, carregarBody, criarRes } from './shim.js';

const ROTAS = {
	'/api/chat': chat,
	'/api/diagnostico': diagnostico,
	'/api/notifica-lead': notificaLead,
	'/api/resultado': resultado,
	'/api/cron/limpeza': limpeza,
};

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const handler = ROTAS[url.pathname];

		if (!handler) {
			return env.ASSETS.fetch(request);
		}

		const req = criarReq(request, url);
		await carregarBody(request, req);
		const res = criarRes();

		try {
			await handler(req, res);
		} catch (e) {
			console.error('erro handler', url.pathname, e && e.message);
			if (!res.headersSent) return new Response(JSON.stringify({ erro: 'erro-interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
			await res.end();
		}

		if (res._started) return res._started;
		return new Response('', { status: res.statusCode, headers: res._headers });
	},

	async scheduled(event, env) {
		// Rotina diária (equivalente ao Vercel Cron 0 4 * * *)
		const segredo = env.CRON_SECRET;
		if (!segredo) { console.error('cron: CRON_SECRET ausente'); return; }
		const url = new URL('https://dummy/api/cron/limpeza');
		const req = { method: 'GET', headers: { authorization: 'Bearer ' + segredo }, socket: {}, connection: {} };
		const res = criarRes();
		try {
			await limpeza(req, res);
			console.log('cron limpeza status=' + res.statusCode);
		} catch (e) {
			console.error('cron falhou: ' + (e && e.message));
		}
	},
};
