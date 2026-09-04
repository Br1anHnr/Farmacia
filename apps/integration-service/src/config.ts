import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL || 'https://chatwoot.homologacao.farmacia.com',
  CHATWOOT_API_TOKEN: process.env.CHATWOOT_API_TOKEN || 'mock_token',
  CHATWOOT_ACCOUNT_ID: parseInt(process.env.CHATWOOT_ACCOUNT_ID || '1', 10),
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'https://evolution.homologacao.farmacia.com',
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || 'mock_key',
  EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME || 'farmacia-homolog',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://mock.supabase.co',
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || 'mock_secret',
  MOCK_MODE: process.env.NODE_ENV !== 'production' && !process.env.REAL_INTEGRATIONS,
};
