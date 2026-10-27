const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { errorHandler, notFoundApi } = require('../middleware/errorHandler');

// App efímera con el montaje real: express.json + rutas de prueba + 404 /api + errorHandler
const buildApp = () => {
    const app = express();
    app.use(express.json());

    const ok = (req, res) => res.status(200).json({ ok: true });
    app.post('/api/async-fail', async () => { throw new Error('secreto-interno-XYZ'); });
    app.post('/api/async-forbidden', async (req, res, next) => {
        const err = new Error('Solo administradores');
        err.status = 403;
        next(err);
    });
    app.get('/api/ok', ok);
    app.get('/api/doble-respuesta', async (req, res) => {
        res.status(200).json({ ok: true });
        throw new Error('error tras enviar respuesta');
    });
    app.post('/api/echo-secreto', (req, res) => {
        // nunca debe aparecer 'secreto-del-body' en la respuesta de error 500
        throw new Error(`fallo con ${JSON.stringify(req.body)}`);
    });

    app.use('/api', notFoundApi);
    app.use(errorHandler);
    return app;
};

const withServer = async (fn) => {
    const server = buildApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const port = server.address().port;
        return await fn(async (path, { method = 'GET', body, rawBody } = {}) => {
            const res = await fetch(`http://127.0.0.1:${port}${path}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: rawBody !== undefined ? rawBody : (body ? JSON.stringify(body) : undefined),
            });
            const text = await res.text();
            let json = null;
            try { json = JSON.parse(text); } catch { /* respuesta no JSON (HTML) */ }
            return { status: res.status, text, json };
        });
    } finally {
        server.close();
    }
};

test('regresión: ruta async que lanza -> 500 genérico JSON sin filtrar el detalle interno', async () => {
    await withServer(async (req) => {
        const r = await req('/api/async-fail', { method: 'POST' });
        assert.equal(r.status, 500);
        assert.equal(r.json.status, 'error');
        assert.equal(r.json.message, 'Error interno del servidor');
        assert.ok(!r.text.includes('secreto-interno-XYZ'));
    });
});

test('error de cliente con status explícito (403) respeta el código y el mensaje', async () => {
    await withServer(async (req) => {
        const r = await req('/api/async-forbidden', { method: 'POST' });
        assert.equal(r.status, 403);
        assert.equal(r.json.message, 'Solo administradores');
    });
});

test('JSON malformado -> 400 JSON legible (antes: error HTML del default handler)', async () => {
    await withServer(async (req) => {
        const r = await req('/api/async-fail', { method: 'POST', rawBody: '{invalido' });
        assert.equal(r.status, 400);
        assert.equal(r.json.status, 'error');
        assert.equal(r.json.message, 'El cuerpo de la petición no es JSON válido');
    });
});

test('404 JSON para rutas /api inexistentes', async () => {
    await withServer(async (req) => {
        const r = await req('/api/inexistente');
        assert.equal(r.status, 404);
        assert.equal(r.json.message, 'Ruta no encontrada');
    });
});

test('respuesta ya enviada: no se duplica ni cae el proceso (sigue sirviendo)', async () => {
    await withServer(async (req) => {
        const first = await req('/api/doble-respuesta', { method: 'GET' });
        assert.equal(first.status, 200);
        const second = await req('/api/ok', { method: 'GET' });
        assert.equal(second.status, 200);
    });
});

test('regresión: 404 fuera de /api mantiene el comportamiento por defecto de Express', async () => {
    await withServer(async (req) => {
        const r = await req('/no-existe-fuera-api');
        assert.equal(r.status, 404);
    });
});
