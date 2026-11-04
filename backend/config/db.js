const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || "260105",
    database: process.env.DB_NAME || 'reservas_salas',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificar la conexión al iniciar
pool.getConnection()
    .then(connection => {
        console.log('¡Conexión exitosa a la base de datos MySQL (reservas_salas)!');
        connection.release();
    })
    .catch(error => {
        console.error('Error al conectar con la base de datos MySQL:', error.message);
    });

module.exports = pool;