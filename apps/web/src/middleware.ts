import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, canAccessDashboard } from './lib/auth-store';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteção de rotas gerenciais restritas
  const isManagerRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/audit');
  const isManagerApi = pathname.startsWith('/api/dashboard');

  if (isManagerRoute || isManagerApi) {
    // Busca papel via cookie ou header HTTP (para testes de API)
    const roleFromCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const roleFromHeader = request.headers.get('x-user-role');
    const currentRole = roleFromHeader || roleFromCookie || 'agent';

    if (!canAccessDashboard(currentRole)) {
      if (isManagerApi) {
        return NextResponse.json(
          {
            error: 'ACCESS_DENIED_MANAGER_ONLY',
            message: 'Acesso negado: Apenas usuários com o papel manager possuem permissão para visualizar dados gerenciais.',
            attempted_role: currentRole,
          },
          { status: 403 }
        );
      }

      // Redireciona para página explicativa de Acesso Negado
      const deniedUrl = new URL('/access-denied', request.url);
      deniedUrl.searchParams.set('role', currentRole);
      deniedUrl.searchParams.set('target', pathname);
      return NextResponse.redirect(deniedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/audit/:path*', '/api/dashboard/:path*'],
};
