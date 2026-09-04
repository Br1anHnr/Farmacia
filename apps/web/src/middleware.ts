import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, canAccessDashboard } from './lib/auth-store';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tokenFromCookie = request.cookies.get('sb_access_token')?.value;
  const roleFromCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const roleFromHeader = request.headers.get('x-user-role');
  const currentRole = roleFromHeader || roleFromCookie || 'agent';

  // Se o usuário já estiver autenticado e tentar acessar a página de /login
  if (pathname === '/login') {
    if (tokenFromCookie) {
      const destination = canAccessDashboard(currentRole) ? '/dashboard' : '/chatwoot-widget';
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next();
  }

  // Identificação de tipos de rotas protegidas
  const isManagerRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/audit');
  const isManagerApi = pathname.startsWith('/api/dashboard') || pathname.startsWith('/api/audit');
  const isProtectedRoute =
    isManagerRoute ||
    isManagerApi ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/chatwoot-widget');

  if (isProtectedRoute) {
    // 1. Verificação de autenticação: exige token ou header de teste
    const hasAuth = !!tokenFromCookie || !!roleFromHeader;

    if (!hasAuth) {
      if (isManagerApi) {
        return NextResponse.json(
          {
            error: 'UNAUTHENTICATED',
            message: 'Acesso negado: Sessão de usuário não encontrada. Por favor, efetue login.',
          },
          { status: 401 }
        );
      }

      // Redireciona usuário deslogado para a tela de login com o destino pretendido
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 2. Verificação de autorização RBAC para rotas restritas de gerência (PRD Seção 6 e 14)
    if (isManagerRoute || isManagerApi) {
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

        // Redireciona atendente para a página explicativa de Acesso Negado
        const deniedUrl = new URL('/access-denied', request.url);
        deniedUrl.searchParams.set('role', currentRole);
        deniedUrl.searchParams.set('target', pathname);
        return NextResponse.redirect(deniedUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/audit/:path*',
    '/chat/:path*',
    '/chatwoot-widget/:path*',
    '/api/dashboard/:path*',
    '/api/audit/:path*',
  ],
};
