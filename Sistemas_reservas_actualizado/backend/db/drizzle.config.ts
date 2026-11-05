import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const mysqlHost = process.env.MYSQL_HOST || 'localhost';
const mysqlPort = Number(process.env.MYSQL_PORT || 3306);
const mysqlDatabase = process.env.MYSQL_DATABASE || 'ReservaEspacios';
const mysqlUser = process.env.MYSQL_USER || 'root';
const mysqlPassword = process.env.MYSQL_PASSWORD || '';

export default defineConfig({
  schema: './backend/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPassword,
    database: mysqlDatabase,
  },
  verbose: true,
});
