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
