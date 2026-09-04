import { describe, it, expect } from 'vitest';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import { NextRequest } from 'next/server';

describe('Sistema de Autenticação Real Supabase Auth & RBAC', () => {
  it('Login com credenciais de Gerente retorna HTTP 200, papel manager e destino /dashboard', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'carlos.gerente@multifarma.com',
        password: 'MultiFarma@2026',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('manager');
    expect(body.user.email).toBe('carlos.gerente@multifarma.com');
    expect(body.redirectTo).toBe('/dashboard');

    // Verifica presença do cookie de sessão Supabase
    const setCookieHeader = res.headers.get('set-cookie');
    expect(setCookieHeader).toContain('sb_access_token');
    expect(setCookieHeader).toContain('mf_user_role=manager');
  });

  it('Login com credenciais de Atendente retorna HTTP 200, papel agent e destino /chatwoot-widget', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'ana.atendente@multifarma.com',
        password: 'MultiFarma@2026',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('agent');
    expect(body.redirectTo).toBe('/chatwoot-widget');

    const setCookieHeader = res.headers.get('set-cookie');
    expect(setCookieHeader).toContain('mf_user_role=agent');
  });

  it('Login com senha incorreta retorna HTTP 401 e mensagem amigável de erro', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'carlos.gerente@multifarma.com',
        password: 'SenhaTotalmenteIncorreta123!',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
    expect(body.message).toContain('E-mail ou senha incorretos');
  });

  it('Logout revoga sessão e expira os cookies de autenticação', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'sb_access_token=fake_token; mf_user_role=manager;',
      },
    });

    const res = await logoutHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/login');

    const setCookieHeader = res.headers.get('set-cookie');
    expect(setCookieHeader).toContain('Max-Age=0');
  });
});
