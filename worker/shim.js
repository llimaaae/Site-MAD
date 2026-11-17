/* Shim req/res estilo Vercel/Node sobre Request/Response do Workers.
   Preserva o comportamento original das funções (api/*.js). */
'use strict';

export function criarReq(request, url) {
	const headers = {};
	request.headers.forEach((v, k) => { headers[k] = v; });
	const query = {};
	for (const [k, v] of url.searchParams.entries()) query[k] = v;

	const req = {
		method: request.method,
		headers,
		query,
		socket: { remoteAddress: headers['cf-connecting-ip'] || 'unknown' },
		connection: { remoteAddress: headers['cf-connecting-ip'] || 'unknown' },
		body: undefined,
	};
	return req;
}

export async function carregarBody(request, req) {
	if (request.method === 'GET' || request.method === 'HEAD') return;
	const texto = await request.text();
	try { req.body = JSON.parse(texto); } catch { req.body = texto; }
}

export function criarRes() {
	const res = {
		statusCode: 200,
		headersSent: false,
		_headers: {},
		_chunks: [],
		_stream: null,
		_finalizado: null,
		_started: null,

		status(code) { this.statusCode = code; return this; },
		setHeader(k, v) {
			if (this.headersSent) return this;
			this._headers[k] = v;
			return this;
		},
		getHeader(k) { return this._headers[k]; },

		_iniciarStream() {
			if (this._started) return this._started;
			const self = this;
			this.headersSent = true;
			this._stream = new ReadableStream({
				start(controller) {
					self._finalizado = new Promise((resolve) => { self._fechar = resolve; });
					for (const chunk of self._chunks) controller.enqueue(new TextEncoder().encode(chunk));
					self._chunks = [];
					self._enqueue = (c) => controller.enqueue(new TextEncoder().encode(c));
					self._close = () => { try { controller.close(); } catch {} resolve(); };
					if (self._encerrado) self._close();
				},
			});
			this._started = new Response(this._stream, {
				status: this.statusCode,
				headers: this._headers,
			});
			return this._started;
		},

		json(obj) {
			if (this.headersSent && this._stream && !this._encerrado) {
				// json depois de iniciar stream não acontece no código original
				this.end(JSON.stringify(obj));
				return this;
			}
			this.headersSent = true;
			this._started = new Response(JSON.stringify(obj), {
				status: this.statusCode,
				headers: { ...this._headers, 'Content-Type': 'application/json; charset=utf-8' },
			});
			this._encerrado = true;
			return this;
		},

		write(chunk) {
			if (chunk == null) return;
			const texto = typeof chunk === 'string' ? chunk : String(chunk);
			this._iniciarStream();
			if (this._enqueue) this._enqueue(texto);
			else this._chunks.push(texto);
		},

		end(chunk) {
			if (chunk != null) this.write(chunk);
			if (!this.headersSent) {
				this._started = new Response('', { status: this.statusCode, headers: this._headers });
				this.headersSent = true;
				this._encerrado = true;
				return this;
			}
			this._encerrado = true;
			if (this._close) this._close();
			return this;
		},
	};
	return res;
}
