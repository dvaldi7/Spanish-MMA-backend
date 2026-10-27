const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const mysqlPath = require.resolve('mysql2');

let createPoolCalls;
const mockMysql = {
    createPool: (config) => {
        createPoolCalls.push(config);
        return { end: async () => {}, promise: () => ({ __mockPool: true }) };
    },
};

require.cache[mysqlPath] = {
    id: mysqlPath,
    filename: mysqlPath,
    loaded: true,
    exports: mockMysql,
};

const loadDb = () => {
    const dbPath = require.resolve('../config/db');
    delete require.cache[dbPath];
    const pool = require('../config/db');
    assert.equal(pool.__mockPool, true);
    return pool;
};

beforeEach(() => {
    createPoolCalls = [];
    delete process.env.DB_SOCKET;
    delete process.env.DB_USER;
    delete process.env.DB_NAME;
    delete process.env.DB_HOST;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_PORT;
});

test('por defecto usa host/puerto/credenciales (comportamiento de producción intacto)', () => {
    process.env.DB_HOST = 'dbhost';
    process.env.DB_USER = 'appuser';
    process.env.DB_PASSWORD = 'appsecret';
    process.env.DB_NAME = 'spanish_mma';
    process.env.DB_PORT = '3306';

    loadDb();

    assert.equal(createPoolCalls.length, 1);
    const config = createPoolCalls[0];
    assert.equal(config.host, 'dbhost');
    assert.equal(config.user, 'appuser');
    assert.equal(config.password, 'appsecret');
    assert.equal(config.database, 'spanish_mma');
    assert.equal(config.port, '3306');
    assert.equal(config.socketPath, undefined);
    assert.equal(config.connectionLimit, 10);
});

test('con DB_SOCKET usa socket Unix sin password (auth_socket, preview)', () => {
    process.env.DB_SOCKET = '/var/run/mysqld/mysqld.sock';
    process.env.DB_USER = 'dvaldi';
    process.env.DB_NAME = 'spanish_mma_preview';

    loadDb();

    assert.equal(createPoolCalls.length, 1);
    const config = createPoolCalls[0];
    assert.equal(config.socketPath, '/var/run/mysqld/mysqld.sock');
    assert.equal(config.user, 'dvaldi');
    assert.equal(config.database, 'spanish_mma_preview');
    assert.equal(config.password, undefined);
    assert.equal(config.host, undefined);
    assert.equal(config.waitForConnections, true);
});
