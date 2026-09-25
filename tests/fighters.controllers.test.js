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

const { getFighters } = require('../controllers/fighters.controllers');

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
};

const makeReq = (query = {}) => ({ query });

const fighterRow = (id, name) => ({
    fighter_id: id,
    first_name: name,
    last_name: 'Prueba',
    company_name: null,
});

const okResponses = (rows, totalFighters) => [
    [rows, []],
    [[{ total_fighters: totalFighters }], []],
];

beforeEach(() => {
    queryCalls = [];
    poolResponses = okResponses([], 0);
});

afterEach(() => {
    delete require.cache[dbPath];
});

test('feliz: lista sin búsqueda usa límites por defecto (10) y página 1', async () => {
    poolResponses = okResponses([fighterRow(1, 'Ana')], 1);
    const res = makeRes();

    await getFighters(makeReq({}), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.results, 1);
    assert.equal(res.body.fighters.length, 1);
    assert.deepEqual(res.body.pagination, {
        total_items: 1,
        total_pages: 1,
        current_page: 1,
        limit: 10,
    });

    const [sql, params] = queryCalls[0];
    assert.ok(sql.includes('ORDER BY f.fighter_id ASC LIMIT ? OFFSET ?'));
    assert.deepEqual(params, [10, 0]);
});

test('paginación: page=2 y limit acotado a 50 cuando se pide más', async () => {
    poolResponses = okResponses([], 100);
    const res = makeRes();

    await getFighters(makeReq({ page: '2', limit: '1000' }), res);

    assert.equal(res.body.pagination.current_page, 2);
    assert.equal(res.body.pagination.limit, 50);
    assert.equal(res.body.pagination.total_pages, 2);

    const [sql, params] = queryCalls[0];
    assert.ok(sql.includes('LIMIT ? OFFSET ?'));
    assert.deepEqual(params, [50, 50]);
});

test('paginación: valores inválidos se normalizan sin 500', async () => {
    poolResponses = okResponses([], 5);
    const res = makeRes();

    await getFighters(makeReq({ page: '-3', limit: 'abc' }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.pagination.current_page, 1);
    assert.equal(res.body.pagination.limit, 10);

    const [, params] = queryCalls[0];
    assert.deepEqual(params, [10, 0]);
});

test('búsqueda por nombre completo añade CONCAT_WS y 5 patrones parametrizados', async () => {
    poolResponses = okResponses([fighterRow(2, 'Ilia')], 1);
    const res = makeRes();

    await getFighters(makeReq({ search: 'Ilia Topuria' }), res);

    const [listSql, listParams] = queryCalls[0];
    const [countSql, countParams] = queryCalls[1];

    assert.ok(listSql.includes("CONCAT_WS(' ', first_name, last_name) LIKE ?"));
    assert.ok(listSql.includes('slug LIKE ?'));
    assert.ok(listSql.includes('f.nickname LIKE ?'));
    assert.equal(listParams.length, 7); // 5 patrones + limit + offset
    assert.ok(listParams.slice(0, 5).every((p) => p === '%Ilia Topuria%'));

    assert.ok(countSql.includes("CONCAT_WS(' ', first_name, last_name) LIKE ?"));
    assert.equal(countParams.length, 5);
    assert.equal(res.body.pagination.total_items, 1);
});

test('búsqueda: los comodines LIKE del término se escapan como literales', async () => {
    const res = makeRes();

    await getFighters(makeReq({ search: '50%_off\\' }), res);

    const [listSql, listParams] = queryCalls[0];
    assert.ok(listSql.includes("ESCAPE '\\\\'"));
    assert.equal(listParams[0], '%50\\%\\_off\\\\%');
});

test('búsqueda vacía o de solo espacios no filtra', async () => {
    const res = makeRes();

    await getFighters(makeReq({ search: '   ' }), res);

    const [sql] = queryCalls[0];
    assert.ok(!sql.includes('LIKE'));
});

test('sin resultados: lista vacía y total 0', async () => {
    const res = makeRes();

    await getFighters(makeReq({ search: 'nadie' }), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.fighters, []);
    assert.equal(res.body.results, 0);
    assert.equal(res.body.pagination.total_items, 0);
    assert.equal(res.body.pagination.total_pages, 0);
});

test('fallo de la BD responde 500 sin filtrar detalles internos', async () => {
    poolResponses = [new Error('secreto interno: tabla users')];
    const res = makeRes();

    await getFighters(makeReq({}), res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.status, 'error');
    assert.equal(res.body.message, 'Error al obtener los luchadores');
    assert.ok(!JSON.stringify(res.body).includes('secreto'));
});
