
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// GET: Consultar disponibilidad
// GET /api/disponibilidad?fecha=2026-11-04
// ==========================================
router.get('/', async (req, res) => {
    try {
        const { fecha, espacio = 'todos' } = req.query;

        // Validar fecha
        if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({
                mensaje: 'Debes proporcionar una fecha válida.'
            });
        }

        // Obtener salas activas
        let consultaSalas = `
            SELECT
                id_sala,
                nombre,
                edificio,
                capacidad,
                encargado,
                activa
            FROM salas
            WHERE activa = 1
        `;

        const parametrosSalas = [];

        // Aplicar filtro de sala
        if (espacio !== 'todos') {
            const idSala = Number(espacio);

            if (!Number.isInteger(idSala) || idSala <= 0) {
                return res.status(400).json({
                    mensaje: 'El espacio seleccionado no es válido.'
                });
            }

            consultaSalas += ' AND id_sala = ?';
            parametrosSalas.push(idSala);
        }

        consultaSalas += ' ORDER BY id_sala ASC';

        const [salas] = await pool.query(
            consultaSalas,
            parametrosSalas
        );

        // Obtener reservaciones de la fecha
        let consultaReservaciones = `
            SELECT
                r.id_reservacion,
                r.id_sala,
                r.fecha,
                r.hora_inicio,
                r.hora_fin,
                r.estado
            FROM reservaciones r
            INNER JOIN salas s
                ON r.id_sala = s.id_sala
            WHERE r.fecha = ?
            AND r.estado <> 'cancelada'
            AND s.activa = 1
        `;

        const parametrosReservaciones = [fecha];

        // Aplicar el mismo filtro de sala
        if (espacio !== 'todos') {
            consultaReservaciones += ' AND r.id_sala = ?';
            parametrosReservaciones.push(Number(espacio));
        }

        consultaReservaciones += `
            ORDER BY r.id_sala ASC, r.hora_inicio ASC
        `;

        const [reservaciones] = await pool.query(
            consultaReservaciones,
            parametrosReservaciones
        );

        // Devolver información al frontend
        res.json({
            fecha,
            salas,
            reservaciones
        });

    } catch (error) {
        console.error('Error al consultar disponibilidad:', error);

        res.status(500).json({
            mensaje: 'Error al consultar la disponibilidad.'
        });
    }
});

module.exports = router;
