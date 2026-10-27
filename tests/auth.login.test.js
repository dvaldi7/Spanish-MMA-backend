const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

process.env.JWT_SECRET = 'test-secret-solo-para-tests';

const dbPath = require.resolve('../config/db');

let poolResponses;

//Cada llamada a query consume un elemento; cada elemento es [rows, fields] o un Error para forzar fallo
const mockPool = {
    query: async (...args) => {
        const response = poolResponses.shift();
        if (response instanceof Error) throw response;
        return response;
    },
};

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockPool,
};

const { JWT_ALGORITHMS, JWT_ISSUER, JWT_AUDIENCE, JWT_EXPIRES_IN } = require('../config/jwt');
const { login } = require('../controllers/auth.controllers');

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
};

const makeReq = (body) => ({ body });

beforeEach(() => {
    const hash = bcrypt.hashSync('Correcta123', 4);
    poolResponses = [[[{ user_id: 7, password_hash: hash, role: 'admin' }], []]];
});

test('feliz: login emite token HS256 con issuer/audience del contrato y 1h', () => {
    const res = makeRes();

    return login(makeReq({ email: 'a@b.es', password: 'Correcta123' }), res).then(() => {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.role, 'admin');

        const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET, {
            algorithms: JWT_ALGORITHMS,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        assert.equal(decoded.user_id, 7);
        assert.equal(decoded.role, 'admin');
        assert.equal(decoded.iss, 'spanish-mma-api');
        assert.equal(decoded.aud, 'spanish-mma-web');
        // expiresIn 1h -> margen de vida entre 59 y 60 minutos
        assert.ok(decoded.exp - decoded.iat <= 3600);
        assert.ok(decoded.exp - decoded.iat >= 3500);
    });
});

test('contraseña incorrecta -> 401 con mensaje genérico', () => {
    const res = makeRes();

    return login(makeReq({ email: 'a@b.es', password: 'incorrecta' }), res).then(() => {
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.message, 'Credenciales inválidas');
    });
});

test('email inexistente -> 401 con mensaje genérico (no revela si existe)', () => {
    poolResponses = [[[], []]];
    const res = makeRes();

    return login(makeReq({ email: 'nadie@b.es', password: 'loquesea' }), res).then(() => {
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.message, 'Credenciales inválidas');
    });
});

test('faltan email o contraseña -> 400 sin tocar la BD', () => {
    const res = makeRes();

    return login(makeReq({ email: 'a@b.es' }), res).then(() => {
        assert.equal(res.statusCode, 400);
        assert.equal(poolResponses.length, 1, 'no debe ejecutarse consulta');
    });
});
