import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL nao encontrada. Configure o .env do CALENDARIO antes de rodar.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
DROP TABLE IF EXISTS public.whatsapp_messages;
DROP TABLE IF EXISTS public.whatsapp_conversations;
DROP TABLE IF EXISTS public.whatsapp_contacts;
`;

try {
  await pool.query(sql);
  console.log("Tabelas do WhatsApp CRM removidas com sucesso.");
} catch (err) {
  console.error("Erro ao remover tabelas do WhatsApp CRM:");
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
