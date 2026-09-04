import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthLogout } from '@/lib/supabase';
import { AUTH_COOKIE_NAME } from '@/lib/auth-store';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('sb_access_token')?.value;

    if (token) {
      await supabaseAuthLogout(token);
    }

    const response = NextResponse.json({
      success: true,
      redirectTo: '/login',
    });

    const expireCookie = {
      path: '/',
      maxAge: 0,
      sameSite: 'lax' as const,
    };

    response.cookies.set('sb_access_token', '', expireCookie);
    response.cookies.set('sb_refresh_token', '', expireCookie);
    response.cookies.set(AUTH_COOKIE_NAME, '', expireCookie);
    response.cookies.set('mf_user_id', '', expireCookie);

    return response;
  } catch (err) {
    console.error('[Auth API] Erro ao deslogar:', err);
    return NextResponse.json({ success: true, redirectTo: '/login' });
  }
}
