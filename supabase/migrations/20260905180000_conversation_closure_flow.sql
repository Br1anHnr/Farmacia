-- Encerramento operacional persistido no Hub; não altera a conversa no Chatwoot.
BEGIN;

CREATE TABLE hub_private.conversation_close_requests (
  user_id uuid NOT NULL,
  request_key uuid NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (user_id, request_key)
);
REVOKE ALL ON hub_private.conversation_close_requests
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION hub_private.close_conversation(p_input jsonb, p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  SELECT * INTO previous
  FROM hub_private.conversation_close_requests
  WHERE user_id = actor AND request_key = p_key;
  IF FOUND THEN
    IF previous.input <> p_input THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN previous.result;
  END IF;

  SELECT * INTO c
  FROM public.conversation_links
  WHERE organization_id = (p_input->>'organization_id')::uuid
    AND chatwoot_conversation_id = (p_input->>'chatwoot_conversation_id')::integer
  FOR UPDATE;
  IF NOT FOUND
    OR c.chatwoot_account_id IS NULL
    OR NOT hub_private.can_conversation(c.organization_id, c.chatwoot_conversation_id)
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
    reason IS NULL
    OR reason NOT IN (
      'price',
      'product_unavailable',
      'delivery_unavailable',
      'customer_gave_up',
      'no_response',
      'other'
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_NO_SALE_REASON' USING ERRCODE = '22023';
  END IF;

  IF outcome = 'sale' THEN
    sale_result := hub_private.record_sale(p_input - 'outcome', p_key);
  END IF;

  UPDATE public.conversation_links
  SET
    status = 'closed_' || outcome,
    bot_active = false,
    updated_at = timezone('utc'::text, now())
  WHERE id = c.id;

  INSERT INTO public.audit_events (
    organization_id,
    branch_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    c.organization_id,
    c.branch_id,
    actor,
    CASE outcome
      WHEN 'sale' THEN 'CONVERSATION_CLOSED_WITH_SALE'
      WHEN 'not_sold' THEN 'CONVERSATION_CLOSED_WITHOUT_SALE'
      WHEN 'resolved' THEN 'CONVERSATION_CLOSED_RESOLVED'
      ELSE 'CONVERSATION_CLOSED_CANCELLED'
    END,
    'conversation',
    c.chatwoot_conversation_id::text,
    jsonb_strip_nulls(
      jsonb_build_object(
        'outcome', outcome,
        'reason', reason,
        'sale_id', sale_result->>'id',
        'channel', c.channel
      )
    )
  );

  result := jsonb_strip_nulls(
    jsonb_build_object(
      'persisted', true,
      'conversation_id', c.chatwoot_conversation_id,
      'outcome', outcome,
      'reason', reason,
      'sale_id', sale_result->>'id'
    )
  );
  INSERT INTO hub_private.conversation_close_requests
    (user_id, request_key, input, result)
  VALUES (actor, p_key, p_input, result);
  RETURN result;
END
$$;

CREATE FUNCTION public.close_conversation(p_input jsonb, p_key uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT hub_private.close_conversation(p_input, p_key)
$$;

REVOKE ALL ON FUNCTION public.close_conversation(jsonb, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  hub_private.close_conversation(jsonb, uuid),
  public.close_conversation(jsonb, uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
