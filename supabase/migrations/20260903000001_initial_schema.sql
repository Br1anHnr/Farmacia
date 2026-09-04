-- Migração 1: Schema Inicial do Hub MultiFarma
-- Compatível com PostgreSQL / Supabase
-- Tabelas com isolamento por organization_id, valores monetários em numeric(12,2) e timestamps UTC

-- Habilitar extensão pgcrypto / uuid se necessário
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizações (Clientes da Plataforma / Farmácias)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Unidades / Filiais (Cidades ou Lojas)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    is_headquarters BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_organization_branch_code UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_branches_org ON public.branches(organization_id);

-- 3. Perfis de Usuários (vinculados ao auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY, -- referencia auth.users(id)
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Membros da Organização e Papéis (admin, manager, agent, viewer)
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'agent', 'viewer');

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 5. Membros por Unidade (filiais que cada atendente tem permissão)
CREATE TABLE IF NOT EXISTS public.branch_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_branch_user UNIQUE (branch_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_members_user ON public.branch_members(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_members_branch ON public.branch_members(branch_id);

-- 6. Clientes (Cadastro Mínimo)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON public.customers(organization_id, phone);

-- 7. Canais dos Clientes (Mapeamento de Telefones e IDs externos)
CREATE TABLE IF NOT EXISTS public.customer_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL, -- 'whatsapp', 'instagram', 'facebook'
    external_id VARCHAR(255) NOT NULL, -- e.g. 5511999999999 ou instagram username/id
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_channel_external UNIQUE (customer_id, channel_type, external_id)
);

-- 8. Ligações de Conversas (Mapeamento Chatwoot <-> Cliente / Unidade)
CREATE TABLE IF NOT EXISTS public.conversation_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    chatwoot_conversation_id INTEGER NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    bot_active BOOLEAN NOT NULL DEFAULT true,
    last_intent VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_org_chatwoot_conv UNIQUE (organization_id, chatwoot_conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_links_chatwoot ON public.conversation_links(chatwoot_conversation_id);

-- 9. Produtos (Catálogo Canônico Provisório e Futuro ERP)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    external_product_id VARCHAR(100),
    ean VARCHAR(50),
    erp_source VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    default_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_products_org_name ON public.products(organization_id, normalized_name);

-- 10. Vendas (Cabeçalho da Venda com Confirmação Humana)
CREATE TYPE public.sale_status AS ENUM ('draft', 'confirmed', 'cancelled');
CREATE TYPE public.fulfillment_method AS ENUM ('delivery', 'pickup');
CREATE TYPE public.sale_origin_type AS ENUM ('manual', 'ai_suggested');

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    chatwoot_conversation_id INTEGER NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    fulfillment_method public.fulfillment_method NOT NULL DEFAULT 'delivery',
    status public.sale_status NOT NULL DEFAULT 'draft',
    origin_type public.sale_origin_type NOT NULL DEFAULT 'manual',
    cancellation_reason TEXT,
    delivery_address TEXT,
    notes TEXT,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_positive_totals CHECK (subtotal >= 0 AND total_amount >= 0 AND discount >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sales_org_status ON public.sales(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_agent ON public.sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_conversation ON public.sales(chatwoot_conversation_id);
CREATE INDEX IF NOT EXISTS idx_sales_confirmed_at ON public.sales(confirmed_at) WHERE status = 'confirmed';

-- 11. Itens da Venda (Snapshots com Precisão Financeira)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    unit_price_snapshot NUMERIC(12,2) NOT NULL,
    quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
    total_item_price NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_positive_item CHECK (unit_price_snapshot >= 0 AND quantity > 0 AND total_item_price >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

-- 12. Sugestões de Extração Silenciosa da IA
CREATE TABLE IF NOT EXISTS public.extraction_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chatwoot_conversation_id INTEGER NOT NULL,
    source_message_id INTEGER NOT NULL,
    source_text TEXT NOT NULL,
    suggested_product_name VARCHAR(255),
    suggested_quantity NUMERIC(10,3),
    suggested_unit_price NUMERIC(12,2),
    suggested_fulfillment public.fulfillment_method,
    suggested_address TEXT,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_suggestions_conv ON public.extraction_suggestions(chatwoot_conversation_id);

-- 13. Auditoria Operacional (Trilha Append-Only para Ações Críticas)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON public.audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_events(action);

-- 14. Eventos de Integração (Idempotência e Fila de Retentativas)
CREATE TABLE IF NOT EXISTS public.integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    source VARCHAR(50) NOT NULL, -- 'chatwoot', 'evolution', 'meta'
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'received', -- 'received', 'processing', 'completed', 'failed'
    attempts INTEGER NOT NULL DEFAULT 1,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_integration_idempotency ON public.integration_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_integration_status ON public.integration_events(status);

-- 15. Salas Internas da Equipe (Geral e por Unidade)
CREATE TABLE IF NOT EXISTS public.internal_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL para sala geral
    name VARCHAR(255) NOT NULL,
    is_general BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_internal_rooms_org ON public.internal_rooms(organization_id);

-- 16. Membros das Salas Internas & Mensagens
CREATE TABLE IF NOT EXISTS public.internal_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.internal_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.internal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.internal_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_internal_messages_room ON public.internal_messages(room_id, created_at ASC);
