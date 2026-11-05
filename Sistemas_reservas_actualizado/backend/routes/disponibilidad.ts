import { Router, Request, Response } from 'express';
import { listarSalasBD, listarReservacionesDisponibilidadBD } from '../reservasService.ts';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const fecha = String(req.query.fecha || '');
    const espacio = String(req.query.espacio || 'todos');

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        mensaje: 'Debes proporcionar una fecha válida.',
      });
    }

    let idSalaFiltro: number | undefined;
    if (espacio !== 'todos') {
      const idSala = Number(espacio);
      if (!Number.isInteger(idSala) || idSala <= 0) {
        return res.status(400).json({
          mensaje: 'El espacio seleccionado no es válido.',
        });
      }
      idSalaFiltro = idSala;
    }

    const [salas, reservaciones] = await Promise.all([
      listarSalasBD(true, idSalaFiltro),
      listarReservacionesDisponibilidadBD(fecha, idSalaFiltro),
    ]);

    res.json({
      fecha,
      salas,
      reservaciones,
    });
  } catch (error: any) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({
      mensaje: error.message || 'Error al consultar la disponibilidad.',
    });
  }
});

export default router;
