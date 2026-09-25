const mysql = require('mysql2');

/* Conexión a MySQL. Por defecto: host/puerto con credenciales (producción).
   Preview (TASK-0036/ADR-0020): DB_SOCKET activa conexión por socket Unix con
   auth_socket, sin contraseñas, con usuario acotado a la BD de preview. */
const poolConfig = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = process.env.DB_SOCKET
    ? mysql.createPool({
        socketPath: process.env.DB_SOCKET,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        ...poolConfig,
    })
    : mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ...poolConfig,
    });

module.exports = pool.promise();
