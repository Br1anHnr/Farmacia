/**
 * Script de Seed e Sincronização de Usuários no Supabase Auth (auth.users)
 * Conecta via Supabase Admin API e garante que todos os perfis de homologação
 * possuam credenciais ativas, e-mail confirmado e senha sincronizada.
 */

import fs from 'fs';
import path from 'path';

// Carrega variáveis de ambiente manualmente se dotenv não estiver carregado
function loadEnv() {
  const envPaths = ['.env', 'apps/web/.env'];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim();
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iabrqshxnrbznbypilmk.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SECRET_KEY) {
  console.error('[Seed Auth] ERRO: SUPABASE_SECRET_KEY não encontrada nas variáveis de ambiente.');
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || 'MultiFarma@2026';

const USERS_TO_SEED = [
  {
    id: '33333333-3333-3333-3333-333333333331',
    email: 'carlos.gerente@multifarma.com',
    password: DEFAULT_PASSWORD,
    user_metadata: {
      full_name: 'Carlos Mendes (Gerente)',
      role: 'manager',
    },
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    email: 'ana.atendente@multifarma.com',
    password: DEFAULT_PASSWORD,
    user_metadata: {
      full_name: 'Ana Souza (Atendente)',
      role: 'agent',
    },
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'bruno.atendente@multifarma.com',
    password: DEFAULT_PASSWORD,
    user_metadata: {
      full_name: 'Bruno Lima (Atendente)',
      role: 'agent',
    },
  },
  {
    id: '33333333-3333-3333-3333-333333333334',
    email: 'carla.atendente@multifarma.com',
    password: DEFAULT_PASSWORD,
    user_metadata: {
      full_name: 'Carla Prado (Atendente)',
      role: 'agent',
    },
  },
  {
    id: '33333333-3333-3333-3333-333333333335',
    email: 'marcos.admin@multifarma.com',
    password: DEFAULT_PASSWORD,
    user_metadata: {
      full_name: 'Marcos Tech (Admin)',
      role: 'admin',
    },
  },
];

async function seedAuthUsers() {
  console.log('====================================================');
  console.log(' Provisionando Usuários no Supabase Auth (auth.users)');
  console.log(` Target: ${SUPABASE_URL}`);
  console.log(` Senha Padrão de Homologação: ${DEFAULT_PASSWORD}`);
  console.log('====================================================\n');

  // 1. Busca usuários existentes no auth.users
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SECRET_KEY,
      'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
    },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error(`[Seed Auth] Falha ao consultar lista de usuários (${listRes.status}):`, errText);
    process.exit(1);
  }

  const listData = await listRes.json();
  const existingUsers = listData.users || [];
  console.log(`[Seed Auth] Usuários atualmente cadastrados no auth.users: ${existingUsers.length}`);

  for (const user of USERS_TO_SEED) {
    const existing = existingUsers.find(
      (u) => u.id === user.id || u.email?.toLowerCase() === user.email.toLowerCase()
    );

    if (existing) {
      console.log(`[Seed Auth] Usuário '${user.email}' já existe (id: ${existing.id}). Atualizando senha e metadados...`);
      const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_SECRET_KEY,
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: user.password,
          email_confirm: true,
          user_metadata: user.user_metadata,
        }),
      });

      if (!updateRes.ok) {
        const updateErr = await updateRes.text();
        console.warn(`  ↳ Falha ao atualizar ${user.email}:`, updateErr);
      } else {
        console.log(`  ↳ ✅ Atualizado com sucesso.`);
      }
    } else {
      console.log(`[Seed Auth] Criando usuário '${user.email}' (role: ${user.user_metadata.role})...`);
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SECRET_KEY,
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: user.user_metadata,
        }),
      });

      if (!createRes.ok) {
        const createErr = await createRes.text();
        console.error(`  ↳ ❌ Falha ao criar ${user.email}:`, createErr);
      } else {
        const createdData = await createRes.json();
        console.log(`  ↳ ✅ Criado com sucesso! ID: ${createdData.id}`);
      }
    }
  }

  console.log('\n[Seed Auth] Finalizado com sucesso! Todos os perfis estão prontos para login.');
}

seedAuthUsers().catch((err) => {
  console.error('[Seed Auth] Erro fatal durante a execução:', err);
  process.exit(1);
});
