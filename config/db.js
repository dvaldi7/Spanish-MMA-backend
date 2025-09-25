const mysql = require('mysql2');

/* Conexión a mi base de datos de MySql y mi usuario */
const pool = mysql.createPool({
    host: 'localhost',
    user: 'mma_user',                  
    password: 'usuario1234',    
    database: 'spanish-mma',
    port: 3306 
});


module.exports = pool.promise();