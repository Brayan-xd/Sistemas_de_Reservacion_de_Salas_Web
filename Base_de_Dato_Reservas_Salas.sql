-- CREACIÓN DE LA BASE DE DATOS
CREATE DATABASE IF NOT EXISTS reservas_salas DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE reservas_salas;

-- Desactivar llaves foráneas temporalmente para asegurar una limpieza limpia
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS configuracion;
DROP TABLE IF EXISTS reservaciones;
DROP TABLE IF EXISTS salas;
SET FOREIGN_KEY_CHECKS = 1;

--CREACIÓN DE TABLAS

--Tabla salas
CREATE TABLE salas (
         id_sala INT AUTO_INCREMENT PRIMARY KEY,
         nombre VARCHAR(100) NOT NULL UNIQUE,          -- Nombre de la sala único
         edificio VARCHAR(100) NOT NULL,               -- Edificio o ubicación
         capacidad INT NOT NULL,                       -- Mayor que cero (validar en backend)
         encargado VARCHAR(120) NOT NULL,             -- Responsable del espacio
         activa BOOLEAN DEFAULT TRUE,                  -- Permite desactivar sin borrar historial
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB;

--Tabla reservaciones
CREATE TABLE reservaciones (
         id_reservacion BIGINT AUTO_INCREMENT PRIMARY KEY,
         codigo VARCHAR(20) NOT NULL UNIQUE,           -- Código visible (ej. RSV-000001)
         id_sala INT NOT NULL,                         -- Relación externa FK
         area_solicitante VARCHAR(120) NOT NULL,      -- Área solicitante
         responsable VARCHAR(120) NOT NULL,            -- Persona responsable
         correo VARCHAR(160) NOT NULL,                 -- Correo de notificación
         fecha DATE NOT NULL,                          -- Fecha de reservación
         hora_inicio TIME NOT NULL,                    -- Inicio del intervalo
         hora_fin TIME NOT NULL,                       -- Fin del intervalo
         estado VARCHAR(20) DEFAULT 'ACTIVA',          -- 'ACTIVA' o 'ELIMINADA' (borrado lógico)
         creada_en DATETIME DEFAULT CURRENT_TIMESTAMP, -- Fecha y hora de registro
         -- Restricción de llave foránea hacia salas
         CONSTRAINT fk_reservaciones_salas
             FOREIGN KEY (id_sala)
             REFERENCES salas(id_sala)
             ON DELETE RESTRICT
             ON UPDATE CASCADE
     ) ENGINE=InnoDB;

-- Tabla configuracion
CREATE TABLE configuracion (
         clave VARCHAR(60) PRIMARY KEY,                -- Nombre de la configuración como PK
         valor VARCHAR(255) NOT NULL,                  -- Valor de la propiedad
         descripcion TEXT NULL,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     ) ENGINE=InnoDB;

--CREACIÓN DE ÍNDICES RECOMENDADOS (Sección 6.4)
-- Índice compuesto primordial para el Tablero Visual (Sala + Fecha) y prevención de traslapes
CREATE INDEX idx_reservaciones_sala_fecha ON reservaciones(id_sala, fecha);

-- Índice individual por Fecha para consultas generales del día
CREATE INDEX idx_reservaciones_fecha ON reservaciones(fecha);

-- Índice por Área Solicitante para optimización de los módulos de reportes
CREATE INDEX idx_reservaciones_area ON reservaciones(area_solicitante);

-- Índice por Código de reservación para búsquedas administrativas/notificaciones rápidas
CREATE INDEX idx_reservaciones_codigo ON reservaciones(codigo);

-- Añadir los datos
USE reservas_salas;

-- CARGA DE DATOS INICIALES: SALAS (Sección 6.4 del documento)
INSERT INTO salas (nombre, edificio, capacidad, encargado, activa) VALUES
     ('Audiovisual 1', 'Edificio A', 50, 'Juan Pérez', TRUE),
     ('Audiovisual 2', 'Edificio B', 40, 'María López', TRUE),
     ('Audiovisual 3', 'Edificio C', 60, 'Pedro Ruiz', TRUE),
     ('Biblioteca', 'Edificio Biblioteca', 30, 'Ana Gómez', TRUE);

-- CARGA DE DATOS INICIALES: CONFIGURACIÓN (Sección 6.3 y Reglas)
INSERT INTO configuracion (clave, valor, descripcion) VALUES
     ('hora_apertura', '08:00:00', 'Horario de inicio permitido para reservar bloques (08:00)'),
     ('hora_cierre', '21:00:00', 'Horario límite permitido para finalizar bloques (21:00)'),
     ('duracion_minima_bloque_horas', '1', 'Duración mínima obligatoria por fracción de reserva'),
     ('dias_permitidos', 'LUNES-VIERNES', 'Restricción de días hábiles operacionales del sistema'),
     ('dias_anticipacion', 'PENDIENTE', 'Periodo de anticipación de reserva pendiente por confirmar por el Product Owner');

show tables;
+--------------------------+
| Tables_in_reservas_salas |
+--------------------------+
| configuracion            |
| reservaciones            |
| salas                    |
+--------------------------+


desc salas;
+------------+--------------+------+-----+-------------------+-------------------+
| Field      | Type         | Null | Key | Default           | Extra             |
+------------+--------------+------+-----+-------------------+-------------------+
| id_sala    | int          | NO   | PRI | NULL              | auto_increment    |
| nombre     | varchar(100) | NO   | UNI | NULL              |                   |
| edificio   | varchar(100) | NO   |     | NULL              |                   |
| capacidad  | int          | NO   |     | NULL              |                   |
| encargado  | varchar(120) | NO   |     | NULL              |                   |
| activa     | tinyint(1)   | YES  |     | 1                 |                   |
| created_at | timestamp    | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+------------+--------------+------+-----+-------------------+-------------------+

select * from salas;
+---------+---------------+---------------------+-----------+---------------+--------+---------------------+
| id_sala | nombre        | edificio            | capacidad | encargado     | activa | created_at          |
+---------+---------------+---------------------+-----------+---------------+--------+---------------------+
|       1 | Audiovisual 1 | Edificio A          |        50 | Juan Pérez    |      1 | 2026-11-04 12:09:03 |
|       2 | Audiovisual 2 | Edificio B          |        40 | María López   |      1 | 2026-11-04 12:09:03 |
|       3 | Audiovisual 3 | Edificio C          |        60 | Pedro Ruiz    |      1 | 2026-11-04 12:09:03 |
|       4 | Biblioteca    | Edificio Biblioteca |        30 | Ana Gómez     |      1 | 2026-11-04 12:09:03 |
+---------+---------------+---------------------+-----------+---------------+--------+---------------------+

UPDATE salas
     SET edificio = CASE
         WHEN nombre = 'Audiovisual 1' THEN 'A'
         WHEN nombre = 'Audiovisual 2' THEN 'B'
         WHEN nombre = 'Audiovisual 3' THEN 'C'
         WHEN nombre = 'Biblioteca'    THEN 'Biblioteca'
         ELSE edificio -- Mantiene el valor actual si hubiera otra sala registrada
     END
     WHERE nombre IN ('Audiovisual 1', 'Audiovisual 2', 'Audiovisual 3', 'Biblioteca');
select * from salas;
+---------+---------------+------------+-----------+---------------+--------+---------------------+
| id_sala | nombre        | edificio   | capacidad | encargado     | activa | created_at          |
+---------+---------------+------------+-----------+---------------+--------+---------------------+
|       1 | Audiovisual 1 | A          |        50 | Juan Pérez    |      1 | 2026-11-04 12:09:03 |
|       2 | Audiovisual 2 | B          |        40 | María López   |      1 | 2026-11-04 12:09:03 |
|       3 | Audiovisual 3 | C          |        60 | Pedro Ruiz    |      1 | 2026-11-04 12:09:03 |
|       4 | Biblioteca    | Biblioteca |        30 | Ana Gómez     |      1 | 2026-11-04 12:09:03 |
+---------+---------------+------------+-----------+---------------+--------+---------------------+


mysql>
