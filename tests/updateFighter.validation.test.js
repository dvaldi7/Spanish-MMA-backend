const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../config/db');

let queryCalls;
let poolResponses;

//Cada llamada a query consume un elemento; cada elemento es [rows, fields] o un Error para forzar fallo
const mockPool = {
    query: async (...args) => {
        queryCalls.push(args);
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

const { updateFighter } = require('../controllers/fighters.controllers');

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
};

const makeReq = ({ body = {}, params = { id: '7' }, file } = {}) => ({ body, params, file });

const okResponse = [[], []];

beforeEach(() => {
    queryCalls = [];
    poolResponses = [okResponse];
});

afterEach(() => {
    delete require.cache[dbPath];
});

test('feliz: actualiza solo campos de la allowlist con parámetros parametrizados', async () => {
    const res = makeRes();
    const body = { nickname: 'Wasabi', team: 'Climent Club' };

    await updateFighter(makeReq({ body }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Peleador actualizado con éxito');

    const [sql, params] = queryCalls[0];
    assert.ok(sql.startsWith('UPDATE fighters SET'));
    assert.ok(sql.includes('nickname = ?'));
    assert.ok(sql.includes('team = ?'));
    assert.ok(sql.endsWith('WHERE fighter_id = ?'));
    assert.deepEqual(params, ['Wasabi', 'Climent Club', '7']);
});

test('counters: strings de multipart se parsean a enteros no negativos', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { record_wins: '5', record_losses: '2', record_draws: '0' } }), res);

    assert.equal(res.statusCode, 200);
    const [sql, params] = queryCalls[0];
    assert.deepEqual(params, [5, 2, 0, '7']);
});

test('company_id vacío se convierte en null ("Sin compañía")', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { company_id: '' } }), res);

    const [, params] = queryCalls[0];
    assert.deepEqual(params, [null, '7']);
});

test('company_id con id positivo se parsea a entero', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { company_id: '33' } }), res);

    const [, params] = queryCalls[0];
    assert.deepEqual(params, [33, '7']);
});

test('photo_url="": vacía la foto cuando no hay archivo (compatibilidad con el modal)', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { photo_url: '' } }), res);

    assert.equal(res.statusCode, 200);
    const [sql, params] = queryCalls[0];
    assert.ok(sql.includes('photo_url = ?'));
    assert.deepEqual(params, ['', '7']);
});

test('archivo nuevo manda: photo_url toma la ruta de Cloudinary de req.file', async () => {
    const res = makeRes();
    const req = makeReq({ body: { first_name: 'Ilia' }, file: { path: 'https://res.cloudinary.com/dygmatgy1/spanish-mma/fighters/nueva.jpg' } });

    await updateFighter(req, res);

    const [, params] = queryCalls[0];
    assert.equal(params[0], 'Ilia');
    assert.equal(params[1], 'https://res.cloudinary.com/dygmatgy1/spanish-mma/fighters/nueva.jpg');
    assert.equal(params[2], '7');
});

// ---------- NEGATIVOS: mass assignment y validación ----------

const expectRejected = (res, expectedStatus) => {
    assert.equal(res.statusCode, expectedStatus ?? 400);
    assert.equal(queryCalls.length, 0, 'no debe ejecutarse ninguna consulta');
    assert.ok(res.body.message || res.body.errors);
};

test('mass assignment: campo desconocido (slug) rechazado con 400 y sin tocar la BD', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { first_name: 'X', slug: 'atacante' } }), res);

    expectRejected(res);
    assert.ok(res.body.message.includes('slug'));
});

test('mass assignment: múltiples campos ajenos (is_admin, user_id) rechazados y listados', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { first_name: 'X', is_admin: 'true', user_id: '1' } }), res);

    expectRejected(res);
    assert.ok(res.body.message.includes('is_admin'));
    assert.ok(res.body.message.includes('user_id'));
});

test('columna peligrosa con nombre tipo SQL (bio; DROP TABLE users) rechazada', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { 'bio; DROP TABLE users': 'x' } }), res);

    expectRejected(res);
});

test('counter negativo rechazado con 400 y sin consulta', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { record_wins: '-3' } }), res);

    expectRejected(res);
    assert.ok(res.body.errors.join(' ').includes('record_wins'));
});

test('counter no numérico rechazado con 400', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { record_wins: 'abc' } }), res);

    expectRejected(res);
});

test('campo de texto no string (objeto) rechazado con 400', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { nickname: { malicious: 'payload' } } }), res);

    expectRejected(res);
});

test('photo_url no vacío rechazado: la foto solo se cambia subiendo archivo', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { photo_url: 'https://evil.example.com/x.jpg' } }), res);

    expectRejected(res);
    assert.ok(res.body.errors.join(' ').includes('photo_url'));
});

test('company_id inválido (texto no numérico) rechazado con 400', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: { company_id: 'empresa' } }), res);

    expectRejected(res);
});

test('cuerpo sin campos válidos rechazado con 400 y sin consulta', async () => {
    const res = makeRes();

    await updateFighter(makeReq({ body: {} }), res);

    expectRejected(res);
});

test('fallo de BD responde 500 sin filtrar detalle interno', async () => {
    poolResponses = [new Error('secreto interno: columna users_bio')];
    const res = makeRes();

    await updateFighter(makeReq({ body: { nickname: 'Ok' } }), res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Error al actualizar el peleador');
    assert.ok(!JSON.stringify(res.body).includes('secreto'));
});
