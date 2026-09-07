BEGIN;

-- Chatwoot identity is always account + conversation. Some early manual
-- installations already created the backing unique index, so attach it when
-- present instead of failing the whole transactional migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.conversation_links'::regclass
      AND constraint_row.conname = 'uq_org_chatwoot_account_conversation'
  ) THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class index_row
    JOIN pg_catalog.pg_index index_definition ON index_definition.indexrelid = index_row.oid
    WHERE index_definition.indrelid = 'public.conversation_links'::regclass
      AND index_row.relname = 'uq_org_chatwoot_account_conversation'
      AND index_definition.indisunique
  ) THEN
    ALTER TABLE public.conversation_links
      ADD CONSTRAINT uq_org_chatwoot_account_conversation
      UNIQUE USING INDEX uq_org_chatwoot_account_conversation;
  ELSE
    ALTER TABLE public.conversation_links
      ADD CONSTRAINT uq_org_chatwoot_account_conversation
      UNIQUE (organization_id, chatwoot_account_id, chatwoot_conversation_id);
  END IF;
END
$$;
ALTER TABLE public.extraction_suggestions ADD COLUMN chatwoot_account_id bigint;
UPDATE public.extraction_suggestions suggestion
SET chatwoot_account_id = link.chatwoot_account_id
FROM public.conversation_links link
WHERE link.organization_id = suggestion.organization_id
  AND link.chatwoot_conversation_id = suggestion.chatwoot_conversation_id
  AND suggestion.chatwoot_account_id IS NULL;

ALTER TABLE public.chatwoot_agents DROP CONSTRAINT chatwoot_agents_pkey;
ALTER TABLE public.chatwoot_agents
  DROP CONSTRAINT chatwoot_agents_account_id_agent_id_key;
ALTER TABLE public.chatwoot_agents ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.chatwoot_agents ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.chatwoot_agents ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.chatwoot_agents ADD COLUMN email text;
ALTER TABLE public.chatwoot_agents ADD COLUMN display_name text;
ALTER TABLE public.chatwoot_agents ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.chatwoot_agents
  ADD COLUMN last_synced_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.chatwoot_agents ADD PRIMARY KEY (id);
ALTER TABLE public.chatwoot_agents
  ADD CONSTRAINT uq_chatwoot_agent_identity
  UNIQUE (organization_id, account_id, agent_id);
ALTER TABLE public.chatwoot_agents
  ADD CONSTRAINT uq_chatwoot_agent_user_account
  UNIQUE (organization_id, account_id, user_id);

CREATE FUNCTION hub_private.can_conversation(
  p_org uuid,
  p_account bigint,
  p_conv integer
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.conversation_links c
    WHERE c.organization_id = p_org
      AND c.chatwoot_account_id = p_account
      AND c.chatwoot_conversation_id = p_conv
      AND hub_private.has_branch(c.branch_id)
      AND (
        hub_private.member_role(p_org) = 'manager'
        OR (
          hub_private.member_role(p_org) = 'agent'
          AND (
            c.assigned_user_id = auth.uid()
            OR (c.assigned_user_id IS NULL AND c.chatwoot_assignee_id IS NULL)
          )
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION hub_private.can_conversation(uuid, bigint, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION hub_private.can_conversation(uuid, bigint, integer)
  TO authenticated, service_role;
DROP POLICY conversation_read ON public.conversation_links;
CREATE POLICY conversation_read ON public.conversation_links
FOR SELECT TO authenticated USING (
  hub_private.can_conversation(
    organization_id,
    chatwoot_account_id,
    chatwoot_conversation_id
  )
);
DROP POLICY suggestion_read ON public.extraction_suggestions;
CREATE POLICY suggestion_read ON public.extraction_suggestions
FOR SELECT TO authenticated USING (
  hub_private.can_conversation(
    organization_id,
    chatwoot_account_id,
    chatwoot_conversation_id
  )
);

CREATE OR REPLACE FUNCTION hub_private.sync_webhook(
  p_org uuid,
  p_branch uuid,
  p_account bigint,
  p_conv integer,
  p_channel text,
  p_contact text,
  p_name text,
  p_phone text,
  p_human boolean,
  p_key text,
  p_assignee bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.conversation_links;
  customer uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch AND organization_id = p_org AND active
  ) THEN
    RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = '42501';
  END IF;
  IF p_channel NOT IN ('whatsapp', 'instagram', 'facebook')
    OR p_account <= 0 OR p_conv <= 0
  THEN
    RAISE EXCEPTION 'INVALID_EVENT';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_org::text || ':' || p_account::text || ':' || coalesce(p_contact, p_conv::text),
      0
    )
  );
  SELECT * INTO c
  FROM public.conversation_links
  WHERE organization_id = p_org
    AND chatwoot_account_id = p_account
    AND chatwoot_conversation_id = p_conv;
  IF p_contact IS NOT NULL THEN
    SELECT customer_id INTO customer
    FROM hub_private.customer_identities
    WHERE organization_id = p_org
      AND account_id = p_account
      AND external_id = p_contact;
    IF NOT FOUND THEN
      IF c.customer_id IS NOT NULL THEN
        customer := c.customer_id;
      ELSE
        INSERT INTO public.customers (organization_id, name, phone)
        VALUES (
          p_org,
          coalesce(nullif(p_name, ''), 'Contato Chatwoot'),
          nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '')
        ) RETURNING id INTO customer;
      END IF;
      INSERT INTO hub_private.customer_identities
        (organization_id, account_id, external_id, customer_id)
      VALUES (p_org, p_account, p_contact, customer);
      INSERT INTO public.customer_channels (customer_id, channel_type, external_id)
      VALUES (customer, p_channel, p_account::text || ':' || p_contact)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.conversation_links (
    organization_id,
    branch_id,
    customer_id,
    chatwoot_conversation_id,
    chatwoot_account_id,
    channel,
    bot_active
  ) VALUES (
    p_org, p_branch, customer, p_conv, p_account, p_channel, NOT p_human
  )
  ON CONFLICT (organization_id, chatwoot_account_id, chatwoot_conversation_id)
  DO NOTHING;

  SELECT * INTO c
  FROM public.conversation_links
  WHERE organization_id = p_org
    AND chatwoot_account_id = p_account
    AND chatwoot_conversation_id = p_conv
  FOR UPDATE;
  IF NOT FOUND OR c.branch_id IS DISTINCT FROM p_branch THEN
    RAISE EXCEPTION 'CONVERSATION_SCOPE_CONFLICT' USING ERRCODE = '42501';
  END IF;
  UPDATE public.conversation_links
  SET customer_id = coalesce(conversation_links.customer_id, customer),
      bot_active = conversation_links.bot_active AND NOT p_human,
      updated_at = timezone('utc'::text, now())
  WHERE id = c.id RETURNING * INTO c;

  IF p_key IS NOT NULL AND c.bot_active AND c.assigned_user_id IS NULL THEN
    IF c.bot_event_key IS NOT NULL THEN
      RAISE EXCEPTION 'BOT_TURN_PENDING';
    END IF;
    UPDATE public.conversation_links SET bot_event_key = p_key WHERE id = c.id;
  END IF;
  IF p_assignee IS NOT NULL THEN
    UPDATE public.conversation_links
    SET chatwoot_assignee_id = p_assignee,
        assigned_user_id = (
          SELECT user_id FROM public.chatwoot_agents
          WHERE organization_id = p_org
            AND account_id = p_account
            AND agent_id = p_assignee
            AND active
        )
    WHERE id = c.id RETURNING * INTO c;
  END IF;
  RETURN to_jsonb(c);
END
$$;

DROP FUNCTION public.finish_bot_turn(uuid, integer, text, boolean);
DROP FUNCTION hub_private.finish_bot_turn(uuid, integer, text, boolean);
CREATE FUNCTION hub_private.finish_bot_turn(
  p_org uuid,
  p_account bigint,
  p_conv integer,
  p_key text,
  p_handoff boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.conversation_links
  SET bot_event_key = null,
      bot_active = bot_active AND NOT p_handoff
  WHERE organization_id = p_org
    AND chatwoot_account_id = p_account
    AND chatwoot_conversation_id = p_conv
    AND bot_event_key = p_key;
END
$$;
CREATE FUNCTION public.finish_bot_turn(
  p_org uuid,
  p_account bigint,
  p_conv integer,
  p_key text,
  p_handoff boolean
) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT hub_private.finish_bot_turn(p_org, p_account, p_conv, p_key, p_handoff)
$$;
REVOKE ALL ON FUNCTION public.finish_bot_turn(uuid, bigint, integer, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  hub_private.finish_bot_turn(uuid, bigint, integer, text, boolean),
  public.finish_bot_turn(uuid, bigint, integer, text, boolean)
  TO service_role;

DROP FUNCTION public.claim_conversation(uuid, integer);
DROP FUNCTION hub_private.claim_conversation(uuid, integer);
CREATE FUNCTION hub_private.claim_conversation(
  p_org uuid,
  p_account bigint,
  p_conv integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.conversation_links;
  m public.chatwoot_agents;
BEGIN
  SELECT * INTO c FROM public.conversation_links
  WHERE organization_id = p_org
    AND chatwoot_account_id = p_account
    AND chatwoot_conversation_id = p_conv
  FOR UPDATE;
  IF auth.uid() IS NULL OR NOT FOUND
    OR NOT hub_private.can_conversation(p_org, p_account, p_conv)
    OR hub_private.member_role(p_org) NOT IN ('agent', 'manager')
  THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.chatwoot_agents
  WHERE organization_id = p_org
    AND user_id = auth.uid()
    AND account_id = p_account
    AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHATWOOT_MAPPING_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF c.assigned_user_id IS NOT NULL AND c.assigned_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'ALREADY_ASSIGNED' USING ERRCODE = '23505';
  END IF;
  IF c.assigned_user_id IS NULL THEN
    UPDATE public.conversation_links
    SET assigned_user_id = auth.uid(),
        chatwoot_assignee_id = m.agent_id,
        bot_active = false,
        updated_at = timezone('utc'::text, now())
    WHERE id = c.id;
    INSERT INTO public.audit_events (
      organization_id, branch_id, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      p_org, c.branch_id, auth.uid(), 'AGENT_CLAIMED_CONVERSATION',
      'conversation', p_conv::text,
      jsonb_build_object('chatwoot_account_id', p_account, 'chatwoot_agent_id', m.agent_id)
    );
  END IF;
  RETURN jsonb_build_object(
    'agent_id', m.agent_id,
    'account_id', m.account_id,
    'branch_id', c.branch_id,
    'user_id', auth.uid()
  );
END
$$;
CREATE FUNCTION public.claim_conversation(p_org uuid, p_account bigint, p_conv integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT hub_private.claim_conversation(p_org, p_account, p_conv)
$$;
REVOKE ALL ON FUNCTION public.claim_conversation(uuid, bigint, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  hub_private.claim_conversation(uuid, bigint, integer),
  public.claim_conversation(uuid, bigint, integer)
  TO authenticated;

CREATE FUNCTION hub_private.complete_conversation_transfer(
  p_org uuid,
  p_account bigint,
  p_conv integer,
  p_target_user uuid,
  p_target_branch uuid,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  c public.conversation_links;
  mapping public.chatwoot_agents;
BEGIN
  SELECT * INTO c FROM public.conversation_links
  WHERE organization_id = p_org
    AND chatwoot_account_id = p_account
    AND chatwoot_conversation_id = p_conv
  FOR UPDATE;
  IF actor IS NULL OR NOT FOUND
    OR hub_private.member_role(p_org) NOT IN ('agent', 'manager')
    OR NOT hub_private.has_branch(c.branch_id)
  THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org AND user_id = p_target_user
      AND role IN ('agent', 'manager')
  ) OR NOT EXISTS (
    SELECT 1 FROM public.branch_members bm
    JOIN public.branches b ON b.id = bm.branch_id
    WHERE bm.user_id = p_target_user
      AND bm.branch_id = p_target_branch
      AND b.organization_id = p_org
      AND b.active
  ) THEN
    RAISE EXCEPTION 'TARGET_NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO mapping FROM public.chatwoot_agents
  WHERE organization_id = p_org
    AND account_id = p_account
    AND user_id = p_target_user
    AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHATWOOT_MAPPING_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.conversation_links
  SET assigned_user_id = p_target_user,
      chatwoot_assignee_id = mapping.agent_id,
      branch_id = p_target_branch,
      bot_active = false,
      updated_at = timezone('utc'::text, now())
  WHERE id = c.id;
  INSERT INTO public.audit_events (
    organization_id, branch_id, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_org, p_target_branch, actor, 'CONVERSATION_TRANSFERRED',
    'conversation', p_conv::text,
    jsonb_strip_nulls(jsonb_build_object(
      'chatwoot_account_id', p_account,
      'from_user_id', c.assigned_user_id,
      'from_branch_id', c.branch_id,
      'to_user_id', p_target_user,
      'to_branch_id', p_target_branch,
      'chatwoot_agent_id', mapping.agent_id,
      'note', nullif(trim(p_note), '')
    ))
  );
  RETURN jsonb_build_object(
    'transferred', true,
    'user_id', p_target_user,
    'branch_id', p_target_branch,
    'agent_id', mapping.agent_id
  );
END
$$;
CREATE FUNCTION public.complete_conversation_transfer(
  p_org uuid,
  p_account bigint,
  p_conv integer,
  p_target_user uuid,
  p_target_branch uuid,
  p_note text
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT hub_private.complete_conversation_transfer(
    p_org, p_account, p_conv, p_target_user, p_target_branch, p_note
  )
$$;
REVOKE ALL ON FUNCTION public.complete_conversation_transfer(
  uuid, bigint, integer, uuid, uuid, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  hub_private.complete_conversation_transfer(uuid, bigint, integer, uuid, uuid, text),
  public.complete_conversation_transfer(uuid, bigint, integer, uuid, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION hub_private.record_sale(p_input jsonb, p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  c public.conversation_links;
  previous hub_private.sale_requests;
  s public.sales;
  item jsonb;
  qty numeric;
  price numeric;
  subtotal numeric := 0;
  discount numeric;
  result jsonb;
BEGIN
  IF actor IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.conversation_links
  WHERE organization_id = (p_input->>'organization_id')::uuid
    AND chatwoot_account_id = (p_input->>'chatwoot_account_id')::bigint
    AND chatwoot_conversation_id = (p_input->>'chatwoot_conversation_id')::integer
  FOR UPDATE;
  IF NOT FOUND
    OR NOT hub_private.can_conversation(
      c.organization_id, c.chatwoot_account_id, c.chatwoot_conversation_id
    )
    OR hub_private.member_role(c.organization_id) NOT IN ('agent', 'manager')
    OR c.branch_id IS DISTINCT FROM (p_input->>'branch_id')::uuid
    OR c.channel IS DISTINCT FROM p_input->>'channel'
    OR (
      hub_private.member_role(c.organization_id) = 'agent'
      AND c.assigned_user_id IS DISTINCT FROM actor
    )
  THEN
    RAISE EXCEPTION 'CONVERSATION_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text || p_key::text, 0)
  );
  SELECT * INTO previous FROM hub_private.sale_requests
  WHERE user_id = actor AND request_key = p_key;
  IF FOUND THEN
    IF previous.input <> p_input THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN previous.result;
  END IF;
  IF jsonb_typeof(p_input->'items') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_input->'items') NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'INVALID_ITEMS' USING ERRCODE = '22023';
  END IF;
  discount := coalesce((p_input->>'discount')::numeric, 0);
  IF discount < 0 OR discount <> round(discount, 2) THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_input->'items') LOOP
    qty := (item->>'quantity')::numeric;
    price := (item->>'unit_price')::numeric;
    IF qty IS NULL OR price IS NULL OR qty <= 0 OR qty > 100000
      OR qty <> round(qty, 3) OR price < 0 OR price > 9999999
      OR price <> round(price, 2)
      OR coalesce(length(item->>'product_name'), 0) NOT BETWEEN 1 AND 255
    THEN
      RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE = '22023';
    END IF;
    IF item->>'product_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = (item->>'product_id')::uuid
        AND organization_id = c.organization_id
        AND active
    ) THEN
      RAISE EXCEPTION 'PRODUCT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    subtotal := subtotal + round(qty * price, 2);
  END LOOP;
  IF discount > subtotal THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE = '22023';
  END IF;
  IF c.customer_id IS NULL THEN
    IF coalesce(length(p_input->>'customer_name'), 0) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION 'INVALID_CUSTOMER' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.customers (organization_id, name, phone)
    VALUES (
      c.organization_id,
      p_input->>'customer_name',
      nullif(regexp_replace(coalesce(p_input->>'customer_phone', ''), '[^0-9]', '', 'g'), '')
    ) RETURNING id INTO c.customer_id;
    UPDATE public.conversation_links SET customer_id = c.customer_id WHERE id = c.id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = c.customer_id AND organization_id = c.organization_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sales (
    organization_id, branch_id, chatwoot_conversation_id, channel, customer_id,
    agent_id, subtotal, discount, total_amount, fulfillment_method, status,
    origin_type, delivery_address, notes, confirmed_at
  ) VALUES (
    c.organization_id, c.branch_id, c.chatwoot_conversation_id, c.channel,
    c.customer_id, actor, subtotal, discount, subtotal - discount,
    (p_input->>'fulfillment_method')::public.fulfillment_method, 'confirmed',
    (p_input->>'origin_type')::public.sale_origin_type,
    p_input->>'delivery_address', p_input->>'notes', now()
  ) RETURNING * INTO s;
  INSERT INTO public.sale_items (
    sale_id, product_id, product_name_snapshot, unit_price_snapshot,
    quantity, total_item_price
  )
  SELECT s.id, (i->>'product_id')::uuid, i->>'product_name',
    (i->>'unit_price')::numeric, (i->>'quantity')::numeric,
    round((i->>'unit_price')::numeric * (i->>'quantity')::numeric, 2)
  FROM jsonb_array_elements(p_input->'items') i;
  INSERT INTO public.audit_events (
    organization_id, branch_id, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    c.organization_id, c.branch_id, actor, 'SALE_CONFIRMED', 'sale', s.id::text,
    jsonb_build_object(
      'chatwoot_account_id', c.chatwoot_account_id,
      'conversation_id', c.chatwoot_conversation_id,
      'total_amount', s.total_amount,
      'channel', c.channel
    )
  );
  SELECT to_jsonb(s) || jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  ) INTO result FROM public.sale_items i WHERE i.sale_id = s.id;
  INSERT INTO hub_private.sale_requests VALUES (actor, p_key, p_input, result);
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION hub_private.close_conversation(p_input jsonb, p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  c public.conversation_links;
  previous hub_private.conversation_close_requests;
  outcome text := p_input->>'outcome';
  reason text := p_input->>'reason';
  sale_result jsonb;
  result jsonb;
BEGIN
  IF actor IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text || p_key::text, 0)
  );
  SELECT * INTO previous FROM hub_private.conversation_close_requests
  WHERE user_id = actor AND request_key = p_key;
  IF FOUND THEN
    IF previous.input <> p_input THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN previous.result;
  END IF;
  SELECT * INTO c FROM public.conversation_links
  WHERE organization_id = (p_input->>'organization_id')::uuid
    AND chatwoot_account_id = (p_input->>'chatwoot_account_id')::bigint
    AND chatwoot_conversation_id = (p_input->>'chatwoot_conversation_id')::integer
  FOR UPDATE;
  IF NOT FOUND
    OR NOT hub_private.can_conversation(
      c.organization_id, c.chatwoot_account_id, c.chatwoot_conversation_id
    )
    OR hub_private.member_role(c.organization_id) NOT IN ('agent', 'manager')
    OR c.branch_id IS DISTINCT FROM (p_input->>'branch_id')::uuid
    OR c.channel IS DISTINCT FROM p_input->>'channel'
    OR (
      hub_private.member_role(c.organization_id) = 'agent'
      AND c.assigned_user_id IS DISTINCT FROM actor
    )
  THEN
    RAISE EXCEPTION 'CONVERSATION_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF c.status LIKE 'closed_%' THEN
    RAISE EXCEPTION 'CONVERSATION_ALREADY_CLOSED' USING ERRCODE = '23505';
  END IF;
  IF outcome NOT IN ('sale', 'not_sold', 'resolved', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_OUTCOME' USING ERRCODE = '22023';
  END IF;
  IF outcome = 'not_sold' AND (
    reason IS NULL OR reason NOT IN (
      'price', 'product_unavailable', 'delivery_unavailable',
      'customer_gave_up', 'no_response', 'other'
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_NO_SALE_REASON' USING ERRCODE = '22023';
  END IF;
  IF outcome = 'sale' THEN
    sale_result := hub_private.record_sale(p_input - 'outcome', p_key);
  END IF;
  UPDATE public.conversation_links
  SET status = 'closed_' || outcome,
      bot_active = false,
      updated_at = timezone('utc'::text, now())
  WHERE id = c.id;
  INSERT INTO public.audit_events (
    organization_id, branch_id, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    c.organization_id, c.branch_id, actor,
    CASE outcome
      WHEN 'sale' THEN 'CONVERSATION_CLOSED_WITH_SALE'
      WHEN 'not_sold' THEN 'CONVERSATION_CLOSED_WITHOUT_SALE'
      WHEN 'resolved' THEN 'CONVERSATION_CLOSED_RESOLVED'
      ELSE 'CONVERSATION_CLOSED_CANCELLED'
    END,
    'conversation', c.chatwoot_conversation_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'chatwoot_account_id', c.chatwoot_account_id,
      'outcome', outcome,
      'reason', reason,
      'sale_id', sale_result->>'id',
      'channel', c.channel
    ))
  );
  result := jsonb_strip_nulls(jsonb_build_object(
    'persisted', true,
    'account_id', c.chatwoot_account_id,
    'conversation_id', c.chatwoot_conversation_id,
    'outcome', outcome,
    'reason', reason,
    'sale_id', sale_result->>'id'
  ));
  INSERT INTO hub_private.conversation_close_requests (user_id, request_key, input, result)
  VALUES (actor, p_key, p_input, result);
  RETURN result;
END
$$;

ALTER TABLE public.conversation_links DROP CONSTRAINT uq_org_chatwoot_conv;

CREATE FUNCTION hub_private.configure_multifarma_branches(p_org uuid)
RETURNS SETOF public.branches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  desired record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org) THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.branches
    WHERE id IN (
      '22222222-2222-2222-2222-222222222221',
      '22222222-2222-2222-2222-222222222222',
      '22222222-2222-2222-2222-222222222223'
    ) AND organization_id <> p_org
  ) THEN
    RAISE EXCEPTION 'BRANCH_ID_SCOPE_CONFLICT';
  END IF;

  FOR desired IN
    SELECT * FROM (VALUES
      ('22222222-2222-2222-2222-222222222221'::uuid, 'Guaratinguetá — Unidade 1', 'GUA-01', 'Guaratinguetá', true),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'Guaratinguetá — Unidade 2', 'GUA-02', 'Guaratinguetá', false),
      ('22222222-2222-2222-2222-222222222223'::uuid, 'Potim — Unidade 1', 'POT-01', 'Potim', false)
    ) AS configured(id, name, code, city, is_headquarters)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.branches
      WHERE organization_id = p_org
        AND code = desired.code
        AND id <> desired.id
    ) THEN
      RAISE EXCEPTION 'BRANCH_CODE_CONFLICT: %', desired.code;
    END IF;

    UPDATE public.branches
    SET name = desired.name,
        code = desired.code,
        city = desired.city,
        is_headquarters = desired.is_headquarters,
        active = true,
        updated_at = timezone('utc'::text, now())
    WHERE id = desired.id AND organization_id = p_org;

    IF NOT FOUND THEN
      INSERT INTO public.branches (
        id, organization_id, name, code, city, is_headquarters, active
      ) VALUES (
        desired.id, p_org, desired.name, desired.code, desired.city,
        desired.is_headquarters, true
      );
    END IF;
  END LOOP;

  INSERT INTO public.branch_members (branch_id, user_id, is_primary)
  SELECT branch.id, member.user_id, false
  FROM public.branches branch
  JOIN public.organization_members member
    ON member.organization_id = branch.organization_id
   AND member.role = 'manager'
  WHERE branch.organization_id = p_org
    AND branch.code IN ('GUA-01', 'GUA-02', 'POT-01')
  ON CONFLICT (branch_id, user_id) DO NOTHING;

  RETURN QUERY
  SELECT * FROM public.branches
  WHERE organization_id = p_org AND code IN ('GUA-01', 'GUA-02', 'POT-01')
  ORDER BY code;
END
$$;
REVOKE ALL ON FUNCTION hub_private.configure_multifarma_branches(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION hub_private.configure_multifarma_branches(uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
