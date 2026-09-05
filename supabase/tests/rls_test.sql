-- Testes Automatizados de RLS (Row Level Security) - Hub MultiFarma
-- Validação de Permissão Concedida (Manager) e Permissão Negada (Agent / Anon)

BEGIN;

-- 1. Teste como Usuário Anônimo (anon)
SET LOCAL ROLE anon;
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    BEGIN
      SELECT count(*) INTO v_count FROM public.sales;
      IF v_count > 0 THEN RAISE EXCEPTION 'Anon acessou vendas'; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      SELECT count(*) INTO v_count FROM public.audit_events;
      IF v_count > 0 THEN RAISE EXCEPTION 'Anon acessou auditoria'; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RAISE NOTICE 'SUCESSO: Anon bloqueado com 0 registros retornados.';
END $$;

-- 2. Teste como Atendente Ana (agent)
-- ID: 33333333-3333-3333-3333-333333333332
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333332", "role": "authenticated"}';

DO $$
DECLARE
    v_count INTEGER;
    v_audit_count INTEGER;
BEGIN
    -- Atendente tentando ler auditoria (deve ser 0)
    SELECT count(*) INTO v_audit_count FROM public.audit_events;
    IF v_audit_count > 0 THEN
        RAISE EXCEPTION 'FALHA DE SEGURANÇA: Atendente conseguiu visualizar % eventos de auditoria!', v_audit_count;
    END IF;
    RAISE NOTICE 'SUCESSO: Atendente bloqueado de acessar audit_events (0 linhas).';

    -- Atendente deve ver apenas suas próprias vendas
    SELECT count(*) INTO v_count FROM public.sales WHERE agent_id != '33333333-3333-3333-3333-333333333332';
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FALHA DE SEGURANÇA: Atendente conseguiu visualizar vendas de outros atendentes!';
    END IF;
    RAISE NOTICE 'SUCESSO: Atendente não enxerga vendas de outros funcionários.';
END $$;

-- 3. Teste como Gerente Carlos (manager)
-- ID: 33333333-3333-3333-3333-333333333331
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333331", "role": "authenticated"}';

DO $$
DECLARE
    v_sales_count INTEGER;
    v_audit_count INTEGER;
BEGIN
    SELECT count(*) INTO v_sales_count FROM public.sales;
    IF v_sales_count = 0 THEN
        RAISE EXCEPTION 'FALHA: Gerente deveria conseguir visualizar as vendas da organização!';
    END IF;

    SELECT count(*) INTO v_audit_count FROM public.audit_events;
    IF v_audit_count = 0 THEN
        RAISE EXCEPTION 'FALHA: Gerente deveria conseguir visualizar os eventos de auditoria!';
    END IF;

    RAISE NOTICE 'SUCESSO: Gerente possui acesso autorizado a todas as vendas (% encontradas) e auditoria (% eventos).', v_sales_count, v_audit_count;
END $$;

ROLLBACK;
