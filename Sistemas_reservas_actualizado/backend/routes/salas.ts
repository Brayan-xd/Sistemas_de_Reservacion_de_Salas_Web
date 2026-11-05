import { Router, Request, Response } from 'express';
import {
  rateLimiter,
  sanitizarTexto,
  verificarTokenAdminOFirebase,
  listarSalasBD,
  crearSalaBD,
  actualizarSalaBD,
} from '../reservasService.ts';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const salas = await listarSalasBD(false);
    res.json({ salas });
  } catch (error: any) {
    console.error('Error al consultar salas:', error);
    res.status(500).json({ mensaje: error.message || 'Error al consultar las salas.' });
  }
});

router.post('/', rateLimiter(40, 60_000), async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verificacion = await verificarTokenAdminOFirebase(token);
    if (!verificacion.valid) {
      return res.status(401).json({ mensaje: 'Sesión administrativa requerida.' });
    }

    const nombre = sanitizarTexto(req.body.nombre, 100);
    const edificio = sanitizarTexto(req.body.edificio, 100);
    const capacidad = Number(req.body.capacidad);
    const encargado = sanitizarTexto(req.body.encargado, 120);
    const activa = Number(req.body.activa);

    if (
      !nombre ||
      !edificio ||
      !encargado ||
      !Number.isInteger(capacidad) ||
      capacidad < 1 ||
      capacidad > 1000 ||
      ![0, 1].includes(activa)
    ) {
      return res.status(400).json({
        mensaje: 'Verifica los datos de la sala.',
      });
    }

    const nueva = await crearSalaBD({ nombre, edificio, capacidad, encargado, activa });

    res.status(201).json({
      mensaje: 'Sala registrada correctamente en la base de datos.',
      id_sala: nueva.id_sala,
    });
  } catch (error: any) {
    console.error('Error al registrar sala:', error);
    res.status(500).json({ mensaje: error.message || 'Error al registrar la sala.' });
  }
});

router.put('/:id', rateLimiter(40, 60_000), async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verificacion = await verificarTokenAdminOFirebase(token);
    if (!verificacion.valid) {
      return res.status(401).json({ mensaje: 'Sesión administrativa requerida.' });
    }

    const id = Number(req.params.id);
    const nombre = sanitizarTexto(req.body.nombre, 100);
    const edificio = sanitizarTexto(req.body.edificio, 100);
    const capacidad = Number(req.body.capacidad);
    const encargado = sanitizarTexto(req.body.encargado, 120);
    const activa = Number(req.body.activa);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: 'El ID de la sala no es válido.' });
    }

    if (
      !nombre ||
      !edificio ||
      !encargado ||
      !Number.isInteger(capacidad) ||
      capacidad < 1 ||
      capacidad > 1000 ||
      ![0, 1].includes(activa)
    ) {
      return res.status(400).json({ mensaje: 'Verifica los datos de la sala.' });
    }

    const actualizada = await actualizarSalaBD(id, {
      nombre,
      edificio,
      capacidad,
      encargado,
      activa,
    });

    if (!actualizada) {
      return res.status(404).json({ mensaje: 'No se encontró la sala.' });
    }

    res.json({ mensaje: 'Sala modificada correctamente.' });
  } catch (error: any) {
    console.error('Error al modificar sala:', error);
    res.status(500).json({ mensaje: error.message || 'Error al modificar la sala.' });
  }
});

export default router;
