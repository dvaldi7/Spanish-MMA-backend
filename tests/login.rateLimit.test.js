const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createLoginLimiter } = require('../middleware/loginRateLimiter');

// App efímera con la MISMA política que producción: trust proxy 'loopback' + limiter en /login.
// El handler responde 401 (fallo) o 200 (éxito) según body.success para controlar el contador.
const buildApp = () => {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.use(express.json());
    app.post('/login', createLoginLimiter(), (req, res) => {
        if (req.body && req.body.success === true) return res.status(200).json({ status: 'success' });
        return res.status(401).json({ status: 'error' });
    });
    return app;
};

// Lanza el server en 127.0.0.1 (loopback, como Nginx) y ejecuta un flujo de fetches.
// XFF simulada: 'spoof, IP-final' (la última entrada es la que Nginx añadiría).
const withServer = async (fn) => {
    const server = buildApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const port = server.address().port;
        return await fn(async (xff, success = false) => {
            const headers = { 'Content-Type': 'application/json' };
            if (xff) headers['X-Forwarded-For'] = xff;
            const res = await fetch(`http://127.0.0.1:${port}/login`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ success }),
            });
            return {
                status: res.status,
                retryAfter: res.headers.get('retry-after'),
                policy: res.headers.get('ratelimit-policy'),
            };
        });
    } finally {
        server.close();
    }
};

test('bloquea tras 10 fallos: la 11ª responde 429 con Retry-After y cabeceras draft-7', async () => {
    await withServer(async (req) => {
        for (let i = 0; i < 10; i++) {
            const r = await req('1.2.3.4, 5.6.7.8');
            assert.equal(r.status, 401);
        }

        const blocked = await req('1.2.3.4, 5.6.7.8');
        assert.equal(blocked.status, 429);
        assert.ok(blocked.retryAfter !== null, 'Retry-After presente');
        assert.ok(blocked.policy.includes('10'), 'RateLimit-Policy declara el límite 10');
    });
});

test('el login exitoso no consume cupo (skipSuccessfulRequests): sin lockout del admin', async () => {
    await withServer(async (req) => {
        for (let i = 0; i < 9; i++) await req('1.2.3.4, 5.6.7.8');          // 9 fallos
        const ok = await req('1.2.3.4, 5.6.7.8', true);                     // éxito (no cuenta)
        assert.equal(ok.status, 200);

        const tenthFailure = await req('1.2.3.4, 5.6.7.8');                 // fallo nº10 -> aún 401
        assert.equal(tenthFailure.status, 401);

        const eleventh = await req('1.2.3.4, 5.6.7.8');                     // fallo nº11 -> 429
        assert.equal(eleventh.status, 429);
    });
});

test('separación de IPs: agotar una IP no bloquea a otra', async () => {
    await withServer(async (req) => {
        for (let i = 0; i < 11; i++) await req('1.2.3.4, 5.6.7.8');         // agota 5.6.7.8
        const other = await req('1.2.3.4, 9.9.9.9');
        assert.equal(other.status, 401, 'otra IP distinta sigue en 401, no 429');
    });
});

test('anti-evasión: falsificar el XFF inicial no evita el bloqueo (la IP final manda)', async () => {
    await withServer(async (req) => {
        for (let i = 0; i < 10; i++) await req(`spoof-${i}.1.2.3.4, 5.6.7.8`);
        const evaded = await req('otro-spoof.9.9.9.9, 5.6.7.8');
        assert.equal(evaded.status, 429, 'misma IP final: sigue bloqueada');
    });
});

test('sin XFF: la petición cuenta por la IP de socket y también se bloquea', async () => {
    await withServer(async (req) => {
        for (let i = 0; i < 10; i++) await req(null);
        const blocked = await req(null);
        assert.equal(blocked.status, 429);
    });
});
