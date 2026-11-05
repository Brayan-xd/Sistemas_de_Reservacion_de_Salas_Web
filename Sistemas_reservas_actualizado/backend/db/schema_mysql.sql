-- ============================================================================
-- SCRIPT OFICIAL MYSQL PARA INFINITYFREE (phpMyAdmin)
-- Servidor MySQL: sql313.infinityfree.com (Puerto 3306)
-- Base de Datos:  if0_43366024_ReservaEspacios
-- Usuario MySQL:  if0_43366024
--
-- CÓMO IMPORTAR EN INFINITYFREE:
--   1. En tu panel de InfinityFree entra a "MySQL Databases".
--   2. Haz clic en el botón "phpMyAdmin" junto a if0_43366024_ReservaEspacios.
--   3. Arriba haz clic en la pestaña "Import" (Importar).
--   4. Selecciona este archivo (schema_mysql.sql) y presiona "Import" (Continuar).
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(128) NOT NULL UNIQUE,
  `email` VARCHAR(180) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Salas y Espacios Institucionales
CREATE TABLE IF NOT EXISTS `salas` (
  `id_sala` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(120) NOT NULL,
  `edificio` VARCHAR(120) NOT NULL,
  `capacidad` INT NOT NULL,
  `encargado` VARCHAR(150) NOT NULL,
  `activa` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabla de Reservaciones
CREATE TABLE IF NOT EXISTS `reservaciones` (
  `id_reservacion` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(32) NOT NULL UNIQUE,
  `id_sala` INT NOT NULL,
  `fecha` VARCHAR(20) NOT NULL,
  `hora_inicio` VARCHAR(10) NOT NULL,
  `hora_fin` VARCHAR(10) NOT NULL,
  `area_solicitante` VARCHAR(160) NOT NULL,
  `responsable` VARCHAR(160) NOT NULL,
  `correo` VARCHAR(180) NOT NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
  `cancelado_por` VARCHAR(40) DEFAULT NULL,
  `motivo_cancelacion` TEXT DEFAULT NULL,
  `fecha_cancelacion` VARCHAR(30) DEFAULT NULL,
  `fecha_creacion` VARCHAR(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla de Configuración del Sistema y Credenciales SMTP
CREATE TABLE IF NOT EXISTS `configuracion` (
  `clave` VARCHAR(100) PRIMARY KEY,
  `valor` TEXT NOT NULL,
  `actualizado_en` VARCHAR(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabla de Historial de Notificaciones y Correos Enviados
CREATE TABLE IF NOT EXISTS `correos_log` (
  `id_correo` INT AUTO_INCREMENT PRIMARY KEY,
  `destinatario` VARCHAR(180) NOT NULL,
  `remitente` VARCHAR(180) NOT NULL,
  `asunto` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(60) NOT NULL,
  `codigo_reserva` VARCHAR(32) DEFAULT NULL,
  `cuerpo_html` LONGTEXT NOT NULL,
  `leido` TINYINT(1) NOT NULL DEFAULT 0,
  `enviado_en` VARCHAR(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- DATOS INICIALES — 4 ESPACIOS INSTITUCIONALES, USUARIO Y CONFIGURACIÓN
-- ============================================================================

INSERT INTO `salas` (`id_sala`, `nombre`, `edificio`, `capacidad`, `encargado`, `activa`) VALUES
  (1, 'Sala Audiovisual 1', 'Edificio D1', 60, 'Subdirección Académica', 1),
  (2, 'Sala Audiovisual 2', 'Edificio D1', 60, 'Subdirección Académica', 1),
  (3, 'Sala Audiovisual 3', 'Edificio D2', 45, 'Coordinación de Posgrado', 1),
  (4, 'Biblioteca', 'Centro de Información', 120, 'Jefatura del Centro de Información', 1)
ON DUPLICATE KEY UPDATE
  `nombre` = VALUES(`nombre`),
  `edificio` = VALUES(`edificio`),
  `capacidad` = VALUES(`capacidad`),
  `encargado` = VALUES(`encargado`),
  `activa` = VALUES(`activa`);

INSERT INTO `configuracion` (`clave`, `valor`, `actualizado_en`) VALUES
  ('correo_admin', 'eduardoenriquezramos8@gmail.com', '2026-11-05 09:00:00'),
  ('admin_password', 'admin123', '2026-11-05 09:00:00'),
  ('smtp_host', 'smtp.gmail.com', '2026-11-05 09:00:00'),
  ('smtp_port', '587', '2026-11-05 09:00:00'),
  ('smtp_user', 'eduardoenriquezramos8@gmail.com', '2026-11-05 09:00:00'),
  ('smtp_pass', 'sarhtaxrxblnjopi', '2026-11-05 09:00:00')
ON DUPLICATE KEY UPDATE
  `valor` = VALUES(`valor`),
  `actualizado_en` = VALUES(`actualizado_en`);

INSERT INTO `users` (`id`, `uid`, `email`) VALUES
  (1, 'if0_43366024', 'eduardoenriquezramos8@gmail.com')
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`);
