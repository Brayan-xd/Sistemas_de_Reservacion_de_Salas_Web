import { relations } from 'drizzle-orm';
import { int, mysqlTable, serial, text, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  uid: varchar('uid', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 180 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const salas = mysqlTable('salas', {
  id_sala: serial('id_sala').primaryKey(),
  nombre: varchar('nombre', { length: 120 }).notNull(),
  edificio: varchar('edificio', { length: 120 }).notNull(),
  capacidad: int('capacidad').notNull(),
  encargado: varchar('encargado', { length: 150 }).notNull(),
  activa: int('activa').notNull().default(1),
});

export const reservaciones = mysqlTable('reservaciones', {
  id_reservacion: serial('id_reservacion').primaryKey(),
  codigo: varchar('codigo', { length: 32 }).notNull().unique(),
  id_sala: int('id_sala').notNull(),
  fecha: varchar('fecha', { length: 20 }).notNull(),
  hora_inicio: varchar('hora_inicio', { length: 10 }).notNull(),
  hora_fin: varchar('hora_fin', { length: 10 }).notNull(),
  area_solicitante: varchar('area_solicitante', { length: 160 }).notNull(),
  responsable: varchar('responsable', { length: 160 }).notNull(),
  correo: varchar('correo', { length: 180 }).notNull(),
  estado: varchar('estado', { length: 30 }).notNull().default('ACTIVA'),
  cancelado_por: varchar('cancelado_por', { length: 40 }),
  motivo_cancelacion: text('motivo_cancelacion'),
  fecha_cancelacion: varchar('fecha_cancelacion', { length: 30 }),
  fecha_creacion: varchar('fecha_creacion', { length: 30 }),
});

export const configuracion = mysqlTable('configuracion', {
  clave: varchar('clave', { length: 100 }).primaryKey(),
  valor: text('valor').notNull(),
  actualizado_en: varchar('actualizado_en', { length: 30 }),
});

export const correosLog = mysqlTable('correos_log', {
  id_correo: serial('id_correo').primaryKey(),
  destinatario: varchar('destinatario', { length: 180 }).notNull(),
  remitente: varchar('remitente', { length: 180 }).notNull(),
  asunto: varchar('asunto', { length: 255 }).notNull(),
  tipo: varchar('tipo', { length: 60 }).notNull(),
  codigo_reserva: varchar('codigo_reserva', { length: 32 }),
  cuerpo_html: text('cuerpo_html').notNull(),
  leido: int('leido').notNull().default(0),
  enviado_en: varchar('enviado_en', { length: 30 }),
});

export const salasRelations = relations(salas, ({ many }) => ({
  reservaciones: many(reservaciones),
}));

export const reservacionesRelations = relations(reservaciones, ({ one }) => ({
  sala: one(salas, {
    fields: [reservaciones.id_sala],
    references: [salas.id_sala],
  }),
}));
