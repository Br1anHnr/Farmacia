-- Seed de Dados Sintéticos de Homologação para o Hub MultiFarma
-- Todos os dados são estritamente fictícios para ambiente de teste.

-- IDs fixos para referência reproduzível nos testes
DO $$
DECLARE
    v_org_id UUID := '11111111-1111-1111-1111-111111111111';
    v_branch_matriz UUID := '22222222-2222-2222-2222-222222222221';
    v_branch_jardins UUID := '22222222-2222-2222-2222-222222222222';
    v_user_gerente UUID := '33333333-3333-3333-3333-333333333331';
    v_user_ana UUID := '33333333-3333-3333-3333-333333333332';
    v_user_bruno UUID := '33333333-3333-3333-3333-333333333333';
    v_user_carla UUID := '33333333-3333-3333-3333-333333333334';
    v_user_admin UUID := '33333333-3333-3333-3333-333333333335';
    v_customer_joao UUID := '44444444-4444-4444-4444-444444444441';
    v_prod_dipirona UUID := '55555555-5555-5555-5555-555555555551';
    v_prod_paracetamol UUID := '55555555-5555-5555-5555-555555555552';
    v_prod_amoxicilina UUID := '55555555-5555-5555-5555-555555555553';
    v_prod_dorflex UUID := '55555555-5555-5555-5555-555555555554';
    v_sale_1 UUID := '66666666-6666-6666-6666-666666666661';
    v_room_geral UUID := '77777777-7777-7777-7777-777777777771';
    v_room_jardins UUID := '77777777-7777-7777-7777-777777777772';
BEGIN
    -- 1. Organização
    INSERT INTO public.organizations (id, name, slug)
    VALUES (v_org_id, 'Farmácia MultiFarma Homologação', 'multifarma-homolog')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Filiais
    INSERT INTO public.branches (id, organization_id, name, code, city, is_headquarters)
    VALUES 
        (v_branch_matriz, v_org_id, 'MultiFarma Matriz Centro', 'MTZ-01', 'São Paulo', true),
        (v_branch_jardins, v_org_id, 'MultiFarma Filial Jardins', 'JRD-02', 'São Paulo', false)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Perfis
    INSERT INTO public.profiles (id, full_name, email)
    VALUES
        (v_user_gerente, 'Carlos Mendes (Gerente)', 'carlos.gerente@multifarma.com'),
        (v_user_ana, 'Ana Souza (Atendente)', 'ana.atendente@multifarma.com'),
        (v_user_bruno, 'Bruno Lima (Atendente)', 'bruno.atendente@multifarma.com'),
        (v_user_carla, 'Carla Prado (Atendente)', 'carla.atendente@multifarma.com'),
        (v_user_admin, 'Marcos Tech (Admin)', 'marcos.admin@multifarma.com')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Membros da Organização (Papéis)
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES
        (v_org_id, v_user_gerente, 'manager'),
        (v_org_id, v_user_ana, 'agent'),
        (v_org_id, v_user_bruno, 'agent'),
        (v_org_id, v_user_carla, 'agent'),
        (v_org_id, v_user_admin, 'admin')
    ON CONFLICT DO NOTHING;

    -- 5. Vínculo de Filiais
    INSERT INTO public.branch_members (branch_id, user_id, is_primary)
    VALUES
        (v_branch_matriz, v_user_gerente, true),
        (v_branch_matriz, v_user_ana, true),
        (v_branch_jardins, v_user_bruno, true),
        (v_branch_matriz, v_user_carla, true),
        (v_branch_matriz, v_user_admin, true)
    ON CONFLICT DO NOTHING;

    -- 6. Catálogo Provisório de Medicamentos
    INSERT INTO public.products (id, organization_id, name, normalized_name, default_price, active, ean)
    VALUES
        (v_prod_dipirona, v_org_id, 'Dipirona Monoidratada 500mg 20 comp', 'dipirona 500mg 20 comp', 8.50, true, '7891010010101'),
        (v_prod_paracetamol, v_org_id, 'Paracetamol 750mg 20 comp', 'paracetamol 750mg 20 comp', 12.00, true, '7891010010102'),
        (v_prod_amoxicilina, v_org_id, 'Amoxicilina 500mg 21 cápsulas', 'amoxicilina 500mg 21 capsulas', 28.90, true, '7891010010103'),
        (v_prod_dorflex, v_org_id, 'Dorflex 36 comprimidos', 'dorflex 36 comprimidos', 22.50, true, '7891010010104')
    ON CONFLICT (id) DO NOTHING;

    -- 7. Cliente Fictício e Canal
    INSERT INTO public.customers (id, organization_id, name, phone, email)
    VALUES (v_customer_joao, v_org_id, 'João da Silva (Teste)', '+5511988887777', 'joao.teste@cliente.com')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.customer_channels (customer_id, channel_type, external_id)
    VALUES (v_customer_joao, 'whatsapp', '5511988887777')
    ON CONFLICT DO NOTHING;

    -- 8. Conversa de Teste vinculada ao Chatwoot ID 101
    INSERT INTO public.conversation_links (organization_id, branch_id, customer_id, chatwoot_conversation_id, channel, status, bot_active, last_intent)
    VALUES (v_org_id, v_branch_matriz, v_customer_joao, 101, 'whatsapp', 'open', false, 'BUY_PRODUCT')
    ON CONFLICT DO NOTHING;

    -- 9. Venda Confirmada Demonstrativa
    INSERT INTO public.sales (
        id, organization_id, branch_id, chatwoot_conversation_id, channel, customer_id, agent_id,
        subtotal, discount, total_amount, fulfillment_method, status, origin_type, delivery_address,
        confirmed_at
    )
    VALUES (
        v_sale_1, v_org_id, v_branch_matriz, 101, 'whatsapp', v_customer_joao, v_user_ana,
        31.00, 2.00, 29.00, 'delivery', 'confirmed', 'ai_suggested', 'Rua das Flores, 123 - Centro',
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.sale_items (sale_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, total_item_price)
    VALUES
        (v_sale_1, v_prod_dipirona, 'Dipirona Monoidratada 500mg 20 comp', 8.50, 1, 8.50),
        (v_sale_1, v_prod_dorflex, 'Dorflex 36 comprimidos', 22.50, 1, 22.50)
    ON CONFLICT DO NOTHING;

    -- 10. Auditoria Inicial
    INSERT INTO public.audit_events (organization_id, actor_id, actor_email, action, entity_type, entity_id, metadata)
    VALUES (
        v_org_id, v_user_ana, 'ana.atendente@multifarma.com', 'SALE_CONFIRMED', 'sale', v_sale_1::text,
        '{"total": 29.00, "channel": "whatsapp", "conversation_id": 101}'::jsonb
    )
    ON CONFLICT DO NOTHING;

    -- 11. Salas Internas de Chat
    INSERT INTO public.internal_rooms (id, organization_id, branch_id, name, is_general)
    VALUES
        (v_room_geral, v_org_id, NULL, 'Geral MultiFarma', true),
        (v_room_jardins, v_org_id, v_branch_jardins, 'Equipe Jardins', false)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.internal_messages (room_id, sender_id, content)
    VALUES (v_room_geral, v_user_gerente, 'Boas-vindas à equipe no novo hub integrado!')
    ON CONFLICT DO NOTHING;

END $$;
