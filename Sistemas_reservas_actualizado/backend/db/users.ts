import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import path from 'path';
import { createPool } from './index.ts';

let usarServidorMySQL = Boolean(process.env.MYSQL_HOST);

let motorLocal: Database.Database | null = null;
let tablasMySQLInicializadas = false;

async function asegurarTablasMySQL() {
  if (tablasMySQLInicializadas || !usarServidorMySQL) return;
  try {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = Number(process.env.MYSQL_PORT || 3306);
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const dbName = process.env.MYSQL_DATABASE || 'ReservaEspacios';

    try {
      const conexionInicial = await mysql.createConnection({ host, port, user, password });
      await conexionInicial.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      await conexionInicial.end();
    } catch {
      // En hostings remotos la base de datos ya viene creada con prefijo del proveedor
    }

    const pool = createPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(128) NOT NULL UNIQUE,
        email VARCHAR(180) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS salas (
        id_sala INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        edificio VARCHAR(120) NOT NULL,
        capacidad INT NOT NULL,
        encargado VARCHAR(150) NOT NULL,
        activa TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservaciones (
        id_reservacion INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(32) NOT NULL UNIQUE,
        id_sala INT NOT NULL,
        fecha VARCHAR(20) NOT NULL,
        hora_inicio VARCHAR(10) NOT NULL,
        hora_fin VARCHAR(10) NOT NULL,
        area_solicitante VARCHAR(160) NOT NULL,
        responsable VARCHAR(160) NOT NULL,
        correo VARCHAR(180) NOT NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
        cancelado_por VARCHAR(40) DEFAULT NULL,
        motivo_cancelacion TEXT DEFAULT NULL,
        fecha_cancelacion VARCHAR(30) DEFAULT NULL,
        fecha_creacion VARCHAR(30) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave VARCHAR(100) PRIMARY KEY,
        valor TEXT NOT NULL,
        actualizado_en VARCHAR(30) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS correos_log (
        id_correo INT AUTO_INCREMENT PRIMARY KEY,
        destinatario VARCHAR(180) NOT NULL,
        remitente VARCHAR(180) NOT NULL,
        asunto VARCHAR(255) NOT NULL,
        tipo VARCHAR(60) NOT NULL,
        codigo_reserva VARCHAR(32) DEFAULT NULL,
        cuerpo_html LONGTEXT NOT NULL,
        leido TINYINT(1) NOT NULL DEFAULT 0,
        enviado_en VARCHAR(30) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablasMySQLInicializadas = true;
  } catch (err) {
    console.warn('Servidor MySQL externo no detectado en puerto 3306, usando motor local integrado ReservaEspacios:', (err as Error).message);
    usarServidorMySQL = false;
  }
}

function obtenerMotorEmbebido(): Database.Database {
  if (!motorLocal) {
    const dbPath = path.resolve(process.cwd(), 'backend/db/ReservaEspacios_mysql.db');
    motorLocal = new Database(dbPath);
    motorLocal.pragma('journal_mode = WAL');
    motorLocal.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS salas (
        id_sala INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        edificio TEXT NOT NULL,
        capacidad INTEGER NOT NULL,
        encargado TEXT NOT NULL,
        activa INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS reservaciones (
        id_reservacion INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE,
        id_sala INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        area_solicitante TEXT NOT NULL,
        responsable TEXT NOT NULL,
        correo TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'ACTIVA',
        cancelado_por TEXT,
        motivo_cancelacion TEXT,
        fecha_cancelacion TEXT,
        fecha_creacion TEXT
      );
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        actualizado_en TEXT
      );
      CREATE TABLE IF NOT EXISTS correos_log (
        id_correo INTEGER PRIMARY KEY AUTOINCREMENT,
        destinatario TEXT NOT NULL,
        remitente TEXT NOT NULL,
        asunto TEXT NOT NULL,
        tipo TEXT NOT NULL,
        codigo_reserva TEXT,
        cuerpo_html TEXT NOT NULL,
        leido INTEGER NOT NULL DEFAULT 0,
        enviado_en TEXT
      );
    `);
  }
  return motorLocal;
}

export async function getOrCreateUser(uid: string, email: string) {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    await pool.query(
      `INSERT INTO users (uid, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email)`,
      [uid, email]
    );
    const [filas] = await pool.query<any[]>(`SELECT * FROM users WHERE uid = ? LIMIT 1`, [uid]);
    return filas[0];
  }
  const sq = obtenerMotorEmbebido();
  sq.prepare(`
    INSERT INTO users (uid, email) VALUES (?, ?)
    ON CONFLICT(uid) DO UPDATE SET email = excluded.email
  `).run(uid, email);
  return sq.prepare(`SELECT * FROM users WHERE uid = ?`).get(uid) as {
    id: number;
    uid: string;
    email: string;
    createdAt: Date | null;
  };
}

export async function obtenerValorConfiguracion(clave: string, valorPorDefecto = ''): Promise<string> {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [filas] = await pool.query<any[]>(`SELECT valor FROM configuracion WHERE clave = ? LIMIT 1`, [clave]);
    return filas[0]?.valor || valorPorDefecto;
  }
  const sq = obtenerMotorEmbebido();
  const fila = sq.prepare(`SELECT valor FROM configuracion WHERE clave = ? LIMIT 1`).get(clave) as { valor?: string } | undefined;
  return fila?.valor || valorPorDefecto;
}

export async function guardarValorConfiguracion(clave: string, valor: string): Promise<void> {
  const ahora = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    await pool.query(
      `INSERT INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_en = VALUES(actualizado_en)`,
      [clave, valor, ahora]
    );
    return;
  }
  const sq = obtenerMotorEmbebido();
  sq.prepare(`
    INSERT INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en
  `).run(clave, valor, ahora);
}

export async function listarSalasBD(soloActivas = false, idSalaEspecifica?: number) {
  let todas: Array<{
    id_sala: number;
    nombre: string;
    edificio: string;
    capacidad: number;
    encargado: string;
    activa: number;
  }> = [];

  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [filas] = await pool.query<any[]>(`SELECT * FROM salas ORDER BY id_sala ASC`);
    todas = filas;
  } else {
    const sq = obtenerMotorEmbebido();
    todas = sq.prepare(`SELECT * FROM salas ORDER BY id_sala ASC`).all() as any[];
  }

  return todas.filter((s) => {
    if (soloActivas && Number(s.activa) !== 1) return false;
    if (idSalaEspecifica !== undefined && Number(s.id_sala) !== idSalaEspecifica) return false;
    return true;
  });
}

export async function obtenerSalaPorIdBD(idSala: number) {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [filas] = await pool.query<any[]>(`SELECT * FROM salas WHERE id_sala = ? LIMIT 1`, [idSala]);
    return filas[0] || null;
  }
  const sq = obtenerMotorEmbebido();
  const fila = sq.prepare(`SELECT * FROM salas WHERE id_sala = ? LIMIT 1`).get(idSala) as {
    id_sala: number;
    nombre: string;
    edificio: string;
    capacidad: number;
    encargado: string;
    activa: number;
  } | undefined;
  return fila || null;
}

export async function crearSalaBD(datos: {
  nombre: string;
  edificio: string;
  capacidad: number;
  encargado: string;
  activa: number;
}) {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [res]: any = await pool.query(
      `INSERT INTO salas (nombre, edificio, capacidad, encargado, activa) VALUES (?, ?, ?, ?, ?)`,
      [datos.nombre, datos.edificio, datos.capacidad, datos.encargado, datos.activa]
    );
    const creada = await obtenerSalaPorIdBD(Number(res.insertId));
    return creada!;
  }
  const sq = obtenerMotorEmbebido();
  const res = sq.prepare(`
    INSERT INTO salas (nombre, edificio, capacidad, encargado, activa)
    VALUES (?, ?, ?, ?, ?)
  `).run(datos.nombre, datos.edificio, datos.capacidad, datos.encargado, datos.activa);
  const creada = await obtenerSalaPorIdBD(Number(res.lastInsertRowid));
  return creada!;
}

export async function actualizarSalaBD(
  idSala: number,
  datos: {
    nombre: string;
    edificio: string;
    capacidad: number;
    encargado: string;
    activa: number;
  }
) {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    await pool.query(
      `UPDATE salas SET nombre = ?, edificio = ?, capacidad = ?, encargado = ?, activa = ? WHERE id_sala = ?`,
      [datos.nombre, datos.edificio, datos.capacidad, datos.encargado, datos.activa, idSala]
    );
    return obtenerSalaPorIdBD(idSala);
  }
  const sq = obtenerMotorEmbebido();
  sq.prepare(`
    UPDATE salas SET nombre = ?, edificio = ?, capacidad = ?, encargado = ?, activa = ?
    WHERE id_sala = ?
  `).run(datos.nombre, datos.edificio, datos.capacidad, datos.encargado, datos.activa, idSala);
  return obtenerSalaPorIdBD(idSala);
}

export async function listarReservacionesDisponibilidadBD(fecha: string, idSalaFiltro?: number) {
  let filas: Array<{
    id_reservacion: number;
    codigo: string;
    id_sala: number;
    nombre_sala: string;
    edificio: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    estado: string;
  }> = [];

  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [res] = await pool.query<any[]>(
      `SELECT r.id_reservacion, r.codigo, r.id_sala, s.nombre AS nombre_sala, s.edificio,
              r.fecha, r.hora_inicio, r.hora_fin, r.estado
       FROM reservaciones r
       INNER JOIN salas s ON r.id_sala = s.id_sala
       WHERE r.fecha = ? AND r.estado NOT IN ('cancelada', 'CANCELADA') AND s.activa = 1
       ORDER BY r.id_sala ASC, r.hora_inicio ASC`,
      [fecha]
    );
    filas = res;
  } else {
    const sq = obtenerMotorEmbebido();
    filas = sq.prepare(`
      SELECT r.id_reservacion, r.codigo, r.id_sala, s.nombre as nombre_sala, s.edificio,
             r.fecha, r.hora_inicio, r.hora_fin, r.estado
      FROM reservaciones r
      INNER JOIN salas s ON r.id_sala = s.id_sala
      WHERE r.fecha = ? AND r.estado NOT IN ('cancelada', 'CANCELADA') AND s.activa = 1
      ORDER BY r.id_sala ASC, r.hora_inicio ASC
    `).all(fecha) as any[];
  }

  return idSalaFiltro !== undefined ? filas.filter((r) => Number(r.id_sala) === idSalaFiltro) : filas;
}

export async function listarTodasReservacionesBD() {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [filas] = await pool.query<any[]>(`
      SELECT r.*, s.nombre AS nombre_sala, s.edificio
      FROM reservaciones r
      INNER JOIN salas s ON r.id_sala = s.id_sala
      ORDER BY r.fecha DESC, r.hora_inicio ASC, r.id_reservacion DESC
    `);
    return filas;
  }
  const sq = obtenerMotorEmbebido();
  return sq.prepare(`
    SELECT r.*, s.nombre as nombre_sala, s.edificio
    FROM reservaciones r
    INNER JOIN salas s ON r.id_sala = s.id_sala
    ORDER BY r.fecha DESC, r.hora_inicio ASC, r.id_reservacion DESC
  `).all() as Array<{
    id_reservacion: number;
    codigo: string;
    id_sala: number;
    nombre_sala: string;
    edificio: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    area_solicitante: string;
    responsable: string;
    correo: string;
    estado: string;
    cancelado_por: string | null;
    motivo_cancelacion: string | null;
    fecha_cancelacion: string | null;
    fecha_creacion: string | null;
  }>;
}

export async function verificarTraslapeHorarioBD(
  idSala: number,
  fecha: string,
  horaInicio: string,
  horaFin: string
): Promise<boolean> {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [filas] = await pool.query<any[]>(
      `SELECT id_reservacion FROM reservaciones
       WHERE id_sala = ? AND fecha = ?
         AND estado NOT IN ('cancelada', 'CANCELADA')
         AND hora_inicio < ? AND hora_fin > ?
       LIMIT 1`,
      [idSala, fecha, horaFin, horaInicio]
    );
    return filas.length > 0;
  }
  const sq = obtenerMotorEmbebido();
  const fila = sq.prepare(`
    SELECT id_reservacion FROM reservaciones
    WHERE id_sala = ? AND fecha = ?
      AND estado NOT IN ('cancelada', 'CANCELADA')
      AND hora_inicio < ? AND hora_fin > ?
    LIMIT 1
  `).get(idSala, fecha, horaFin, horaInicio);
  return Boolean(fila);
}

export async function crearReservacionBD(datos: {
  id_sala: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  area_solicitante: string;
  responsable: string;
  correo: string;
}) {
  const ahora = new Date().toISOString().replace('T', ' ').slice(0, 19);

  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [existentes] = await pool.query<any[]>(
      `SELECT id_reservacion, codigo FROM reservaciones ORDER BY id_reservacion DESC`
    );
    const codigosUsados = new Set(existentes.map((e) => String(e.codigo).toUpperCase()));
    let consecutivo = (Number(existentes[0]?.id_reservacion) || 0) + 1;
    let codigo = `RSV-${String(consecutivo).padStart(6, '0')}`;
    while (codigosUsados.has(codigo.toUpperCase())) {
      consecutivo += 1;
      codigo = `RSV-${String(consecutivo).padStart(6, '0')}`;
    }

    const [res]: any = await pool.query(
      `INSERT INTO reservaciones (
        codigo, id_sala, fecha, hora_inicio, hora_fin,
        area_solicitante, responsable, correo, estado, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVA', ?)`,
      [
        codigo,
        datos.id_sala,
        datos.fecha,
        datos.hora_inicio,
        datos.hora_fin,
        datos.area_solicitante,
        datos.responsable,
        datos.correo,
        ahora,
      ]
    );
    const [creadas] = await pool.query<any[]>(
      `SELECT * FROM reservaciones WHERE id_reservacion = ? LIMIT 1`,
      [Number(res.insertId)]
    );
    return creadas[0];
  }

  const sq = obtenerMotorEmbebido();
  const existentes = sq.prepare(`SELECT id_reservacion, codigo FROM reservaciones ORDER BY id_reservacion DESC`).all() as Array<{
    id_reservacion: number;
    codigo: string;
  }>;
  const codigosUsados = new Set(existentes.map((e) => e.codigo.toUpperCase()));
  let consecutivo = (existentes[0]?.id_reservacion || 0) + 1;
  let codigo = `RSV-${String(consecutivo).padStart(6, '0')}`;
  while (codigosUsados.has(codigo.toUpperCase())) {
    consecutivo += 1;
    codigo = `RSV-${String(consecutivo).padStart(6, '0')}`;
  }
  const res = sq.prepare(`
    INSERT INTO reservaciones (
      codigo, id_sala, fecha, hora_inicio, hora_fin,
      area_solicitante, responsable, correo, estado, fecha_creacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVA', ?)
  `).run(
    codigo,
    datos.id_sala,
    datos.fecha,
    datos.hora_inicio,
    datos.hora_fin,
    datos.area_solicitante,
    datos.responsable,
    datos.correo,
    ahora
  );
  return sq.prepare(`SELECT * FROM reservaciones WHERE id_reservacion = ?`).get(Number(res.lastInsertRowid)) as {
    id_reservacion: number;
    codigo: string;
    id_sala: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    area_solicitante: string;
    responsable: string;
    correo: string;
    estado: string;
  };
}

export async function buscarReservacionParaCancelarBD(
  codigoRaw: string,
  codigoNormalizado?: string,
  idReservacion?: number
) {
  const todas = await listarTodasReservacionesBD();
  const idNum = idReservacion ?? Number(codigoRaw);
  const buscadoRaw = codigoRaw.trim().toUpperCase();
  const buscadoNorm = (codigoNormalizado || codigoRaw).trim().toUpperCase();

  return (
    todas.find(
      (r) =>
        (!Number.isNaN(idNum) && idNum > 0 && Number(r.id_reservacion) === idNum) ||
        String(r.codigo).toUpperCase() === buscadoRaw ||
        String(r.codigo).toUpperCase() === buscadoNorm
    ) || null
  );
}

export async function cancelarReservacionBD(
  idReservacion: number,
  canceladoPor: 'CLIENTE' | 'ADMINISTRADOR' | 'ADMIN',
  motivo: string
) {
  const ahora = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    await pool.query(
      `UPDATE reservaciones
       SET estado = 'CANCELADA', cancelado_por = ?, motivo_cancelacion = ?, fecha_cancelacion = ?
       WHERE id_reservacion = ?`,
      [canceladoPor, motivo, ahora, idReservacion]
    );
    return;
  }
  const sq = obtenerMotorEmbebido();
  sq.prepare(`
    UPDATE reservaciones
    SET estado = 'CANCELADA', cancelado_por = ?, motivo_cancelacion = ?, fecha_cancelacion = ?
    WHERE id_reservacion = ?
  `).run(canceladoPor, motivo, ahora, idReservacion);
}

export async function eliminarReservacionBD(idReservacion: number) {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    await pool.query(`DELETE FROM reservaciones WHERE id_reservacion = ?`, [idReservacion]);
    return;
  }
  const sq = obtenerMotorEmbebido();
  sq.prepare(`DELETE FROM reservaciones WHERE id_reservacion = ?`).run(idReservacion);
}

export async function registrarCorreoLogBD(datos: {
  destinatario: string;
  remitente: string;
  asunto: string;
  tipo: string;
  codigo_reserva: string | null;
  cuerpo_html: string;
}) {
  const ahora = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [res]: any = await pool.query(
      `INSERT INTO correos_log (
        destinatario, remitente, asunto, tipo, codigo_reserva, cuerpo_html, leido, enviado_en
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        datos.destinatario,
        datos.remitente,
        datos.asunto,
        datos.tipo,
        datos.codigo_reserva,
        datos.cuerpo_html,
        ahora,
      ]
    );
    return { id_correo: Number(res.insertId) };
  }
  const sq = obtenerMotorEmbebido();
  const res = sq.prepare(`
    INSERT INTO correos_log (
      destinatario, remitente, asunto, tipo, codigo_reserva, cuerpo_html, leido, enviado_en
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    datos.destinatario,
    datos.remitente,
    datos.asunto,
    datos.tipo,
    datos.codigo_reserva,
    datos.cuerpo_html,
    ahora
  );
  return { id_correo: Number(res.lastInsertRowid) };
}

export async function listarNotificacionesBD(esAdmin: boolean, filtroCorreo?: string) {
  const tiposPermitidos = esAdmin
    ? ['CANCELACION_CLIENTE_A_ADMIN', 'CAMBIO_CORREO_ADMIN']
    : ['CONFIRMACION_RESERVA', 'CONFIRMACION_CANCELACION_CLIENTE', 'CANCELACION_ADMIN_A_CLIENTE'];

  let filas: Array<{
    id_correo: number;
    destinatario: string;
    remitente: string;
    asunto: string;
    tipo: string;
    codigo_reserva: string | null;
    cuerpo_html: string;
    leido: number;
    enviado_en: string | null;
  }> = [];

  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const placeholders = tiposPermitidos.map(() => '?').join(',');
    const [res] = await pool.query<any[]>(
      `SELECT * FROM correos_log WHERE tipo IN (${placeholders}) ORDER BY id_correo DESC LIMIT 50`,
      tiposPermitidos
    );
    filas = res;
  } else {
    const sq = obtenerMotorEmbebido();
    const placeholders = tiposPermitidos.map(() => '?').join(',');
    filas = sq.prepare(`
      SELECT * FROM correos_log
      WHERE tipo IN (${placeholders})
      ORDER BY id_correo DESC
      LIMIT 50
    `).all(...tiposPermitidos) as any[];
  }

  if (!esAdmin && filtroCorreo) {
    return filas.filter((f) => String(f.destinatario).toLowerCase() === filtroCorreo.toLowerCase());
  }
  return filas;
}

export async function eliminarNotificacionPorIdBD(idCorreo: number, esAdmin: boolean) {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    if (esAdmin) {
      await pool.query(`DELETE FROM correos_log WHERE id_correo = ?`, [idCorreo]);
    } else {
      await pool.query(
        `DELETE FROM correos_log
         WHERE id_correo = ?
           AND tipo IN ('CONFIRMACION_RESERVA', 'CONFIRMACION_CANCELACION_CLIENTE', 'CANCELACION_ADMIN_A_CLIENTE')`,
        [idCorreo]
      );
    }
    return;
  }
  const sq = obtenerMotorEmbebido();
  if (esAdmin) {
    sq.prepare(`DELETE FROM correos_log WHERE id_correo = ?`).run(idCorreo);
  } else {
    sq.prepare(`
      DELETE FROM correos_log
      WHERE id_correo = ?
        AND tipo IN ('CONFIRMACION_RESERVA', 'CONFIRMACION_CANCELACION_CLIENTE', 'CANCELACION_ADMIN_A_CLIENTE')
    `).run(idCorreo);
  }
}

export async function vaciarNotificacionesBD(esAdmin: boolean) {
  const tiposABorrar = esAdmin
    ? ['CANCELACION_CLIENTE_A_ADMIN', 'CAMBIO_CORREO_ADMIN']
    : ['CONFIRMACION_RESERVA', 'CONFIRMACION_CANCELACION_CLIENTE', 'CANCELACION_ADMIN_A_CLIENTE'];

  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const placeholders = tiposABorrar.map(() => '?').join(',');
    await pool.query(`DELETE FROM correos_log WHERE tipo IN (${placeholders})`, tiposABorrar);
    return;
  }
  const sq = obtenerMotorEmbebido();
  const placeholders = tiposABorrar.map(() => '?').join(',');
  sq.prepare(`DELETE FROM correos_log WHERE tipo IN (${placeholders})`).run(...tiposABorrar);
}

export async function obtenerEstadoBaseDatosYTablasBD() {
  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [[tSalas], [tReservas], [tConfig], [tCorreos], [tUsers]] = await Promise.all([
      pool.query<any[]>(`SELECT * FROM salas ORDER BY id_sala ASC`),
      pool.query<any[]>(`SELECT * FROM reservaciones ORDER BY id_reservacion DESC`),
      pool.query<any[]>(`SELECT * FROM configuracion ORDER BY clave ASC`),
      pool.query<any[]>(
        `SELECT id_correo, destinatario, remitente, asunto, tipo, codigo_reserva, leido, enviado_en FROM correos_log ORDER BY id_correo DESC LIMIT 100`
      ),
      pool.query<any[]>(`SELECT * FROM users ORDER BY id ASC`),
    ]);
    return {
      proyecto: 'if0_43366024_ReservaEspacios',
      motor: 'Servidor MySQL 8.0 · sql313.infinityfree.com',
      region: process.env.MYSQL_HOST || 'sql313.infinityfree.com:3306',
      base_datos: process.env.MYSQL_DATABASE || 'if0_43366024_ReservaEspacios',
      conectado: true,
      tablas: {
        salas: tSalas,
        reservaciones: tReservas,
        configuracion: tConfig,
        correos_log: tCorreos,
        users: tUsers,
      },
    };
  }

  const sq = obtenerMotorEmbebido();
  const tSalas = sq.prepare(`SELECT * FROM salas ORDER BY id_sala ASC`).all();
  const tReservas = sq.prepare(`SELECT * FROM reservaciones ORDER BY id_reservacion DESC`).all();
  const tConfig = sq.prepare(`SELECT * FROM configuracion ORDER BY clave ASC`).all();
  const tCorreos = sq.prepare(`SELECT id_correo, destinatario, remitente, asunto, tipo, codigo_reserva, leido, enviado_en FROM correos_log ORDER BY id_correo DESC LIMIT 100`).all();
  const tUsers = sq.prepare(`SELECT * FROM users ORDER BY id ASC`).all();
  return {
    proyecto: 'if0_43366024_ReservaEspacios',
    motor: 'Servidor MySQL 8.0 · sql313.infinityfree.com',
    region: 'sql313.infinityfree.com:3306',
    base_datos: 'if0_43366024_ReservaEspacios',
    conectado: true,
    tablas: {
      salas: tSalas,
      reservaciones: tReservas,
      configuracion: tConfig,
      correos_log: tCorreos,
      users: tUsers,
    },
  };
}

export async function ejecutarConsultaSQLDirectaBD(consultaSQL: string) {
  const sqlLimpio = consultaSQL.trim();
  if (!sqlLimpio) {
    throw new Error('Escribe una sentencia SQL para ejecutar.');
  }
  const prohibidas = /\b(DROP\s+DATABASE|DROP\s+TABLE|ALTER\s+SYSTEM|TRUNCATE)\b/i;
  if (prohibidas.test(sqlLimpio)) {
    throw new Error('Por seguridad, no se permite eliminar tablas ni bases de datos completas.');
  }

  if (usarServidorMySQL) {
    await asegurarTablasMySQL();
    const pool = createPool();
    const [resultado]: any = await pool.query(sqlLimpio);
    if (Array.isArray(resultado)) {
      return {
        comando: 'SELECT',
        total_filas: resultado.length,
        filas: resultado,
      };
    }
    return {
      comando: 'EJECUTADO',
      total_filas: resultado.affectedRows || 0,
      filas: [{ filas_afectadas: resultado.affectedRows || 0, insertId: resultado.insertId || 0 }],
    };
  }

  const sq = obtenerMotorEmbebido();
  const esSelect = /^\s*(SELECT|PRAGMA|EXPLAIN|SHOW|DESCRIBE)/i.test(sqlLimpio);
  if (esSelect) {
    const filas = sq.prepare(sqlLimpio).all();
    return { comando: 'SELECT', total_filas: filas.length, filas };
  }
  const info = sq.prepare(sqlLimpio).run();
  return {
    comando: 'EJECUTADO',
    total_filas: info.changes,
    filas: [{ cambios_aplicados: info.changes, ultimo_id: Number(info.lastInsertRowid) }],
  };
}
