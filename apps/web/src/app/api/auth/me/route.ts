import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthGetUser, supabaseRest } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, type UserContext } from '@/lib/auth-store';

export async function GET(req: NextRequest) {
  try {
    const token =
      req.cookies.get('sb_access_token')?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const res = await supabaseAuthGetUser(token);
    if (!res.data || res.error) {
      return NextResponse.json({ authenticated: false, error: res.error }, { status: 401 });
    }

    const authUser = res.data;
    const userId = authUser.id;

    let role = 'agent';
    let organizationId = '11111111-1111-1111-1111-111111111111';
    let fullName = authUser.user_metadata?.full_name || 'Usuário MultiFarma';
    const branchIds: string[] = [];
    let primaryBranchId: string | undefined = undefined;

    try {
      const profileRes = await supabaseRest<any[]>('profiles', {
        method: 'GET',
        params: { id: `eq.${userId}`, select: 'full_name' },
      });
      if (profileRes.data && profileRes.data.length > 0 && profileRes.data[0].full_name) {
        fullName = profileRes.data[0].full_name;
      }

      const memberRes = await supabaseRest<any[]>('organization_members', {
        method: 'GET',
        params: { user_id: `eq.${userId}`, select: 'organization_id,role' },
      });
      if (memberRes.data && memberRes.data.length > 0) {
        role = memberRes.data[0].role;
        organizationId = memberRes.data[0].organization_id;
      }

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
      console.warn('[Auth Me API] Falha ao consultar metadados do perfil:', err);
    }

    const user: UserContext = {
      user_id: userId,
      email: authUser.email || '',
      full_name: fullName,
      organization_id: organizationId,
      role: role as any,
      branch_ids: branchIds.length > 0 ? branchIds : ['22222222-2222-2222-2222-222222222221'],
      primary_branch_id: primaryBranchId || '22222222-2222-2222-2222-222222222221',
    };

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (err) {
    return NextResponse.json({ authenticated: false, error: (err as Error).message }, { status: 500 });
  }
}
