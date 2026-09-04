import { type UserRole, type UserContext } from '@hub-farmacia/contracts';

export type { UserContext };

export const DEMO_PERSONAS: Record<string, UserContext> = {
  gerente: {
    user_id: '33333333-3333-3333-3333-333333333331',
    email: 'carlos.gerente@multifarma.com',
    full_name: 'Carlos Mendes (Gerente Geral)',
    organization_id: '11111111-1111-1111-1111-111111111111',
    role: 'manager',
    branch_ids: [
      '22222222-2222-2222-2222-222222222221',
      '22222222-2222-2222-2222-222222222222',
    ],
    primary_branch_id: '22222222-2222-2222-2222-222222222221',
  },
  atendente_ana: {
    user_id: '33333333-3333-3333-3333-333333333332',
    email: 'ana.atendente@multifarma.com',
    full_name: 'Ana Souza (Atendente Farmacêutica)',
    organization_id: '11111111-1111-1111-1111-111111111111',
    role: 'agent',
    branch_ids: ['22222222-2222-2222-2222-222222222221'],
    primary_branch_id: '22222222-2222-2222-2222-222222222221',
  },
  atendente_bruno: {
    user_id: '33333333-3333-3333-3333-333333333333',
    email: 'bruno.atendente@multifarma.com',
    full_name: 'Bruno Lima (Atendente Filial Jardins)',
    organization_id: '11111111-1111-1111-1111-111111111111',
    role: 'agent',
    branch_ids: ['22222222-2222-2222-2222-222222222222'],
    primary_branch_id: '22222222-2222-2222-2222-222222222222',
  },
  admin_tecnico: {
    user_id: '33333333-3333-3333-3333-333333333335',
    email: 'marcos.admin@multifarma.com',
    full_name: 'Marcos Tech (Administrador Técnico)',
    organization_id: '11111111-1111-1111-1111-111111111111',
    role: 'admin',
    branch_ids: ['22222222-2222-2222-2222-222222222221'],
    primary_branch_id: '22222222-2222-2222-2222-222222222221',
  },
};

export const AUTH_COOKIE_NAME = 'mf_user_role';

export function isManagerRole(role?: UserRole | string | null): boolean {
  return role === 'manager';
}

export function canAccessDashboard(userRole?: UserRole | string | null): boolean {
  // Conforme PRD Seção 6 e Regra Essencial de Acesso:
  // "Apenas o papel manager poderá acessar o dashboard gerencial.
  // O administrador técnico não recebe acesso ao dashboard automaticamente.
  // Para acessá-lo, precisa também possuir o papel manager."
  return userRole === 'manager';
}
