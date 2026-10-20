const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Cada archivo de test corre en su propio proceso (node --test), pero guardamos/restauramos
// las envs tocadas por robustez.
const ENV_KEYS = ['JWT_SECRET', 'DB_SOCKET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
let savedEnv;

const { validateRequiredEnv } = require('../config/env');

beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => { delete process.env[k]; });
});

afterEach(() => {
    ENV_KEYS.forEach((k) => {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
    });
});

const setTcp = () => {
    process.env.JWT_SECRET = 'secreto-jwt-de-test';
    process.env.DB_HOST = 'dbhost';
    process.env.DB_USER = 'appuser';
    process.env.DB_PASSWORD = 'secreto-db-de-test';
    process.env.DB_NAME = 'spanish_mma';
};

const setSocket = () => {
    process.env.JWT_SECRET = 'secreto-jwt-de-test';
    process.env.DB_SOCKET = '/var/run/mysqld/mysqld.sock';
    process.env.DB_USER = 'dvaldi';
    process.env.DB_NAME = 'spanish_mma_preview';
};

const expectFailWith = (fn, ...names) => {
    assert.throws(fn, (err) => {
        const msg = err.message;
        return names.every((n) => msg.includes(n));
    });
};

test('configuración TCP completa es válida (sin DB_PORT: opcional)', () => {
    setTcp();
    assert.doesNotThrow(() => validateRequiredEnv());
});

test('configuración de socket (preview) completa es válida sin password', () => {
    setSocket();
    assert.doesNotThrow(() => validateRequiredEnv());
});

test('servicios opcionales ausentes (Cloudinary) no bloquean el arranque', () => {
    setTcp();
    delete process.env.CLOUDINARY_API_SECRET;
    assert.doesNotThrow(() => validateRequiredEnv());
});

test('JWT_SECRET ausente aborta el arranque', () => {
    setTcp();
    delete process.env.JWT_SECRET;

    expectFailWith(() => validateRequiredEnv(), 'JWT_SECRET');
});

test('JWT_SECRET vacío (cadena en blanco) también aborta', () => {
    setTcp();
    process.env.JWT_SECRET = '   ';

    expectFailWith(() => validateRequiredEnv(), 'JWT_SECRET');
});

test('modo TCP incompleto: exige DB_HOST, DB_USER, DB_PASSWORD y DB_NAME', () => {
    process.env.JWT_SECRET = 'secreto-jwt-de-test';
    process.env.DB_USER = 'appuser';

    expectFailWith(() => validateRequiredEnv(), 'DB_HOST', 'DB_PASSWORD', 'DB_NAME');
});

test('modo socket incompleto: no exige DB_PASSWORD pero sí DB_NAME', () => {
    process.env.JWT_SECRET = 'secreto-jwt-de-test';
    process.env.DB_SOCKET = '/var/run/mysqld/mysqld.sock';
    process.env.DB_USER = 'dvaldi';

    try {
        validateRequiredEnv();
        assert.fail('debía lanzar');
    } catch (err) {
        assert.ok(err.message.includes('DB_NAME'));
        assert.ok(!err.message.includes('DB_PASSWORD'), 'socket no debe exigir password');
    }
});

test('los mensajes nunca contienen valores de secretos, solo nombres de faltantes', () => {
    process.env.JWT_SECRET = 'jwt-valor-oculto-XYZ';
    process.env.DB_USER = 'appuser';

    try {
        validateRequiredEnv();
        assert.fail('debía lanzar');
    } catch (err) {
        // JWT_SECRET y DB_USER están presentes: no se nombran ni se filtran sus valores
        assert.ok(!err.message.includes('jwt-valor-oculto-XYZ'), 'no debe loguear el valor de JWT_SECRET');
        assert.ok(!err.message.includes('appuser'), 'no debe loguear el valor de DB_USER');
        assert.ok(!err.message.includes('JWT_SECRET'), 'si está presente no se nombra');
        // Las faltantes sí se nombran con claridad
        assert.ok(err.message.includes('DB_HOST'));
        assert.ok(err.message.includes('DB_PASSWORD'));
        assert.ok(err.message.includes('DB_NAME'));
    }
});
