const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildCorsOptions, parseAllowedOrigins } = require('../config/cors');

// App efímera con la política real de CORS y un endpoint de prueba.
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use(require('cors')(buildCorsOptions()));
    app.post('/login', (req, res) => res.status(200).json({ ok: true }));
    app.get('/data', (req, res) => res.status(200).json({ ok: true }));
    return app;
};

const withServer = async (fn) => {
    const server = buildApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const port = server.address().port;
        return await fn(async (path, { origin, method = 'GET', preflight = false } = {}) => {
            const headers = {};
            if (origin !== undefined) headers['Origin'] = origin;
            if (preflight) {
                headers['Access-Control-Request-Method'] = 'POST';
                headers['Access-Control-Request-Headers'] = 'Content-Type';
            }
            const res = await fetch(`http://127.0.0.1:${port}${path}`, {
                method: preflight ? 'OPTIONS' : method,
                headers,
                body: preflight || method === 'GET' ? undefined : JSON.stringify({}),
            });
            return { status: res.status, acao: res.headers.get('access-control-allow-origin'), acam: res.headers.get('access-control-allow-methods') };
        });
    } finally {
        server.close();
    }
};

test('origen permitido (Vercel): la respuesta lleva Access-Control-Allow-Origin', async () => {
    await withServer(async (req) => {
        const r = await req('/data', { origin: 'https://spanish-mma.vercel.app' });
        assert.equal(r.status, 200);
        assert.equal(r.acao, 'https://spanish-mma.vercel.app');
    });
});

test('origen permitido (preview localhost:5173) también soportado', async () => {
    await withServer(async (req) => {
        const r = await req('/data', { origin: 'http://localhost:5173' });
        assert.equal(r.status, 200);
        assert.equal(r.acao, 'http://localhost:5173');
    });
});

test('origen no permitido: respuesta procesada PERO sin cabeceras CORS', async () => {
    await withServer(async (req) => {
        const r = await req('/data', { origin: 'https://malicioso.example.com' });
        assert.equal(r.status, 200); // la petición se procesa; el navegador la bloqueará al leer
        assert.equal(r.acao, null, 'no debe devolver Access-Control-Allow-Origin');
    });
});

test('petición sin Origin (cliente API no navegador): permitida y sin cabeceras CORS', async () => {
    await withServer(async (req) => {
        const r = await req('/data');
        assert.equal(r.status, 200);
        assert.equal(r.acao, null);
    });
});

test('preflight OPTIONS con origen permitido: 204 + métodos y Content-Type permitidos', async () => {
    await withServer(async (req) => {
        const r = await req('/login', { origin: 'https://spanish-mma.vercel.app', preflight: true });
        assert.equal(r.status, 204);
        assert.equal(r.acao, 'https://spanish-mma.vercel.app');
        assert.ok(r.acam.includes('POST'));
    });
});

test('preflight OPTIONS con origen no permitido: sin cabeceras CORS (navegador lo bloquea)', async () => {
    await withServer(async (req) => {
        const r = await req('/login', { origin: 'https://malicioso.example.com', preflight: true });
        assert.ok(r.status >= 200 && r.status < 300);
        assert.equal(r.acao, null);
    });
});

test('ALLOWED_ORIGINS añade orígenes sin tocar código', async () => {
    process.env.ALLOWED_ORIGINS = 'https://extra.dominio.es';
    assert.ok(parseAllowedOrigins().includes('https://extra.dominio.es'));

    // Con env cargada, la respuesta incluye el origen extra
    const app = express();
    app.use(express.json());
    app.use(require('cors')(buildCorsOptions()));
    app.get('/data', (req, res) => res.status(200).json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const res = await fetch(`http://127.0.0.1:${server.address().port}/data`, { headers: { Origin: 'https://extra.dominio.es' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://extra.dominio.es');
    server.close();
    delete process.env.ALLOWED_ORIGINS;
});

test('parseAllowedOrigins recorta espacios e ignora entradas vacías', async () => {
    process.env.ALLOWED_ORIGINS = ' https://a.es , https://b.es , ';
    const list = parseAllowedOrigins();
    assert.ok(list.includes('https://a.es') && list.includes('https://b.es'));
    assert.ok(!list.includes(''));
    delete process.env.ALLOWED_ORIGINS;
});
