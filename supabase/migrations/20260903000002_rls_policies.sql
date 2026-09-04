-- Migração 2: Row Level Security (RLS) e Funções de Autorização
-- Implementa segregação estrita entre perfis (Manager vs Agent vs Admin)
-- Nenhuma tabela de negócio pode ser acessada sem política explícita.

-- 1. Funções Auxiliares de Consulta de Autorização
CREATE OR REPLACE FUNCTION public.get_current_user_role(p_organization_id UUID)
RETURNS public.user_role AS $$
    SELECT role FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(p_organization_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_organization_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'manager')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.branches b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
        LEFT JOIN public.branch_members bm ON bm.branch_id = b.id AND bm.user_id = auth.uid()
        WHERE b.id = p_branch_id
          AND om.user_id = auth.uid()
          AND (om.role IN ('admin', 'manager') OR bm.user_id IS NOT NULL)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Habilitar RLS em todas as tabelas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para PROFILES
CREATE POLICY "profiles_select_own_or_member" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om1
            JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = public.profiles.id
        )
    );

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 4. Políticas para ORGANIZATIONS e BRANCHES
CREATE POLICY "organizations_select_member" ON public.organizations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.organizations.id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "branches_select_member" ON public.branches
    FOR SELECT TO authenticated
    USING (public.user_has_branch_access(id));

-- 5. Políticas para PRODUCTS (Catálogo de Medicamentos)
CREATE POLICY "products_select_member" ON public.products
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.products.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "products_modify_manager" ON public.products
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin(organization_id))
    WITH CHECK (public.is_manager_or_admin(organization_id));

-- 6. POLÍTICAS CRÍTICAS DE SALES (VENDAS)
-- REGRA ESSENCIAL: Manager visualiza tudo da sua organização.
-- Agent visualiza SOMENTE suas próprias vendas (onde é o agent_id).
CREATE POLICY "sales_select_policy" ON public.sales
    FOR SELECT TO authenticated
    USING (
        (public.is_manager_or_admin(organization_id))
        OR
        (
            agent_id = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = public.sales.organization_id
                  AND om.user_id = auth.uid()
            )
        )
    );

-- Inserção de Vendas: Atendente pode criar para sua unidade/atendimento
CREATE POLICY "sales_insert_policy" ON public.sales
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.sales.organization_id
              AND om.user_id = auth.uid()
        )
        AND agent_id = auth.uid()
    );

-- Atualização de Vendas:
-- Atendente só pode alterar rascunho de sua autoria para confirmar.
-- Gerente pode atualizar para cancelar com justificativa.
CREATE POLICY "sales_update_policy" ON public.sales
    FOR UPDATE TO authenticated
    USING (
        (public.is_manager_or_admin(organization_id))
        OR
        (agent_id = auth.uid() AND status = 'draft')
    )
    WITH CHECK (
        (public.is_manager_or_admin(organization_id))
        OR
        (agent_id = auth.uid())
    );

-- 7. POLÍTICAS PARA SALE_ITEMS (ITENS DA VENDA)
CREATE POLICY "sale_items_select_policy" ON public.sale_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = public.sale_items.sale_id
        )
    );

CREATE POLICY "sale_items_insert_policy" ON public.sale_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = public.sale_items.sale_id
              AND (s.agent_id = auth.uid() OR public.is_manager_or_admin(s.organization_id))
        )
    );

-- 8. POLÍTICAS DE AUDITORIA OPERACIONAL (AUDIT_EVENTS)
-- Apenas gerente e administrador podem visualizar a trilha de auditoria
CREATE POLICY "audit_events_select_manager_only" ON public.audit_events
    FOR SELECT TO authenticated
    USING (public.is_manager_or_admin(organization_id));

-- Inserções permitidas para usuários autenticados da organização
CREATE POLICY "audit_events_insert_authenticated" ON public.audit_events
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.audit_events.organization_id
              AND om.user_id = auth.uid()
        )
    );

-- 9. POLÍTICAS DE SALAS E CHAT INTERNO
CREATE POLICY "internal_rooms_select" ON public.internal_rooms
    FOR SELECT TO authenticated
    USING (
        is_general = true OR
        public.user_has_branch_access(branch_id)
    );

CREATE POLICY "internal_messages_select" ON public.internal_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.internal_rooms r
            WHERE r.id = public.internal_messages.room_id
              AND (r.is_general = true OR public.user_has_branch_access(r.branch_id))
        )
    );

CREATE POLICY "internal_messages_insert" ON public.internal_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.internal_rooms r
            WHERE r.id = public.internal_messages.room_id
              AND (r.is_general = true OR public.user_has_branch_access(r.branch_id))
        )
    );

-- 10. POLÍTICAS PARA EXTRACTION_SUGGESTIONS & CONVERSATIONS
CREATE POLICY "extraction_suggestions_select" ON public.extraction_suggestions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.extraction_suggestions.organization_id
              AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "conversation_links_select" ON public.conversation_links
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = public.conversation_links.organization_id
              AND om.user_id = auth.uid()
        )
    );
