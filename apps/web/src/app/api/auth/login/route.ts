import { NextRequest, NextResponse } from 'next/server';
import {
  supabaseAuthLogin,
  supabaseRest,
  SUPABASE_URL,
  SUPABASE_KEY,
} from '@/lib/supabase';
import { AUTH_COOKIE_NAME, type UserContext } from '@/lib/auth-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'MISSING_FIELDS',
          message: 'E-mail e senha são obrigatórios para acessar o sistema.',
        },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Valida credenciais no Supabase GoTrue Auth
    const authResult = await supabaseAuthLogin(cleanEmail, password);

    if (!authResult.data || authResult.error) {
      // Registra falha de autenticação na trilha de auditoria (RF-008)
      try {
        await supabaseRest('audit_events', {
          method: 'POST',
          body: {
            organization_id: '11111111-1111-1111-1111-111111111111',
            event_type: 'USER_LOGIN_FAILED',
            actor_type: 'system',
            payload: {
              attempted_email: cleanEmail,
              ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
              user_agent: req.headers.get('user-agent') || 'unknown',
              reason: authResult.error,
            },
          },
        });
      } catch (auditErr) {
        console.warn('[Auth API] Falha ao registrar log de auditoria de login com erro:', auditErr);
      }

      return NextResponse.json(
        {
          error: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha incorretos. Por favor, verifique suas credenciais de acesso.',
        },
        { status: 401 }
      );
    }

    const authData = authResult.data;
    const authUser = authData.user;
    const userId = authUser.id;

    // 2. Busca perfil, papel e filiais do usuário no banco
    let role = 'agent';
    let organizationId = '11111111-1111-1111-1111-111111111111';
    let fullName = authUser.user_metadata?.full_name || 'Usuário MultiFarma';
    const branchIds: string[] = [];
    let primaryBranchId: string | undefined = undefined;

    try {
      // Busca perfil
      const profileRes = await supabaseRest<any[]>('profiles', {
        method: 'GET',
        params: { id: `eq.${userId}`, select: 'full_name' },
      });
      if (profileRes.data && profileRes.data.length > 0 && profileRes.data[0].full_name) {
        fullName = profileRes.data[0].full_name;
      }

      // Busca papel na organização
      const memberRes = await supabaseRest<any[]>('organization_members', {
        method: 'GET',
        params: { user_id: `eq.${userId}`, select: 'organization_id,role' },
      });
      if (memberRes.data && memberRes.data.length > 0) {
        role = memberRes.data[0].role;
        organizationId = memberRes.data[0].organization_id;
      }

      // Busca filiais autorizadas
      const branchRes = await supabaseRest<any[]>('branch_members', {
        method: 'GET',
        params: { user_id: `eq.${userId}`, select: 'branch_id,is_primary' },
      });
      if (branchRes.data && branchRes.data.length > 0) {
        branchRes.data.forEach((b: any) => {
          branchIds.push(b.branch_id);
          if (b.is_primary) primaryBranchId = b.branch_id;
        });
      }
    } catch (err) {
      console.warn('[Auth API] Falha ao consultar metadados do perfil no banco, usando fallback:', err);
    }

    // 3. Registra auditoria de login bem-sucedido (RF-008)
    try {
      await supabaseRest('audit_events', {
        method: 'POST',
        body: {
          organization_id: organizationId,
          event_type: 'USER_LOGIN_SUCCESS',
          actor_type: 'user',
          actor_id: userId,
          payload: {
            email: cleanEmail,
            role,
            full_name: fullName,
            ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
            user_agent: req.headers.get('user-agent') || 'unknown',
          },
        },
      });
    } catch (auditErr) {
      console.warn('[Auth API] Falha ao registrar log de sucesso:', auditErr);
    }

    // 4. Monta o contexto do usuário
    const userContext: UserContext = {
      user_id: userId,
      email: cleanEmail,
      full_name: fullName,
      organization_id: organizationId,
      role: role as any,
      branch_ids: branchIds.length > 0 ? branchIds : ['22222222-2222-2222-2222-222222222221'],
      primary_branch_id: primaryBranchId || '22222222-2222-2222-2222-222222222221',
    };

    const redirectTo = role === 'manager' || role === 'admin' ? '/dashboard' : '/chatwoot-widget';

    const response = NextResponse.json({
      success: true,
      user: userContext,
      redirectTo,
    });

    // 5. Configura cookies de sessão HTTP seguros
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      path: '/',
      sameSite: 'lax' as const,
      secure: isProduction,
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    };

    response.cookies.set('sb_access_token', authData.access_token, cookieOptions);
    if (authData.refresh_token) {
      response.cookies.set('sb_refresh_token', authData.refresh_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30 dias
      });
    }
    response.cookies.set(AUTH_COOKIE_NAME, role, cookieOptions);
    response.cookies.set('mf_user_id', userId, cookieOptions);

    return response;
  } catch (err) {
    console.error('[Auth API] Erro no endpoint de login:', err);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno ao processar sua autenticação.',
      },
      { status: 500 }
    );
  }
}
