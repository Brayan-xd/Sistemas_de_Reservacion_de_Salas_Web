mysql> create database reservas_salas
    -> ;
Query OK, 1 row affected (0.00 sec)

mysql> use database reservas_salas
ERROR 1049 (42000): Unknown database 'database'
mysql> use reservas_salas
Database changed
mysql> create table salas;
ERROR 4028 (HY000): A table must have at least one visible column.
mysql> create table salas (
    -> id INT AUTO_INCREMENT PRIMARY KEY,
    -> nombre varchar(100) NOT NULL,
    -> capacidad INT NOT NULL,
    -> ubicacion varchar(255) NULL,
    -> activo BOOLEAN DEFAULT TRUE,
    -> created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    -> ENGINE=InnoDB;
Query OK, 0 rows affected (0.01 sec)

mysql> CREATE TABLE reservaciones (
    ->     id INT AUTO_INCREMENT PRIMARY KEY,
    ->     sala_id INT NOT NULL,
    ->     usuario_nombre VARCHAR(100) NOT NULL, -- Identificador simple del usuario que reserva
    ->     fecha DATE NOT NULL,
    ->     hora_inicio TIME NOT NULL,
    ->     hora_fin TIME NOT NULL,
    ->     estado VARCHAR(20) DEFAULT 'confirmada', -- 'confirmada', 'cancelada', etc.
    ->     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ->     -- Clave foránea
    ->     CONSTRAINT fk_reservaciones_salas
    ->         FOREIGN KEY (sala_id)
    ->         REFERENCES salas(id)
    ->         ON DELETE CASCADE
    ->         ON UPDATE CASCADE
    -> ) ENGINE=InnoDB;
Query OK, 0 rows affected (0.02 sec)

mysql> CREATE TABLE configuracion (
    ->     id INT AUTO_INCREMENT PRIMARY KEY,
    ->     clave VARCHAR(50) NOT NULL UNIQUE,
    ->     valor VARCHAR(255) NOT NULL,
    ->     descripcion TEXT NULL,
    ->     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    -> ) ENGINE=InnoDB;
Query OK, 0 rows affected (0.02 sec)

mysql> CREATE INDEX idx_salas_nombre ON salas(nombre);
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> CREATE INDEX idx_reservaciones_disponibilidad ON reservaciones(sala_id, fecha, hora_inicio, hora_fin);
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> use reservas_salas
Database changed
mysql> drop reservas_salas
    -> ;
ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'reservas_salas' at line 1
mysql> drop database reservas_salas;
Query OK, 3 rows affected (0.02 sec)

mysql> databases;
ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'databases' at line 1
mysql> show databases;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| performance_schema |
| sakila             |
| sys                |
| world              |
+--------------------+
6 rows in set (0.00 sec)

mysql> -- ====================================================================
mysql> -- 1. CREACIÓN DE LA BASE DE DATOS E INTEGRIDAD DIALECTO
mysql> -- ====================================================================
mysql> CREATE DATABASE IF NOT EXISTS reservas_salas DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
Query OK, 1 row affected (0.00 sec)

mysql> USE reservas_salas;
Database changed
mysql>
mysql> -- Desactivar llaves foráneas temporalmente para asegurar una limpieza limpia
mysql> SET FOREIGN_KEY_CHECKS = 0;
Query OK, 0 rows affected (0.00 sec)

mysql> DROP TABLE IF EXISTS configuracion;
Query OK, 0 rows affected, 1 warning (0.00 sec)

mysql> DROP TABLE IF EXISTS reservaciones;
Query OK, 0 rows affected, 1 warning (0.00 sec)

mysql> DROP TABLE IF EXISTS salas;
Query OK, 0 rows affected, 1 warning (0.00 sec)

mysql> SET FOREIGN_KEY_CHECKS = 1;
Query OK, 0 rows affected (0.00 sec)

mysql>
mysql> -- ====================================================================
mysql> -- 2. CREACIÓN DE TABLAS (Sección 6 del documento técnico)
mysql> -- ====================================================================
mysql>
mysql> -- 6.1 Tabla: salas
mysql> CREATE TABLE salas (
    ->     id_sala INT AUTO_INCREMENT PRIMARY KEY,
    ->     nombre VARCHAR(100) NOT NULL UNIQUE,          -- Nombre de la sala único
    ->     edificio VARCHAR(100) NOT NULL,               -- Edificio o ubicación
    ->     capacidad INT NOT NULL,                       -- Mayor que cero (validar en backend)
    ->     encargado VARCHAR(120) NOT NULL,             -- Responsable del espacio
    ->     activa BOOLEAN DEFAULT TRUE,                  -- Permite desactivar sin borrar historial
    ->     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -> ) ENGINE=InnoDB;
Query OK, 0 rows affected (0.02 sec)

mysql>
mysql> -- 6.2 Tabla: reservaciones
mysql> CREATE TABLE reservaciones (
    ->     id_reservacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    ->     codigo VARCHAR(20) NOT NULL UNIQUE,           -- Código visible (ej. RSV-000001)
    ->     id_sala INT NOT NULL,                         -- Relación externa FK
    ->     area_solicitante VARCHAR(120) NOT NULL,      -- Área solicitante
    ->     responsable VARCHAR(120) NOT NULL,            -- Persona responsable
    ->     correo VARCHAR(160) NOT NULL,                 -- Correo de notificación
    ->     fecha DATE NOT NULL,                          -- Fecha de reservación
    ->     hora_inicio TIME NOT NULL,                    -- Inicio del intervalo
    ->     hora_fin TIME NOT NULL,                       -- Fin del intervalo
    ->     estado VARCHAR(20) DEFAULT 'ACTIVA',          -- 'ACTIVA' o 'ELIMINADA' (borrado lógico)
    ->     creada_en DATETIME DEFAULT CURRENT_TIMESTAMP, -- Fecha y hora de registro
    ->     -- Restricción de llave foránea hacia salas
    ->     CONSTRAINT fk_reservaciones_salas
    ->         FOREIGN KEY (id_sala)
    ->         REFERENCES salas(id_sala)
    ->         ON DELETE RESTRICT
    ->         ON UPDATE CASCADE
    -> ) ENGINE=InnoDB;
Query OK, 0 rows affected (0.02 sec)

mysql>
mysql> -- 6.3 Tabla: configuracion
mysql> CREATE TABLE configuracion (
    ->     clave VARCHAR(60) PRIMARY KEY,                -- Nombre de la configuración como PK
    ->     valor VARCHAR(255) NOT NULL,                  -- Valor de la propiedad
    ->     descripcion TEXT NULL,
    ->     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    -> ) ENGINE=InnoDB;
Query OK, 0 rows affected (0.01 sec)

mysql>
mysql> -- ====================================================================
mysql> -- 3. CREACIÓN DE ÍNDICES RECOMENDADOS (Sección 6.4)
mysql> -- ====================================================================
mysql> -- Índice compuesto primordial para el Tablero Visual (Sala + Fecha) y prevención de traslapes
mysql> CREATE INDEX idx_reservaciones_sala_fecha ON reservaciones(id_sala, fecha);
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql>
mysql> -- Índice individual por Fecha para consultas generales del día
mysql> CREATE INDEX idx_reservaciones_fecha ON reservaciones(fecha);
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql>
mysql> -- Índice por Área Solicitante para optimización de los módulos de reportes
mysql> CREATE INDEX idx_reservaciones_area ON reservaciones(area_solicitante);
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql>
mysql> -- Índice por Código de reservación para búsquedas administrativas/notificaciones rápidas
mysql> CREATE INDEX idx_reservaciones_codigo ON reservaciones(codigo);
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> USE reservas_salas;
Database changed
mysql>
mysql> -- ====================================================================
mysql> -- 1. CARGA DE DATOS INICIALES: SALAS (Sección 6.4 del documento)
mysql> -- ====================================================================
mysql> INSERT INTO salas (nombre, edificio, capacidad, encargado, activa) VALUES
    -> ('Audiovisual 1', 'Edificio A', 50, 'Juan Pérez', TRUE),
    -> ('Audiovisual 2', 'Edificio B', 40, 'María López', TRUE),
    -> ('Audiovisual 3', 'Edificio C', 60, 'Pedro Ruiz', TRUE),
    -> ('Biblioteca', 'Edificio Biblioteca', 30, 'Ana Gómez', TRUE);
Query OK, 4 rows affected (0.00 sec)
Records: 4  Duplicates: 0  Warnings: 0

mysql>
mysql> -- ====================================================================
mysql> -- 2. CARGA DE DATOS INICIALES: CONFIGURACIÓN (Sección 6.3 y Reglas)
mysql> -- ====================================================================
mysql> INSERT INTO configuracion (clave, valor, descripcion) VALUES
    -> ('hora_apertura', '08:00:00', 'Horario de inicio permitido para reservar bloques (08:00)'),
    -> ('hora_cierre', '21:00:00', 'Horario límite permitido para finalizar bloques (21:00)'),
    -> ('duracion_minima_bloque_horas', '1', 'Duración mínima obligatoria por fracción de reserva'),
    -> ('dias_permitidos', 'LUNES-VIERNES', 'Restricción de días hábiles operacionales del sistema'),
    -> ('dias_anticipacion', 'PENDIENTE', 'Periodo de anticipación de reserva pendiente por confirmar por el Product Owner');
Query OK, 5 rows affected (0.00 sec)
Records: 5  Duplicates: 0  Warnings: 0

mysql> show tables;
+--------------------------+
| Tables_in_reservas_salas |
+--------------------------+
| configuracion            |
| reservaciones            |
| salas                    |
+--------------------------+
3 rows in set (0.00 sec)

mysql> desc salas;
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
7 rows in set (0.00 sec)

mysql> select * from salas;
+---------+---------------+---------------------+-----------+---------------+--------+---------------------+
| id_sala | nombre        | edificio            | capacidad | encargado     | activa | created_at          |
+---------+---------------+---------------------+-----------+---------------+--------+---------------------+
|       1 | Audiovisual 1 | Edificio A          |        50 | Juan Pérez    |      1 | 2026-11-04 12:09:03 |
|       2 | Audiovisual 2 | Edificio B          |        40 | María López   |      1 | 2026-11-04 12:09:03 |
|       3 | Audiovisual 3 | Edificio C          |        60 | Pedro Ruiz    |      1 | 2026-11-04 12:09:03 |
|       4 | Biblioteca    | Edificio Biblioteca |        30 | Ana Gómez     |      1 | 2026-11-04 12:09:03 |
+---------+---------------+---------------------+-----------+---------------+--------+---------------------+
4 rows in set (0.00 sec)

mysql> UPDATE salas
    -> SET edificio = CASE
    ->     WHEN nombre = 'Audiovisual 1' THEN 'A'
    ->     WHEN nombre = 'Audiovisual 2' THEN 'B'
    ->     WHEN nombre = 'Audiovisual 3' THEN 'C'
    ->     WHEN nombre = 'Biblioteca'    THEN 'Biblioteca'
    ->     ELSE edificio -- Mantiene el valor actual si hubiera otra sala registrada
    -> END
    -> WHERE nombre IN ('Audiovisual 1', 'Audiovisual 2', 'Audiovisual 3', 'Biblioteca');
Query OK, 4 rows affected (0.00 sec)
Rows matched: 4  Changed: 4  Warnings: 0

mysql> select * from salas;
+---------+---------------+------------+-----------+---------------+--------+---------------------+
| id_sala | nombre        | edificio   | capacidad | encargado     | activa | created_at          |
+---------+---------------+------------+-----------+---------------+--------+---------------------+
|       1 | Audiovisual 1 | A          |        50 | Juan Pérez    |      1 | 2026-11-04 12:09:03 |
|       2 | Audiovisual 2 | B          |        40 | María López   |      1 | 2026-11-04 12:09:03 |
|       3 | Audiovisual 3 | C          |        60 | Pedro Ruiz    |      1 | 2026-11-04 12:09:03 |
|       4 | Biblioteca    | Biblioteca |        30 | Ana Gómez     |      1 | 2026-11-04 12:09:03 |
+---------+---------------+------------+-----------+---------------+--------+---------------------+
4 rows in set (0.00 sec)

mysql>