const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-solo-para-tests';

const { JWT_ALGORITHMS, JWT_ISSUER, JWT_AUDIENCE } = require('../config/jwt');
const auth = require('../middleware/auth');

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
};

const makeReq = (token) => ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
});

const sign = (overrides = {}, secret = process.env.JWT_SECRET) => jwt.sign(
    { user_id: 1, role: 'admin', ...overrides },
    secret,
    { expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, ...(overrides.opts || {}) }
);

const guard = auth(['admin']);

test('feliz: token válido del emisor correcto permite pasar y decodifica el usuario', () => {
    const req = makeReq(sign());
    const res = makeRes();
    let passed = false;
    const next = () => { passed = true; };

    guard(req, res, next);

    assert.equal(passed, true);
    assert.equal(res.statusCode, 200);
    assert.equal(req.user.user_id, 1);
    assert.equal(req.user.role, 'admin');
});

test('rol insuficiente: token válido pero rol fuera de la lista -> 403', () => {
    const req = makeReq(sign({ role: 'user' }));
    const res = makeRes();

    guard(req, res, () => {});

    assert.equal(res.statusCode, 403);
});

test('sin token -> 401', () => {
    const res = makeRes();

    guard(makeReq(null), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('cabecera malformada (sin Bearer) -> 401', () => {
    const res = makeRes();
    const req = { headers: { authorization: 'token-pelado' } };

    guard(req, res, () => {});

    assert.equal(res.statusCode, 401);
});

test('expirado -> 401', () => {
    const expired = jwt.sign(
        { user_id: 1, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-10s', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );
    const res = makeRes();

    guard(makeReq(expired), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('firma incorrecta (otro secreto) -> 401', () => {
    const res = makeRes();

    guard(makeReq(sign({}, 'otro-secreto')), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('regresión: algoritmo HS512 con mismo secreto -> 401 (solo HS256 permitido)', () => {
    const hs512 = jwt.sign(
        { user_id: 1, role: 'admin' },
        process.env.JWT_SECRET,
        { algorithm: 'HS512', expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );
    const res = makeRes();

    guard(makeReq(hs512), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('regresión: alg none -> 401', () => {
    // jsonwebtoken no permite sign con none sin clave; simulamos un token none manual
    const [h, p] = jwt.sign({ user_id: 1, role: 'admin' }, 'x', { expiresIn: '1h' }).split('.').slice(0, 2);
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const noneToken = `${noneHeader}.${p}.`;
    const res = makeRes();

    guard(makeReq(noneToken), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('regresión: issuer incorrecto -> 401', () => {
    const forged = jwt.sign(
        { user_id: 1, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h', issuer: 'otra-api', audience: JWT_AUDIENCE }
    );
    const res = makeRes();

    guard(makeReq(forged), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('regresión: audience incorrecta -> 401', () => {
    const forged = jwt.sign(
        { user_id: 1, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h', issuer: JWT_ISSUER, audience: 'otra-web' }
    );
    const res = makeRes();

    guard(makeReq(forged), res, () => {});

    assert.equal(res.statusCode, 401);
});

test('regresión: token legacy (sin iss/aud, contrato anterior) -> 401 y re-login necesario', () => {
    const legacy = jwt.sign({ user_id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = makeRes();

    guard(makeReq(legacy), res, () => {});

    assert.equal(res.statusCode, 401);
});
