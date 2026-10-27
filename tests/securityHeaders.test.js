const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const helmet = require('helmet');
const { buildHelmetOptions } = require('../config/helmet');

// App efímera replicando el orden y la configuración real de index.js
const buildApp = () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet(buildHelmetOptions()));
    app.get('/data', (req, res) => res.status(200).json({ ok: true }));
    app.get('/images/x.jpg', (req, res) => res.status(200).send('binario'));
    return app;
};

const withServer = async (fn) => {
    const server = buildApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const port = server.address().port;
        return await fn(async (path, headers = {}) => {
            const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
            return { status: res.status, h: Object.fromEntries(res.headers.entries()) };
        });
    } finally {
        server.close();
    }
};

test('cabeceras de seguridad por defecto presentes en respuestas de API', async () => {
    await withServer(async (req) => {
        const { status, h } = await req('/data');
        assert.equal(status, 200);
        assert.equal(h['x-content-type-options'], 'nosniff');
        assert.equal(h['x-frame-options'], 'SAMEORIGIN');
        assert.equal(h['referrer-policy'], 'no-referrer');
        assert.ok(h['strict-transport-security'].startsWith('max-age='));
        assert.ok(h['strict-transport-security'].includes('includeSubDomains'));
        assert.equal(h['cross-origin-resource-policy'], 'cross-origin');
        assert.equal(h['cross-origin-opener-policy'], 'same-origin');
        assert.equal(h['x-powered-by'], undefined, 'X-Powered-By eliminado');
    });
});

test('CSP por defecto de Helmet (default-src self): no bloquea respuestas JSON/imágenes', async () => {
    await withServer(async (req) => {
        const { h } = await req('/data');
        assert.ok(h['content-security-policy'].includes("default-src 'self'"));
        const img = await req('/images/x.jpg');
        assert.equal(img.status, 200);
    });
});

test('las imágenes servidas permiten uso cross-origin (CORP cross-origin)', async () => {
    await withServer(async (req) => {
        const { h } = await req('/images/x.jpg', { origin: 'https://spanish-mma.vercel.app' });
        assert.equal(h['cross-origin-resource-policy'], 'cross-origin');
    });
});

test('la configuración no desactiva protecciones: no hay secuencia sin CSP ni nosniff', async () => {
    await withServer(async (req) => {
        const { h } = await req('/data');
        assert.ok(h['content-security-policy'].length > 0);
        assert.equal(h['x-content-type-options'], 'nosniff');
        assert.equal(h['strict-transport-security'], 'max-age=15552000; includeSubDomains');
    });
});
