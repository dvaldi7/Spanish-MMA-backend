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

const { getNews, createNews, getNewsBySlug, updateNews, deleteNews } = require('../controllers/news.controllers');

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
};

const makeReq = ({ body = {}, params = {}, file } = {}) => ({ body, params, query: {}, file });

const newsRow = { news_id: 3, title: 'Noticia', content: 'Texto', slug: 'noticia', image_url: null };

beforeEach(() => {
    queryCalls = [];
    poolResponses = [[[newsRow], []], [[{ total: 1 }], []]];
});

afterEach(() => {
    delete require.cache[dbPath];
});

// ---------- getNews (listado) ----------

test('listado devuelve paginación y filas', async () => {
    const res = makeRes();

    await getNews(makeReq(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.pagination.current_page, 1);
    assert.ok(Array.isArray(res.body.news));
});

// ---------- createNews ----------

test('feliz: crea noticia con slug derivado del título y 201', async () => {
    const res = makeRes();

    await createNews(makeReq({ body: { title: 'Mi Noticia', content: 'Contenido' } }), res);

    assert.equal(res.statusCode, 201);
    const [sql, params] = queryCalls[0];
    assert.ok(sql.includes('INSERT INTO news'));
    assert.equal(params[0], 'Mi Noticia');
    assert.equal(params[3], 'mi-noticia');
});

test('validación: title ausente responde 400 sin ejecutar consulta (antes 500 por slugify)', async () => {
    const res = makeRes();

    await createNews(makeReq({ body: { content: 'Sin título' } }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(queryCalls.length, 0);
});

test('validación: title no string responde 400 sin ejecutar consulta', async () => {
    const res = makeRes();

    await createNews(makeReq({ body: { title: { hack: 1 }, content: 'Texto' } }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(queryCalls.length, 0);
});

test('regresión: slug duplicado responde 409 sin TypeError (no reasigna const)', async () => {
    const res = makeRes();
    const dupError = Object.assign(new Error('duplicado'), { code: 'ER_DUP_ENTRY' });

    await createNews(makeReq({ body: { title: 'Mi Noticia', content: 'Contenido' } }), res);

    poolResponses = [dupError];
    queryCalls = [];
    const resDup = makeRes();
    await createNews(makeReq({ body: { title: 'Mi Noticia', content: 'Contenido' } }), resDup);

    assert.equal(resDup.statusCode, 409);
    assert.ok(resDup.body.message.includes('título similar'));
});

// ---------- getNewsBySlug ----------

test('feliz: devuelve la fila de la noticia por slug', async () => {
    const res = makeRes();

    await getNewsBySlug(makeReq({ params: { slug: 'noticia' } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.news_id, 3);
});

test('regresión: slug inexistente responde 404 (antes nunca 404 por affectedRows en SELECT)', async () => {
    poolResponses = [[[], []]];
    const res = makeRes();

    await getNewsBySlug(makeReq({ params: { slug: 'no-existe' } }), res);

    assert.equal(res.statusCode, 404);
});

test('fallo de BD responde 500 sin filtrar detalle interno', async () => {
    poolResponses = [new Error('secreto: tabla users con email de admin')];
    const res = makeRes();

    await getNewsBySlug(makeReq({ params: { slug: 'x' } }), res);

    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('secreto'));
});

// ---------- updateNews ----------

test('validación: title ausente responde 400 sin ejecutar consulta (antes 500 por slugify(undefined))', async () => {
    const res = makeRes();

    await updateNews(makeReq({ params: { id: '3' }, body: { content: 'Solo contenido' } }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(queryCalls.length, 0);
});

test('feliz sin archivo: actualiza title/content/slug sin tocar image_url', async () => {
    const res = makeRes();

    await updateNews(makeReq({ params: { id: '3' }, body: { title: 'Nuevo Título', content: 'Nuevo texto' } }), res);

    assert.equal(res.statusCode, 200);
    const [sql, params] = queryCalls[0];
    assert.ok(!sql.includes('image_url'));
    assert.deepEqual(params, ['Nuevo Título', 'Nuevo texto', 'nuevo-titulo', '3']);
});

test('con archivo nuevo: image_url toma la ruta del archivo subido', async () => {
    const res = makeRes();
    const req = makeReq({
        params: { id: '3' },
        body: { title: 'Con Foto', content: 'Texto' },
        file: { path: 'https://res.cloudinary.com/dygmatgy1/spanish-mma/news/nueva.jpg' },
    });

    await updateNews(req, res);

    const [, params] = queryCalls[0];
    assert.equal(params[3], 'https://res.cloudinary.com/dygmatgy1/spanish-mma/news/nueva.jpg');
});

test('regresión: slug duplicado al editar responde 409', async () => {
    const dupError = Object.assign(new Error('duplicado'), { code: 'ER_DUP_ENTRY' });
    poolResponses = [dupError];
    const res = makeRes();

    await updateNews(makeReq({ params: { id: '3' }, body: { title: 'Duplico', content: 'Texto' } }), res);

    assert.equal(res.statusCode, 409);
});

test('regresión: noticia inexistente al editar responde 404', async () => {
    poolResponses = [[{ affectedRows: 0, changedRows: 0 }, []]];
    const res = makeRes();

    await updateNews(makeReq({ params: { id: '999' }, body: { title: 'X', content: 'Y' } }), res);

    assert.equal(res.statusCode, 404);
});

// ---------- deleteNews ----------

test('regresión: fallo al borrar no expone el mensaje interno de la BD', async () => {
    poolResponses = [new Error('secreto: FK constraints de event_fighters')];
    const res = makeRes();

    await deleteNews(makeReq({ params: { id: '5' } }), res);

    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('secreto'));
});
