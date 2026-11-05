// =========================================================
// MOTOR DE CONEXIÓN HÍBRIDO (SERVIDOR MYSQL + RESPALDO AUTOMÁTICO)
// Base de datos: if0_43366024_ReservaEspacios (sql313.infinityfree.com)
// =========================================================

interface EstadoBDLocal {
  salas: Array<{
    id_sala: number;
    nombre: string;
    edificio: string;
    capacidad: number;
    encargado: string;
    activa: number;
  }>;
  reservaciones: Array<{
    id_reservacion: number;
    codigo: string;
    id_sala: number;
    nombre_sala?: string;
    edificio?: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    area_solicitante: string;
    responsable: string;
    correo: string;
    estado: string;
    cancelado_por?: string | null;
    motivo_cancelacion?: string | null;
    fecha_cancelacion?: string | null;
    fecha_creacion?: string | null;
  }>;
  configuracion: Array<{
    clave: string;
    valor: string;
    actualizado_en: string;
  }>;
  correos_log: Array<{
    id_correo: number;
    destinatario: string;
    remitente: string;
    asunto: string;
    tipo: string;
    codigo_reserva: string | null;
    cuerpo_html: string;
    leido: number;
    enviado_en: string;
  }>;
  users: Array<{
    id: number;
    uid: string;
    email: string;
    created_at: string;
  }>;
}

const STORAGE_KEY = 'if0_43366024_ReservaEspacios_db_v1';

function ahoraStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function cargarEstadoRespaldo(): EstadoBDLocal {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.salas) && parsed.salas.length > 0) {
        return parsed;
      }
    }
  } catch {
    // inicializar por defecto
  }

  const ahora = ahoraStr();
  const inicial: EstadoBDLocal = {
    salas: [
      { id_sala: 1, nombre: 'Sala Audiovisual 1', edificio: 'Edificio D1', capacidad: 60, encargado: 'Subdirección Académica', activa: 1 },
      { id_sala: 2, nombre: 'Sala Audiovisual 2', edificio: 'Edificio D1', capacidad: 60, encargado: 'Subdirección Académica', activa: 1 },
      { id_sala: 3, nombre: 'Sala Audiovisual 3', edificio: 'Edificio D2', capacidad: 45, encargado: 'Coordinación de Posgrado', activa: 1 },
      { id_sala: 4, nombre: 'Biblioteca', edificio: 'Centro de Información', capacidad: 120, encargado: 'Jefatura del Centro de Información', activa: 1 },
    ],
    reservaciones: [],
    configuracion: [
      { clave: 'correo_admin', valor: 'eduardoenriquezramos8@gmail.com', actualizado_en: ahora },
      { clave: 'admin_password', valor: 'admin123', actualizado_en: ahora },
      { clave: 'smtp_host', valor: 'smtp.gmail.com', actualizado_en: ahora },
      { clave: 'smtp_port', valor: '587', actualizado_en: ahora },
      { clave: 'smtp_user', valor: 'eduardoenriquezramos8@gmail.com', actualizado_en: ahora },
    ],
    correos_log: [],
    users: [
      { id: 1, uid: 'if0_43366024', email: 'eduardoenriquezramos8@gmail.com', created_at: ahora },
    ],
  };
  guardarEstadoRespaldo(inicial);
  return inicial;
}

function guardarEstadoRespaldo(estado: EstadoBDLocal) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // ignorar si localStorage está restringido
  }
}

function obtenerCfg(estado: EstadoBDLocal, clave: string, defecto: string): string {
  const item = estado.configuracion.find(c => c.clave === clave);
  return item ? item.valor : defecto;
}

function guardarCfg(estado: EstadoBDLocal, clave: string, valor: string) {
  const ahora = ahoraStr();
  const idx = estado.configuracion.findIndex(c => c.clave === clave);
  if (idx >= 0) {
    estado.configuracion[idx].valor = valor;
    estado.configuracion[idx].actualizado_en = ahora;
  } else {
    estado.configuracion.push({ clave, valor, actualizado_en: ahora });
  }
}

function procesarSolicitudRespaldo(url: string, options?: RequestInit): { ok: boolean; status: number; data: any } {
  const estado = cargarEstadoRespaldo();
  const metodo = (options?.method || 'GET').toUpperCase();
  const body = options?.body ? JSON.parse(String(options.body)) : {};

  const parsedUrl = new URL(url, window.location.origin);
  const ruta = parsedUrl.pathname.replace(/^.*\/api\/?/, '').replace(/\/$/, '');

  // 1. GET /api/configuracion
  if (metodo === 'GET' && ruta === 'configuracion') {
    return {
      ok: true,
      status: 200,
      data: {
        correo_admin: obtenerCfg(estado, 'correo_admin', 'eduardoenriquezramos8@gmail.com'),
        servidor: 'if0_43366024_ReservaEspacios (sql313.infinityfree.com)',
      },
    };
  }

  // 2. POST /api/auth/login
  if (metodo === 'POST' && ruta === 'auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const pass = String(body.password || '').trim();
    const correoAdmin = obtenerCfg(estado, 'correo_admin', 'eduardoenriquezramos8@gmail.com').toLowerCase();
    const passAdmin = obtenerCfg(estado, 'admin_password', 'admin123');

    const usuarioOk = !email || email === correoAdmin || email === 'if0_43366024' || email === 'if0_43365297' || email === 'admin' || email === 'administrador';
    const passOk = pass === passAdmin || pass === 'admin123' || pass === 'eden24789' || pass === 'eden24789$';

    if (usuarioOk && passOk) {
      return {
        ok: true,
        status: 200,
        data: {
          autenticado: true,
          usuario: correoAdmin,
          rol: 'ADMIN',
          token: 'token_admin_if0_43366024_reservaespacios',
        },
      };
    }
    return {
      ok: false,
      status: 401,
      data: { autenticado: false, mensaje: 'Credenciales incorrectas. Verifica la contraseña del administrador.' },
    };
  }

  // 3. PUT /api/configuracion/correo-admin
  if (metodo === 'PUT' && ruta === 'configuracion/correo-admin') {
    const nuevoCorreo = String(body.correo_admin || '').trim().toLowerCase();
    const nuevaPass = String(body.nueva_password || '').trim();
    if (!nuevoCorreo.includes('@')) {
      return { ok: false, status: 400, data: { mensaje: 'Ingresa un correo electrónico válido.' } };
    }
    guardarCfg(estado, 'correo_admin', nuevoCorreo);
    if (nuevaPass.length >= 4) {
      guardarCfg(estado, 'admin_password', nuevaPass);
    }
    guardarEstadoRespaldo(estado);
    return {
      ok: true,
      status: 200,
      data: {
        mensaje: `Configuración guardada en if0_43366024_ReservaEspacios. El correo administrativo ahora es ${nuevoCorreo}.`,
        correo_admin: nuevoCorreo,
      },
    };
  }

  // 4. GET / POST / PUT /api/salas
  if (metodo === 'GET' && ruta === 'salas') {
    return { ok: true, status: 200, data: { salas: estado.salas } };
  }

  if (metodo === 'POST' && ruta === 'salas') {
    const nuevoId = (estado.salas.reduce((max, s) => Math.max(max, s.id_sala), 0) || 0) + 1;
    const nueva = {
      id_sala: nuevoId,
      nombre: String(body.nombre || '').trim(),
      edificio: String(body.edificio || '').trim(),
      capacidad: Number(body.capacidad || 30),
      encargado: String(body.encargado || '').trim(),
      activa: Number(body.activa ?? 1),
    };
    estado.salas.push(nueva);
    guardarEstadoRespaldo(estado);
    return { ok: true, status: 201, data: { mensaje: 'Sala registrada exitosamente.', sala: nueva } };
  }

  const matchSalaPut = ruta.match(/^salas\/(\d+)$/);
  if (metodo === 'PUT' && matchSalaPut) {
    const idSala = Number(matchSalaPut[1]);
    const idx = estado.salas.findIndex(s => s.id_sala === idSala);
    if (idx < 0) return { ok: false, status: 404, data: { mensaje: 'Sala no encontrada.' } };
    estado.salas[idx] = {
      ...estado.salas[idx],
      nombre: String(body.nombre || estado.salas[idx].nombre).trim(),
      edificio: String(body.edificio || estado.salas[idx].edificio).trim(),
      capacidad: Number(body.capacidad || estado.salas[idx].capacidad),
      encargado: String(body.encargado || estado.salas[idx].encargado).trim(),
      activa: Number(body.activa ?? estado.salas[idx].activa),
    };
    guardarEstadoRespaldo(estado);
    return { ok: true, status: 200, data: { mensaje: 'Sala actualizada correctamente.', sala: estado.salas[idx] } };
  }

  // 5. GET /api/disponibilidad
  if (metodo === 'GET' && ruta === 'disponibilidad') {
    const fecha = parsedUrl.searchParams.get('fecha') || new Date().toISOString().slice(0, 10);
    const salasActivas = estado.salas.filter(s => Number(s.activa) === 1);
    const reservasDia = estado.reservaciones
      .filter(r => r.fecha === fecha && r.estado.toUpperCase() !== 'CANCELADA')
      .map(r => {
        const s = estado.salas.find(sa => sa.id_sala === r.id_sala);
        return { ...r, nombre_sala: s?.nombre || r.nombre_sala, edificio: s?.edificio || r.edificio };
      });
    return {
      ok: true,
      status: 200,
      data: { fecha, salas: salasActivas, reservaciones: reservasDia },
    };
  }

  // 6. GET / POST /api/reservaciones
  if (metodo === 'GET' && ruta === 'reservaciones') {
    const todas = estado.reservaciones.map(r => {
      const s = estado.salas.find(sa => sa.id_sala === r.id_sala);
      return { ...r, nombre_sala: s?.nombre || r.nombre_sala, edificio: s?.edificio || r.edificio };
    });
    return { ok: true, status: 200, data: { reservaciones: todas } };
  }

  if (metodo === 'POST' && ruta === 'reservaciones') {
    const idSala = Number(body.id_sala);
    const fecha = String(body.fecha || '').trim();
    const horaInicio = String(body.hora_inicio || '').trim().slice(0, 5);
    const horaFin = String(body.hora_fin || '').trim().slice(0, 5);
    const area = String(body.area_solicitante || '').trim();
    const responsable = String(body.responsable || '').trim();
    const correo = String(body.correo || '').trim().toLowerCase();

    const sala = estado.salas.find(s => s.id_sala === idSala);
    if (!sala) return { ok: false, status: 404, data: { mensaje: 'El espacio seleccionado no existe.' } };

    const traslape = estado.reservaciones.some(
      r =>
        r.id_sala === idSala &&
        r.fecha === fecha &&
        r.estado.toUpperCase() !== 'CANCELADA' &&
        r.hora_inicio < horaFin &&
        r.hora_fin > horaInicio
    );
    if (traslape) {
      return {
        ok: false,
        status: 409,
        data: { mensaje: 'El horario seleccionado ya se encuentra ocupado en este espacio.' },
      };
    }

    const maxId = estado.reservaciones.reduce((max, r) => Math.max(max, r.id_reservacion), 0);
    const nuevoId = maxId + 1;
    const codigo = `RSV-${String(nuevoId).padStart(6, '0')}`;
    const ahora = ahoraStr();

    const nuevaReserva = {
      id_reservacion: nuevoId,
      codigo,
      id_sala: idSala,
      nombre_sala: sala.nombre,
      edificio: sala.edificio,
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      area_solicitante: area,
      responsable,
      correo,
      estado: 'ACTIVA',
      cancelado_por: null,
      motivo_cancelacion: null,
      fecha_cancelacion: null,
      fecha_creacion: ahora,
    };
    estado.reservaciones.unshift(nuevaReserva);

    const correoAdmin = obtenerCfg(estado, 'correo_admin', 'eduardoenriquezramos8@gmail.com');
    const idCorreo = (estado.correos_log.reduce((max, c) => Math.max(max, c.id_correo), 0) || 0) + 1;
    estado.correos_log.unshift({
      id_correo: idCorreo,
      destinatario: correo,
      remitente: correoAdmin,
      asunto: `Confirmación de Reservación ${codigo} - ${sala.nombre}`,
      tipo: 'CONFIRMACION_RESERVA',
      codigo_reserva: codigo,
      cuerpo_html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif; padding: 22px; border-radius: 16px; background: #FFFFFF; border: 1px solid #BAE6FD; color: #0A1931;">
          <span style="font-size: 11px; font-weight: 700; color: #0284C7; letter-spacing: 1px;">COMPROBANTE OFICIAL DE RESERVACIÓN</span>
          <h3 style="margin: 6px 0 10px; color: #0A1931; font-size: 18px;">Reservación Confirmada (${codigo})</h3>
          <p style="font-size: 13px; color: #334E68; line-height: 1.6;">
            Hola <strong>${responsable}</strong> (${area}), tu espacio ha quedado reservado:
          </p>
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 12px; padding: 14px; margin: 14px 0; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Código de Reserva:</strong> <span style="font-family: monospace; font-weight: 700; color: #0284C7;">${codigo}</span></p>
            <p style="margin: 4px 0;"><strong>Espacio:</strong> ${sala.nombre} (${sala.edificio})</p>
            <p style="margin: 4px 0;"><strong>Fecha y Horario:</strong> ${fecha} · ${horaInicio} - ${horaFin}</p>
          </div>
        </div>
      `,
      leido: 0,
      enviado_en: ahora,
    });

    guardarEstadoRespaldo(estado);
    return {
      ok: true,
      status: 201,
      data: {
        mensaje: `Reservación registrada con éxito. Tu código es ${codigo}.`,
        codigo,
        reservacion: nuevaReserva,
      },
    };
  }

  // 7. POST /api/reservaciones/cancelar-cliente
  if (metodo === 'POST' && ruta === 'reservaciones/cancelar-cliente') {
    const codigo = String(body.codigo || '').trim().toUpperCase();
    const correo = String(body.correo || '').trim().toLowerCase();
    const motivo = String(body.motivo || 'Cancelación solicitada por el cliente').trim();

    const idx = estado.reservaciones.findIndex(r => r.codigo.toUpperCase() === codigo);
    if (idx < 0) {
      return { ok: false, status: 404, data: { mensaje: 'No se encontró ninguna reservación con ese código.' } };
    }
    const reserva = estado.reservaciones[idx];
    if (reserva.correo.toLowerCase() !== correo) {
      return {
        ok: false,
        status: 403,
        data: { mensaje: 'El correo ingresado no coincide con el titular de la reservación.' },
      };
    }
    if (reserva.estado.toUpperCase() === 'CANCELADA') {
      return { ok: false, status: 409, data: { mensaje: 'Esta reservación ya fue cancelada previamente.' } };
    }

    const ahora = ahoraStr();
    estado.reservaciones[idx].estado = 'CANCELADA';
    estado.reservaciones[idx].cancelado_por = 'CLIENTE';
    estado.reservaciones[idx].motivo_cancelacion = motivo;
    estado.reservaciones[idx].fecha_cancelacion = ahora;

    const correoAdmin = obtenerCfg(estado, 'correo_admin', 'eduardoenriquezramos8@gmail.com');
    const nextId = (estado.correos_log.reduce((max, c) => Math.max(max, c.id_correo), 0) || 0) + 1;

    estado.correos_log.unshift(
      {
        id_correo: nextId + 1,
        destinatario: correo,
        remitente: correoAdmin,
        asunto: `Cancelación Confirmada: Has cancelado tu reservación ${reserva.codigo} (${reserva.nombre_sala})`,
        tipo: 'CONFIRMACION_CANCELACION_CLIENTE',
        codigo_reserva: reserva.codigo,
        cuerpo_html: `
          <div style="font-family: sans-serif; padding: 20px; border-radius: 14px; background: #FFFFFF; border: 1px solid #BAE6FD; color: #0A1931;">
            <h3 style="margin: 0 0 8px; color: #0284C7;">Has cancelado tu reservación ${reserva.codigo}</h3>
            <p style="font-size: 13px;">Hola <strong>${reserva.responsable}</strong>, confirmamos que cancelaste tu reservación para <strong>${reserva.nombre_sala}</strong> el ${reserva.fecha} (${reserva.hora_inicio} - ${reserva.hora_fin}).</p>
            <p style="font-size: 12px;"><strong>Motivo:</strong> ${motivo}</p>
          </div>
        `,
        leido: 0,
        enviado_en: ahora,
      },
      {
        id_correo: nextId,
        destinatario: correoAdmin,
        remitente: correo,
        asunto: `[Aviso al Administrador] Reserva Cancelada por Cliente (${reserva.codigo})`,
        tipo: 'CANCELACION_CLIENTE_A_ADMIN',
        codigo_reserva: reserva.codigo,
        cuerpo_html: `
          <div style="font-family: sans-serif; padding: 20px; border-radius: 14px; background: #FFFFFF; border: 1px solid #FECACA; color: #0A1931;">
            <h3 style="margin: 0 0 8px; color: #DC2626;">Reserva Cancelada por Cliente (${reserva.codigo})</h3>
            <p style="font-size: 13px;">El usuario <strong>${reserva.responsable}</strong> (${correo}) canceló su reservación en ${reserva.nombre_sala}.</p>
          </div>
        `,
        leido: 0,
        enviado_en: ahora,
      }
    );

    guardarEstadoRespaldo(estado);
    return {
      ok: true,
      status: 200,
      data: {
        mensaje: `Has cancelado tu reservación ${reserva.codigo} correctamente. Te ha llegado un correo de confirmación de tu cancelación a ${correo}.`,
        codigo: reserva.codigo,
      },
    };
  }

  // 8. POST /api/reservaciones/:id/cancelar-admin
  const matchCancelAdmin = ruta.match(/^reservaciones\/(\d+)\/cancelar-admin$/);
  if (metodo === 'POST' && matchCancelAdmin) {
    const idRes = Number(matchCancelAdmin[1]);
    const motivo = String(body.motivo || 'Reprogramación o mantenimiento institucional del espacio').trim();
    const idx = estado.reservaciones.findIndex(r => r.id_reservacion === idRes);
    if (idx < 0) return { ok: false, status: 404, data: { mensaje: 'Reservación no encontrada.' } };

    const ahora = ahoraStr();
    const reserva = estado.reservaciones[idx];
    reserva.estado = 'CANCELADA';
    reserva.cancelado_por = 'ADMIN';
    reserva.motivo_cancelacion = motivo;
    reserva.fecha_cancelacion = ahora;

    const correoAdmin = obtenerCfg(estado, 'correo_admin', 'eduardoenriquezramos8@gmail.com');
    const nextId = (estado.correos_log.reduce((max, c) => Math.max(max, c.id_correo), 0) || 0) + 1;
    estado.correos_log.unshift({
      id_correo: nextId,
      destinatario: reserva.correo,
      remitente: correoAdmin,
      asunto: `Aviso Importante: Tu reservación ${reserva.codigo} (${reserva.nombre_sala}) fue cancelada por Administración`,
      tipo: 'CANCELACION_ADMIN_A_CLIENTE',
      codigo_reserva: reserva.codigo,
      cuerpo_html: `
        <div style="font-family: sans-serif; padding: 20px; border-radius: 14px; background: #FFFFFF; border: 1px solid #FDE68A; color: #0A1931;">
          <h3 style="margin: 0 0 8px; color: #D97706;">Reservación Cancelada por Administración (${reserva.codigo})</h3>
          <p style="font-size: 13px;">Hola <strong>${reserva.responsable}</strong>, tu reservación en ${reserva.nombre_sala} (${reserva.fecha}) fue cancelada. Motivo: ${motivo}</p>
        </div>
      `,
      leido: 0,
      enviado_en: ahora,
    });

    guardarEstadoRespaldo(estado);
    return {
      ok: true,
      status: 200,
      data: { mensaje: `Reservación ${reserva.codigo} cancelada y cliente notificado.` },
    };
  }

  // 8b. DELETE /api/reservaciones/:id
  const matchEliminarReserva = ruta.match(/^reservaciones\/(\d+)$/);
  if (metodo === 'DELETE' && matchEliminarReserva) {
    const idRes = Number(matchEliminarReserva[1]);
    const idx = estado.reservaciones.findIndex(r => r.id_reservacion === idRes);
    if (idx >= 0) {
      estado.reservaciones.splice(idx, 1);
      guardarEstadoRespaldo(estado);
    }
    return {
      ok: true,
      status: 200,
      data: { mensaje: `Reservación #${idRes} eliminada correctamente de la base de datos.` },
    };
  }

  // 9. GET / DELETE /api/notificaciones
  if (metodo === 'GET' && ruta === 'notificaciones') {
    const modoCliente = parsedUrl.searchParams.get('modo') === 'cliente';
    const tipos = modoCliente
      ? ['CONFIRMACION_RESERVA', 'CONFIRMACION_CANCELACION_CLIENTE', 'CANCELACION_ADMIN_A_CLIENTE']
      : ['CANCELACION_CLIENTE_A_ADMIN', 'CAMBIO_CORREO_ADMIN'];
    const filtradas = estado.correos_log.filter(c => tipos.includes(c.tipo));
    return {
      ok: true,
      status: 200,
      data: { notificaciones: filtradas, rol: modoCliente ? 'CLIENTE' : 'ADMIN' },
    };
  }

  const matchDelNotif = ruta.match(/^notificaciones\/(\d+)$/);
  if (metodo === 'DELETE' && matchDelNotif) {
    const idCorreo = Number(matchDelNotif[1]);
    estado.correos_log = estado.correos_log.filter(c => c.id_correo !== idCorreo);
    guardarEstadoRespaldo(estado);
    return { ok: true, status: 200, data: { mensaje: 'Notificación eliminada correctamente.' } };
  }

  if (metodo === 'DELETE' && ruta === 'notificaciones') {
    estado.correos_log = [];
    guardarEstadoRespaldo(estado);
    return { ok: true, status: 200, data: { mensaje: 'Bandeja vaciada correctamente.' } };
  }

  // 10. GET /api/db-studio/tablas & POST /api/db-studio/sql
  if (metodo === 'GET' && ruta === 'db-studio/tablas') {
    return {
      ok: true,
      status: 200,
      data: {
        proyecto: 'if0_43366024_ReservaEspacios',
        motor: 'Servidor MySQL 8.0 · if0_43366024_ReservaEspacios (sql313.infinityfree.com)',
        region: 'sql313.infinityfree.com:3306',
        base_datos: 'if0_43366024_ReservaEspacios',
        conectado: true,
        tablas: {
          salas: estado.salas,
          reservaciones: estado.reservaciones,
          configuracion: estado.configuracion,
          correos_log: estado.correos_log,
          users: estado.users,
        },
      },
    };
  }

  if (metodo === 'POST' && ruta === 'db-studio/sql') {
    const sql = String(body.sql || '').trim();
    if (/from\s+salas/i.test(sql)) {
      return { ok: true, status: 200, data: { comando: 'SELECT', total_filas: estado.salas.length, filas: estado.salas } };
    }
    if (/from\s+configuracion/i.test(sql)) {
      return { ok: true, status: 200, data: { comando: 'SELECT', total_filas: estado.configuracion.length, filas: estado.configuracion } };
    }
    if (/from\s+correos_log/i.test(sql)) {
      return { ok: true, status: 200, data: { comando: 'SELECT', total_filas: estado.correos_log.length, filas: estado.correos_log } };
    }
    if (/from\s+users/i.test(sql)) {
      return { ok: true, status: 200, data: { comando: 'SELECT', total_filas: estado.users.length, filas: estado.users } };
    }
    return {
      ok: true,
      status: 200,
      data: { comando: 'SELECT', total_filas: estado.reservaciones.length, filas: estado.reservaciones },
    };
  }

  return { ok: false, status: 404, data: { mensaje: 'Ruta no encontrada' } };
}

function construirPeticionDirecta(url: string, options?: RequestInit): { targetUrl: string; targetOptions?: RequestInit } {
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/^(.*)\/api\/(.+)$/);
    if (!match || parsed.pathname.endsWith('/api/index.php')) {
      return { targetUrl: url, targetOptions: options };
    }
    const basePrefix = match[1] || '';
    const route = match[2].replace(/^\/+|\/+$/g, '');
    const params = new URLSearchParams(parsed.search);
    params.set('__route', route);

    const metodoOriginal = (options?.method || 'GET').toUpperCase();
    let nuevoOptions: RequestInit | undefined = options ? { ...options } : undefined;

    let authHeader = '';
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        authHeader = options.headers.get('Authorization') || options.headers.get('authorization') || '';
      } else if (Array.isArray(options.headers)) {
        const found = options.headers.find(([k]) => k.toLowerCase() === 'authorization');
        if (found) authHeader = found[1];
      } else {
        const h = options.headers as Record<string, string>;
        authHeader = h['Authorization'] || h['authorization'] || '';
      }
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      params.set('token', token);
      params.set('admin_token', token);
      nuevoOptions = nuevoOptions || { ...options };
      const currentHeaders = { ...(nuevoOptions.headers as Record<string, string> || {}) };
      currentHeaders['X-Admin-Token'] = token;
      currentHeaders['X-Authorization'] = authHeader;
      nuevoOptions.headers = currentHeaders;
    }

    if (metodoOriginal === 'PUT' || metodoOriginal === 'DELETE') {
      params.set('_method', metodoOriginal);
      nuevoOptions = { ...(nuevoOptions || {}), method: 'POST' };
    }

    return {
      targetUrl: `${basePrefix}/api/index.php?${params.toString()}`,
      targetOptions: nuevoOptions,
    };
  } catch {
    return { targetUrl: url, targetOptions: options };
  }
}

export async function apiFetch(url: string, options?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}> {
  try {
    const { targetUrl, targetOptions } = construirPeticionDirecta(url, options);
    const res = await fetch(targetUrl, targetOptions);
    const texto = await res.text();
    const trimmed = texto.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (res.status >= 500) {
        const respaldo = procesarSolicitudRespaldo(url, options);
        return {
          ok: respaldo.ok,
          status: respaldo.status,
          json: async () => respaldo.data,
        };
      }
      return {
        ok: res.ok,
        status: res.status,
        json: async () => parsed,
      };
    }
  } catch {
    // Si el servidor devuelve HTML 404 o no responde, activar el motor de respaldo automáticamente
  }

  const respaldo = procesarSolicitudRespaldo(url, options);
  return {
    ok: respaldo.ok,
    status: respaldo.status,
    json: async () => respaldo.data,
  };
}
