import { Router, Request, Response } from 'express';
import {
  rateLimiter,
  sanitizarTexto,
  validarCorreo,
  verificarTokenAdminOFirebase,
  obtenerCorreoAdminActual,
  enviarCorreoInstitucional,
  obtenerSalaPorIdBD,
  listarTodasReservacionesBD,
  verificarTraslapeHorarioBD,
  crearReservacionBD,
  buscarReservacionParaCancelarBD,
  cancelarReservacionBD,
  eliminarReservacionBD,
} from '../reservasService.ts';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verificacion = await verificarTokenAdminOFirebase(token);
    const esAdmin = verificacion.valid;
    const correoCliente = sanitizarTexto(req.query.correo_cliente, 160).toLowerCase();

    if (!esAdmin && !correoCliente) {
      return res.json({ reservaciones: [] });
    }

    const todas = await listarTodasReservacionesBD();
    const filtradas = todas.filter((r) => {
      if (!esAdmin && correoCliente && r.correo.toLowerCase() !== correoCliente) {
        return false;
      }
      return true;
    });

    res.json({ reservaciones: filtradas });
  } catch (error: any) {
    console.error('Error al listar reservaciones:', error);
    res.status(500).json({ mensaje: error.message || 'Error al consultar las reservaciones.' });
  }
});

router.post('/', rateLimiter(120, 60_000), async (req: Request, res: Response) => {
  try {
    const id_sala = Number(req.body.id_sala);
    const fecha = String(req.body.fecha || '').trim();
    const hora_inicio = String(req.body.hora_inicio || '').trim();
    const hora_fin = String(req.body.hora_fin || '').trim();
    const area_solicitante = sanitizarTexto(req.body.area_solicitante, 120);
    const responsable = sanitizarTexto(req.body.responsable, 120);
    const correo = sanitizarTexto(req.body.correo, 160).toLowerCase();

    if (
      !Number.isInteger(id_sala) ||
      id_sala <= 0 ||
      !fecha ||
      !hora_inicio ||
      !hora_fin ||
      !area_solicitante ||
      !responsable ||
      !correo
    ) {
      return res.status(400).json({
        mensaje: 'Todos los campos son obligatorios.',
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        mensaje: 'El correo electrónico institucional no tiene un formato válido.',
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        mensaje: 'La fecha no tiene un formato válido.',
      });
    }

    const formatoHora = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
    const inicio = hora_inicio.length === 5 ? `${hora_inicio}:00` : hora_inicio;
    const fin = hora_fin.length === 5 ? `${hora_fin}:00` : hora_fin;

    if (!formatoHora.test(inicio) || !formatoHora.test(fin) || inicio >= fin) {
      return res.status(400).json({
        mensaje: 'El horario seleccionado no es válido.',
      });
    }

    const sala = await obtenerSalaPorIdBD(id_sala);
    if (!sala || sala.activa !== 1) {
      return res.status(404).json({
        mensaje: 'La sala no existe o está deshabilitada.',
      });
    }

    const ocupado = await verificarTraslapeHorarioBD(id_sala, fecha, inicio, fin);
    if (ocupado) {
      return res.status(409).json({
        mensaje: 'El horario seleccionado ya está ocupado.',
      });
    }

    const nuevaReserva = await crearReservacionBD({
      id_sala,
      fecha,
      hora_inicio: inicio,
      hora_fin: fin,
      area_solicitante,
      responsable,
      correo,
    });

    await enviarCorreoInstitucional({
      destinatario: correo,
      asunto: `Confirmación de Reservación ${nuevaReserva.codigo} — ${sala.nombre}`,
      tipo: 'CONFIRMACION_RESERVA',
      codigo_reserva: nuevaReserva.codigo,
      cuerpo_html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif; padding: 22px; border-radius: 16px; background: #FFFFFF; border: 1px solid #DCE6F7; color: #0A1931;">
          <span style="font-size: 11px; font-weight: 700; color: #0055D4; letter-spacing: 1px;">CONFIRMACIÓN DE RESERVACIÓN</span>
          <h3 style="margin: 6px 0 12px; color: #0A1931; font-size: 18px;">Espacio reservado exitosamente</h3>
          <p style="font-size: 13px; color: #334E68; line-height: 1.6;">
            Estimado(a) <strong>${responsable}</strong> (${area_solicitante}), tu reservación ha quedado registrada:
          </p>
          <div style="background: #F4F8FF; border: 1px solid #D0E2FF; border-radius: 12px; padding: 14px; margin: 14px 0; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Código de Reservación:</strong> <span style="font-family: monospace; color: #0055D4; font-weight: 700;">${nuevaReserva.codigo}</span></p>
            <p style="margin: 4px 0;"><strong>Espacio:</strong> ${sala.nombre} (${sala.edificio})</p>
            <p style="margin: 4px 0;"><strong>Fecha:</strong> ${fecha}</p>
            <p style="margin: 4px 0;"><strong>Horario:</strong> ${inicio.slice(0, 5)} - ${fin.slice(0, 5)}</p>
          </div>
          <p style="font-size: 12px; color: #627D98; margin: 0;">
            Guarda tu código <strong>${nuevaReserva.codigo}</strong> por si requieres cancelar tu reservación posteriormente.
          </p>
        </div>
      `,
    });

    res.status(201).json({
      mensaje: `Reservación registrada correctamente con código ${nuevaReserva.codigo}. Se ha enviado la confirmación a ${correo}.`,
      id_reservacion: nuevaReserva.id_reservacion,
      codigo: nuevaReserva.codigo,
      correo,
    });
  } catch (error: any) {
    console.error('Error al registrar reservación:', error);
    res.status(500).json({
      mensaje: error.message || 'Error al registrar la reservación.',
    });
  }
});

router.post('/cancelar-cliente', rateLimiter(120, 60_000), async (req: Request, res: Response) => {
  try {
    const codigoRaw = sanitizarTexto(req.body.codigo, 40).toUpperCase().replace(/\s+/g, '');
    const soloDigitos = codigoRaw.replace(/^(RSV-|RES-)/, '');
    const codigoNormalizado = /^\d+$/.test(soloDigitos)
      ? `RSV-${soloDigitos.padStart(6, '0')}`
      : codigoRaw;
    const id_reservacion = Number(req.body.id_reservacion || (/^\d+$/.test(soloDigitos) ? soloDigitos : 0));
    const correo = sanitizarTexto(req.body.correo, 160).toLowerCase();
    const motivo = sanitizarTexto(req.body.motivo || 'Cancelación solicitada por el usuario', 220);

    if ((!codigoRaw && !id_reservacion) || !correo) {
      return res.status(400).json({
        mensaje: 'Debes ingresar el código de reservación y el correo institucional con el que se registró.',
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        mensaje: 'El formato del correo electrónico no es válido.',
      });
    }

    const reserva = await buscarReservacionParaCancelarBD(codigoRaw, codigoNormalizado, id_reservacion);

    if (!reserva) {
      return res.status(404).json({
        mensaje: 'No se encontró ninguna reservación con ese código.',
      });
    }

    if (String(reserva.correo).toLowerCase() !== correo) {
      return res.status(403).json({
        mensaje: 'Verificación de seguridad fallida: El correo ingresado no coincide con el titular de la reservación.',
      });
    }

    if (String(reserva.estado).toLowerCase() === 'cancelada') {
      return res.status(409).json({
        mensaje: 'Esta reservación ya fue cancelada previamente.',
      });
    }

    await cancelarReservacionBD(reserva.id_reservacion, 'CLIENTE', motivo);

    const correoAdminDestino = await obtenerCorreoAdminActual();

    await enviarCorreoInstitucional({
      destinatario: correoAdminDestino,
      remitente: reserva.correo,
      asunto: `[Aviso al Administrador] Reserva Cancelada por Cliente (${reserva.codigo})`,
      tipo: 'CANCELACION_CLIENTE_A_ADMIN',
      codigo_reserva: reserva.codigo,
      cuerpo_html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif; padding: 22px; border-radius: 16px; background: #FFFFFF; border: 1px solid #FECACA; color: #0A1931;">
          <span style="font-size: 11px; font-weight: 700; color: #DC2626; letter-spacing: 1px;">NOTIFICACIÓN AL ADMINISTRADOR · CANCELACIÓN DE CLIENTE</span>
          <h3 style="margin: 6px 0 10px; color: #0A1931; font-size: 18px;">Un usuario ha cancelado su reservación</h3>
          <p style="font-size: 13px; color: #334E68; line-height: 1.6;">
            El usuario <strong>${reserva.responsable}</strong> (${reserva.correo}) ha cancelado su reservación. El espacio ha quedado disponible nuevamente:
          </p>
          <div style="background: #FFF5F5; border: 1px solid #FED7D7; border-radius: 12px; padding: 14px; margin: 14px 0; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Código:</strong> <span style="font-family: monospace; font-weight: 700;">${reserva.codigo}</span></p>
            <p style="margin: 4px 0;"><strong>Espacio liberado:</strong> ${reserva.nombre_sala} (${reserva.edificio})</p>
            <p style="margin: 4px 0;"><strong>Fecha y Horario:</strong> ${reserva.fecha} · ${reserva.hora_inicio.slice(0, 5)} - ${reserva.hora_fin.slice(0, 5)}</p>
            <p style="margin: 4px 0;"><strong>Área solicitante:</strong> ${reserva.area_solicitante}</p>
            <p style="margin: 4px 0;"><strong>Motivo:</strong> ${motivo}</p>
          </div>
          <p style="font-size: 12px; color: #627D98; margin: 0;">
            Notificación enviada al correo del administrador configurado en la base de datos (${correoAdminDestino}).
          </p>
        </div>
      `,
    });

    await enviarCorreoInstitucional({
      destinatario: reserva.correo,
      remitente: correoAdminDestino,
      asunto: `Cancelación Confirmada: Has cancelado tu reservación ${reserva.codigo} (${reserva.nombre_sala})`,
      tipo: 'CONFIRMACION_CANCELACION_CLIENTE',
      codigo_reserva: reserva.codigo,
      cuerpo_html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif; padding: 22px; border-radius: 16px; background: #FFFFFF; border: 1px solid #BAE6FD; color: #0A1931;">
          <span style="font-size: 11px; font-weight: 700; color: #0284C7; letter-spacing: 1px;">COMPROBANTE DE CANCELACIÓN · SOLICITUD DEL USUARIO</span>
          <h3 style="margin: 6px 0 10px; color: #0A1931; font-size: 18px;">Has cancelado tu reservación ${reserva.codigo}</h3>
          <p style="font-size: 13px; color: #334E68; line-height: 1.6;">
            Hola <strong>${reserva.responsable}</strong> (${reserva.area_solicitante}), te confirmamos que la cancelación que solicitaste se realizó correctamente y el horario ha sido liberado:
          </p>
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 12px; padding: 14px; margin: 14px 0; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Código cancelado:</strong> <span style="font-family: monospace; font-weight: 700; color: #0284C7;">${reserva.codigo}</span></p>
            <p style="margin: 4px 0;"><strong>Espacio:</strong> ${reserva.nombre_sala} (${reserva.edificio})</p>
            <p style="margin: 4px 0;"><strong>Fecha y Horario:</strong> ${reserva.fecha} · ${reserva.hora_inicio.slice(0, 5)} - ${reserva.hora_fin.slice(0, 5)}</p>
            <p style="margin: 4px 0;"><strong>Motivo registrado:</strong> ${motivo}</p>
          </div>
          <p style="font-size: 12px; color: #486581; margin: 0;">
            Este correo confirma que tú realizaste la cancelación de este espacio institucional.
          </p>
        </div>
      `,
    });

    res.json({
      mensaje: `Has cancelado tu reservación ${reserva.codigo} correctamente. Te ha llegado un correo de confirmación de tu cancelación a ${reserva.correo}.`,
      codigo: reserva.codigo,
      correo_cliente_notificado: reserva.correo,
    });
  } catch (error: any) {
    console.error('Error al cancelar reservación por cliente:', error);
    res.status(500).json({
      mensaje: error.message || 'Error al procesar la cancelación de la reservación.',
    });
  }
});

router.post('/:id/cancelar-admin', rateLimiter(40, 60_000), async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined) ||
      (req.headers['x-admin-token'] as string) ||
      (req.headers['x-authorization'] ? (req.headers['x-authorization'] as string).replace(/^Bearer\s+/i, '') : undefined) ||
      (req.query.token as string) ||
      (req.query.admin_token as string) ||
      (req.body?.admin_token as string);
    const verificacion = await verificarTokenAdminOFirebase(token);
    if (!verificacion.valid) {
      return res.status(401).json({ mensaje: 'No autorizado: Sesión administrativa requerida para cancelar reservaciones.' });
    }

    const id_reservacion = Number(req.params.id);
    const motivo = sanitizarTexto(
      req.body.motivo || 'Reprogramación o mantenimiento institucional del espacio',
      220
    );

    if (!Number.isInteger(id_reservacion) || id_reservacion <= 0) {
      return res.status(400).json({
        mensaje: 'ID de reservación inválido.',
      });
    }

    const reserva = await buscarReservacionParaCancelarBD('', '', id_reservacion);

    if (!reserva) {
      return res.status(404).json({
        mensaje: 'No se encontró la reservación especificada.',
      });
    }

    if (String(reserva.estado).toLowerCase() === 'cancelada') {
      return res.status(409).json({
        mensaje: 'Esta reservación ya se encuentra cancelada.',
      });
    }

    await cancelarReservacionBD(id_reservacion, 'ADMIN', motivo);

    const correoAdminActual = await obtenerCorreoAdminActual();

    await enviarCorreoInstitucional({
      destinatario: reserva.correo,
      remitente: correoAdminActual,
      asunto: `Aviso Importante: Tu reservación ${reserva.codigo} (${reserva.nombre_sala}) fue cancelada por Administración`,
      tipo: 'CANCELACION_ADMIN_A_CLIENTE',
      codigo_reserva: reserva.codigo,
      cuerpo_html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif; padding: 22px; border-radius: 16px; background: #FFFFFF; border: 1px solid #FDE68A; color: #0A1931;">
          <span style="font-size: 11px; font-weight: 700; color: #D97706; letter-spacing: 1px;">NOTIFICACIÓN AL CLIENTE · CANCELACIÓN POR ADMINISTRACIÓN</span>
          <h3 style="margin: 6px 0 10px; color: #0A1931; font-size: 18px;">Tu reservación ${reserva.codigo} ha sido cancelada</h3>
          <p style="font-size: 13px; color: #334E68; line-height: 1.6;">
            Estimado(a) <strong>${reserva.responsable}</strong> (${reserva.area_solicitante}), la administración de espacios ha cancelado la siguiente reservación:
          </p>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 14px; margin: 14px 0; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Código:</strong> <span style="font-family: monospace; font-weight: 700;">${reserva.codigo}</span></p>
            <p style="margin: 4px 0;"><strong>Espacio:</strong> ${reserva.nombre_sala} (${reserva.edificio})</p>
            <p style="margin: 4px 0;"><strong>Fecha y Horario:</strong> ${reserva.fecha} · ${reserva.hora_inicio.slice(0, 5)} - ${reserva.hora_fin.slice(0, 5)}</p>
            <p style="margin: 4px 0;"><strong>Motivo de la administración:</strong> ${motivo}</p>
          </div>
          <p style="font-size: 12px; color: #486581; margin: 0;">
            Atentamente, Administración de Espacios (${correoAdminActual}).
          </p>
        </div>
      `,
    });

    res.json({
      mensaje: `Reservación ${reserva.codigo} cancelada por el administrador. Se ha enviado la notificación por correo al cliente (${reserva.correo}).`,
      codigo: reserva.codigo,
      cliente_notificado: reserva.correo,
    });
  } catch (error: any) {
    console.error('Error al cancelar reservación por admin:', error);
    res.status(500).json({
      mensaje: error.message || 'Error al cancelar la reservación.',
    });
  }
});

router.delete('/:id', rateLimiter(40, 60_000), async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined) ||
      (req.headers['x-admin-token'] as string) ||
      (req.headers['x-authorization'] ? (req.headers['x-authorization'] as string).replace(/^Bearer\s+/i, '') : undefined) ||
      (req.query.token as string) ||
      (req.query.admin_token as string) ||
      (req.body?.admin_token as string);
    const verificacion = await verificarTokenAdminOFirebase(token);
    if (!verificacion.valid) {
      return res.status(401).json({ mensaje: 'No autorizado: Sesión administrativa requerida para borrar reservaciones.' });
    }

    const id_reservacion = Number(req.params.id);
    if (!Number.isInteger(id_reservacion) || id_reservacion <= 0) {
      return res.status(400).json({ mensaje: 'ID de reservación inválido.' });
    }

    await eliminarReservacionBD(id_reservacion);
    res.json({ mensaje: `Reservación #${id_reservacion} eliminada correctamente de la base de datos.` });
  } catch (error: any) {
    console.error('Error al eliminar reservación:', error);
    res.status(500).json({ mensaje: error.message || 'Error al eliminar la reservación.' });
  }
});

export default router;
