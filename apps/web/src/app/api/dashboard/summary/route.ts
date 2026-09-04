import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, canAccessDashboard } from '@/lib/auth-store';
import { type DashboardKPIs } from '@hub-farmacia/contracts';

export async function GET(request: NextRequest) {
  // Verificação de autorização em nível de API
  const roleFromHeader = request.headers.get('x-user-role');
  const roleFromCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const currentRole = roleFromHeader || roleFromCookie || 'agent';

  // REGRA CRÍTICA DE ACESSO: Atendente e não-gerente recebem 403 Forbidden
  if (!canAccessDashboard(currentRole)) {
    return NextResponse.json(
      {
        error: 'ACCESS_DENIED_MANAGER_ONLY',
        message: 'Acesso negado: O papel agent não possui permissão para consultar dados comerciais agregados.',
        attempted_role: currentRole,
      },
      { status: 403 }
    );
  }

  // Dados consolidados autorizados para o gerente
  const kpis: DashboardKPIs = {
    total_revenue: 3489.50,
    confirmed_sales_count: 84,
    average_ticket: 41.54,
    conversion_rate: 68.2,
    total_conversations: 123,
    sales_by_channel: {
      whatsapp: 2840.00,
      instagram: 430.50,
      messenger: 219.00,
    },
    sales_by_branch: [
      {
        branch_id: '22222222-2222-2222-2222-222222222221',
        branch_name: 'MultiFarma Matriz Centro',
        total_revenue: 2210.00,
        sales_count: 52,
      },
      {
        branch_id: '22222222-2222-2222-2222-222222222222',
        branch_name: 'MultiFarma Filial Jardins',
        total_revenue: 1279.50,
        sales_count: 32,
      },
    ],
    sales_by_agent: [
      {
        agent_id: '33333333-3333-3333-3333-333333333332',
        agent_name: 'Ana Souza',
        total_revenue: 1620.00,
        sales_count: 38,
      },
      {
        agent_id: '33333333-3333-3333-3333-333333333333',
        agent_name: 'Bruno Lima',
        total_revenue: 1140.50,
        sales_count: 27,
      },
      {
        agent_id: '33333333-3333-3333-3333-333333333334',
        agent_name: 'Carla Prado',
        total_revenue: 729.00,
        sales_count: 19,
      },
    ],
    top_products: [
      { product_name: 'Dipirona 500mg 20 comp', quantity: 64, total_revenue: 544.00 },
      { product_name: 'Dorflex 36 comprimidos', quantity: 42, total_revenue: 945.00 },
      { product_name: 'Paracetamol 750mg 20 comp', quantity: 38, total_revenue: 456.00 },
      { product_name: 'Amoxicilina 500mg 21 cáps', quantity: 26, total_revenue: 751.40 },
      { product_name: 'Omeprazol 20mg 28 cáps', quantity: 18, total_revenue: 270.00 },
    ],
    delivery_vs_pickup: {
      delivery_count: 58,
      pickup_count: 26,
    },
  };

  return NextResponse.json(kpis, { status: 200 });
}
