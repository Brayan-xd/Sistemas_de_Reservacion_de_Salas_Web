import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.ts';

declare global {
  var _mysqlPoolReservaEspacios: mysql.Pool | undefined;
}

export const createPool = () => {
  if (!global._mysqlPoolReservaEspacios) {
    global._mysqlPoolReservaEspacios = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'ReservaEspacios',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return global._mysqlPoolReservaEspacios;
};

const pool = createPool();

export const db = drizzle(pool, { schema, mode: 'default' });
