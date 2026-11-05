
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// POST: Registrar una reservación
// POST /api/reservaciones
// ==========================================
router.post('/', async (req, res) => {
    let conexion;

    try {
        const {
            id_sala,
            fecha,
            hora_inicio,
            hora_fin,
            area_solicitante,
            responsable,
            correo
        } = req.body;

        // Validaciones básicas
        if (
            !Number.isInteger(Number(id_sala)) ||
            Number(id_sala) <= 0 ||
            !fecha ||
            !hora_inicio ||
            !hora_fin ||
            !area_solicitante?.trim() ||
            !responsable?.trim() ||
            !correo?.trim()
        ) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios.'
            });
        }

        // Validar formato de fecha
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({
                mensaje: 'La fecha no tiene un formato válido.'
            });
        }

        // Validar formato de hora
        const formatoHora = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

        if (
            !formatoHora.test(hora_inicio) ||
            !formatoHora.test(hora_fin) ||
            hora_inicio >= hora_fin
        ) {
            return res.status(400).json({
                mensaje: 'El horario seleccionado no es válido.'
            });
        }

        const inicio = hora_inicio.length === 5
            ? `${hora_inicio}:00`
            : hora_inicio;

        const fin = hora_fin.length === 5
            ? `${hora_fin}:00`
            : hora_fin;

        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        // Comprobar que la sala exista y esté activa
        const [salas] = await conexion.query(
            `SELECT id_sala
             FROM salas
             WHERE id_sala = ?
             AND activa = 1
             FOR UPDATE`,
            [Number(id_sala)]
        );

        if (salas.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: 'La sala no existe o está deshabilitada.'
            });
        }

        // Comprobar reservaciones que se crucen
        const [ocupadas] = await conexion.query(
            `SELECT id_reservacion
             FROM reservaciones
             WHERE id_sala = ?
             AND fecha = ?
             AND estado <> 'cancelada'
             AND hora_inicio < ?
             AND hora_fin > ?
             LIMIT 1`,
            [
                Number(id_sala),
                fecha,
                fin,
                inicio
            ]
        );

        if (ocupadas.length > 0) {
            await conexion.rollback();

            return res.status(409).json({
                mensaje: 'El horario seleccionado ya está ocupado.'
            });
        }

        // Registrar reservación
        const codigo = `RES-${Date.now()}`;

        const [resultado] = await conexion.execute(
            `INSERT INTO reservaciones (
                codigo,
                id_sala,
                fecha,
                hora_inicio,
                hora_fin,
                area_solicitante,
                responsable,
                correo,
                estado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                codigo,
                id_sala,
                fecha,
                hora_inicio,
                hora_fin,
                area_solicitante,
                responsable,
                correo,
                'ACTIVA'
            ]
        );

        await conexion.commit();

        res.status(201).json({
            mensaje: 'Reservación registrada correctamente.',
            id_reservacion: resultado.insertId
        });

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        console.error('Error al registrar reservación:', error);

        res.status(500).json({
            mensaje: 'Error al registrar la reservación.'
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});

module.exports = router;
