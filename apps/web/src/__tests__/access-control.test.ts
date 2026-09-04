import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/dashboard/summary/route';
import { NextRequest } from 'next/server';

describe('Regra Crítica de Segurança e Acesso ao Dashboard', () => {
  it('REGRA ESSENCIAL: Atendente (agent) recebe HTTP 403 Forbidden ao tentar acessar o dashboard comercial', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/summary', {
      headers: {
        'x-user-role': 'agent',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('ACCESS_DENIED_MANAGER_ONLY');
    expect(body.attempted_role).toBe('agent');
  });

  it('REGRA ESSENCIAL: Admin técnico sem papel manager também recebe HTTP 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/summary', {
      headers: {
        'x-user-role': 'admin',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('ACCESS_DENIED_MANAGER_ONLY');
  });

  it('Gerente (manager) tem acesso autorizado com HTTP 200 e recebe métricas consolidadas', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/summary', {
      headers: {
        'x-user-role': 'manager',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total_revenue).toBeGreaterThan(0);
    expect(body.confirmed_sales_count).toBeGreaterThan(0);
    expect(body.conversion_rate).toBeGreaterThan(0);
    expect(body.sales_by_channel).toBeDefined();
    expect(body.sales_by_branch.length).toBeGreaterThanOrEqual(2);
  });
});

import { middleware } from '../middleware';

describe('Middleware de Proteção de Rotas e RBAC', () => {
  it('Redireciona usuário deslogado tentando acessar /dashboard para /login', () => {
    const req = new NextRequest('http://localhost:3000/dashboard');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?redirect=%2Fdashboard');
  });

  it('Retorna HTTP 401 para chamada de API gerencial deslogada', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/summary');
    const res = middleware(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHENTICATED');
  });

  it('Redireciona atendente logado tentando acessar /dashboard para /access-denied', () => {
    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'sb_access_token=token_valido; mf_user_role=agent',
      },
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/access-denied?role=agent');
  });

  it('Permite passagem do gerente autenticado para /dashboard', () => {
    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'sb_access_token=token_valido; mf_user_role=manager',
      },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});

