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
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  wa_id TEXT,
  name TEXT,
  last_message_at TIMESTAMPTZ,
  service_window_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bot', 'human', 'closed')),
  assigned_to TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_one_open_per_contact
  ON public.whatsapp_conversations(contact_id)
  WHERE status <> 'closed';

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL DEFAULT 'customer' CHECK (sender_type IN ('customer', 'bot', 'human', 'system')),
  whatsapp_message_id TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  media_id TEXT,
  status TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_unique_whatsapp_id
  ON public.whatsapp_messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_created_idx
  ON public.whatsapp_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_last_message_idx
  ON public.whatsapp_conversations(last_message_at DESC);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
`;

try {
  await pool.query(sql);
  console.log("Tabelas do WhatsApp CRM criadas/validadas com sucesso.");
} catch (err) {
  console.error("Erro ao criar tabelas do WhatsApp CRM:");
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
