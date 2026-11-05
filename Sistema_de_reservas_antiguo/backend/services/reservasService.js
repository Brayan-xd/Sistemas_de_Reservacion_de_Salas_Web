// services/reservasService.js
const db = require('../config/db');

const reservasService = {
    async obtenerSalasActivas() {
        const [rows] = await db.query('SELECT * FROM salas WHERE activa = 1');
        return rows;
    },

    async obtenerConfiguracion() {
        const [rows] = await db.query('SELECT clave, valor FROM configuracion');
        return rows.reduce((acc, curr) => {
            acc[curr.clave] = curr.valor;
            return acc;
        }, {});
    },

    async obtenerReservacionesPorFecha(fecha) {
        const [rows] = await db.query(
            'SELECT * FROM reservaciones WHERE fecha = ? AND estado = ?',
            [fecha, 'ACTIVA']
        );
        return rows;
    },

    async crearReservacion(datos) {
        const { id_sala, area_solicitante, responsable, correo, fecha, hora_inicio, hora_fin } = datos;

        // Validar traslapes de horario en la misma sala y fecha
        const [traslapes] = await db.query(
            `SELECT * FROM reservaciones 
             WHERE id_sala = ? AND fecha = ? AND estado = 'ACTIVA' 
             AND (? < hora_fin AND ? > hora_inicio)`,
            [id_sala, fecha, hora_inicio, hora_fin]
        );

        if (traslapes.length > 0) {
            const error = new Error('El bloque horario seleccionado ya se encuentra ocupado.');
            error.status = 409;
            throw error;
        }

        // Generar código consecutivo (ej. RSV-000001)
        const [conteo] = await db.query('SELECT COUNT(*) as total FROM reservaciones');
        const numero = conteo[0].total + 1;
        const codigo = `RSV-${String(numero).padStart(6, '0')}`;

        const [resultado] = await db.query(
            `INSERT INTO reservaciones (codigo, id_sala, area_solicitante, responsable, correo, fecha, hora_inicio, hora_fin, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVA')`,
            [codigo, id_sala, area_solicitante, responsable, correo, fecha, hora_inicio, hora_fin]
        );

        return {
            id_reservacion: resultado.insertId,
            codigo,
            ...datos,
            estado: 'ACTIVA'
        };
    }
};

module.exports = reservasService;