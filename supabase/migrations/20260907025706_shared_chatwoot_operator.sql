BEGIN;

CREATE TABLE public.chatwoot_operation_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  account_id bigint NOT NULL CHECK (account_id > 0),
  shared_agent_id bigint NOT NULL CHECK (shared_agent_id > 0),
  PRIMARY KEY (organization_id, account_id)
);
ALTER TABLE public.chatwoot_operation_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chatwoot_operation_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chatwoot_operation_settings TO authenticated;
GRANT ALL ON public.chatwoot_operation_settings TO service_role;
CREATE POLICY operation_settings_read ON public.chatwoot_operation_settings
FOR SELECT TO authenticated USING (hub_private.member_role(organization_id) IN ('agent','manager'));

CREATE FUNCTION hub_private.shared_chatwoot_agent(p_org uuid, p_account bigint)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT shared_agent_id FROM public.chatwoot_operation_settings
 WHERE organization_id = p_org AND account_id = p_account
$$;
REVOKE ALL ON FUNCTION hub_private.shared_chatwoot_agent(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION hub_private.shared_chatwoot_agent(uuid,bigint) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION hub_private.can_conversation(
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
            OR (c.assigned_user_id IS NULL AND (c.chatwoot_assignee_id IS NULL OR c.chatwoot_assignee_id = hub_private.shared_chatwoot_agent(p_org, p_account)))
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION hub_private.claim_conversation(
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
  IF hub_private.shared_chatwoot_agent(p_org, p_account) IS NOT NULL THEN
    m.agent_id := hub_private.shared_chatwoot_agent(p_org, p_account);
    m.account_id := p_account;
  ELSIF NOT FOUND THEN
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

CREATE OR REPLACE FUNCTION hub_private.complete_conversation_transfer(
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
  IF hub_private.shared_chatwoot_agent(p_org, p_account) IS NOT NULL THEN
    mapping.agent_id := hub_private.shared_chatwoot_agent(p_org, p_account);
  ELSIF NOT FOUND THEN
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
  IF NOT FOUND OR (c.branch_id IS DISTINCT FROM p_branch AND hub_private.shared_chatwoot_agent(p_org, p_account) IS NULL) THEN
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
  IF p_assignee = hub_private.shared_chatwoot_agent(p_org, p_account) THEN
    -- The shared Chatwoot operator must never overwrite the Hub owner.
    UPDATE public.conversation_links SET chatwoot_assignee_id = p_assignee
    WHERE id = c.id RETURNING * INTO c;
  ELSIF p_assignee IS NOT NULL THEN
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

-- Enable this setting only after the matching Hub version is deployed.

NOTIFY pgrst, 'reload schema';
COMMIT;
