
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// GET: Obtener todas las salas
// GET /api/salas
// ==========================================
router.get('/', async (req, res) => {
    try {
        const [salas] = await pool.query(`
            SELECT
                id_sala,
                nombre,
                edificio,
                capacidad,
                encargado,
                activa
            FROM salas
            ORDER BY id_sala ASC
        `);

        res.json({
            salas
        });

    } catch (error) {
        console.error('Error al consultar salas:', error);

        res.status(500).json({
            mensaje: 'Error al consultar las salas.'
        });
    }
});

// ==========================================
// POST: Registrar una nueva sala
// POST /api/salas
// ==========================================
router.post('/', async (req, res) => {
    try {
        const {
            nombre,
            edificio,
            capacidad,
            encargado,
            activa
        } = req.body;

        // Validar datos
        if (
            !nombre?.trim() ||
            !edificio?.trim() ||
            !encargado?.trim() ||
            !Number.isInteger(Number(capacidad)) ||
            Number(capacidad) < 1 ||
            ![0, 1].includes(Number(activa))
        ) {
            return res.status(400).json({
                mensaje: 'Verifica los datos de la sala.'
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO salas
            (nombre, edificio, capacidad, encargado, activa)
            VALUES (?, ?, ?, ?, ?)`,
            [
                nombre.trim(),
                edificio.trim(),
                Number(capacidad),
                encargado.trim(),
                Number(activa)
            ]
        );

        res.status(201).json({
            mensaje: 'Sala registrada correctamente.',
            id_sala: resultado.insertId
        });

    } catch (error) {
        console.error('Error al registrar sala:', error);

        res.status(500).json({
            mensaje: 'Error al registrar la sala.'
        });
    }
});

// ==========================================
// PUT: Modificar una sala
// PUT /api/salas/:id
// ==========================================
router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        const {
            nombre,
            edificio,
            capacidad,
            encargado,
            activa
        } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                mensaje: 'El ID de la sala no es válido.'
            });
        }

        if (
            !nombre?.trim() ||
            !edificio?.trim() ||
            !encargado?.trim() ||
            !Number.isInteger(Number(capacidad)) ||
            Number(capacidad) < 1 ||
            ![0, 1].includes(Number(activa))
        ) {
            return res.status(400).json({
                mensaje: 'Verifica los datos de la sala.'
            });
        }

        const [resultado] = await pool.query(
            `UPDATE salas
             SET nombre = ?,
                 edificio = ?,
                 capacidad = ?,
                 encargado = ?,
                 activa = ?
             WHERE id_sala = ?`,
            [
                nombre.trim(),
                edificio.trim(),
                Number(capacidad),
                encargado.trim(),
                Number(activa),
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró la sala.'
            });
        }

        res.json({
            mensaje: 'Sala modificada correctamente.'
        });

    } catch (error) {
        console.error('Error al modificar sala:', error);

        res.status(500).json({
            mensaje: 'Error al modificar la sala.'
        });
    }
});

module.exports = router;
