import dotenv from "dotenv";
if (process.env.NODE_ENV !== "test") dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "production",
  CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL || "",
  CHATWOOT_API_TOKEN: process.env.CHATWOOT_API_TOKEN || "",
  CHATWOOT_ACCOUNT_ID: parseInt(process.env.CHATWOOT_ACCOUNT_ID || "1", 10),
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || "",
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || "",
  EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME || "Farmacia",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || "",
  WEBHOOK_SECRET: process.env.CHATWOOT_WEBHOOK_SECRET || "",
  INTERNAL_TOKEN: process.env.HUB_INTERNAL_TOKEN || "",
  INBOX_MAP: process.env.CHATWOOT_INBOX_MAP || "{}",
  MOCK_MODE:
    process.env.MOCK_MODE === "true" || process.env.NODE_ENV === "test",
};
