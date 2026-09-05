-- P0 evolution. Reviewed/tested locally only; no production application authorized.
BEGIN;
CREATE SCHEMA IF NOT EXISTS hub_private;
REVOKE ALL ON SCHEMA hub_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA hub_private TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA hub_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER TABLE public.conversation_links ADD COLUMN IF NOT EXISTS chatwoot_account_id bigint;
ALTER TABLE public.conversation_links ADD COLUMN IF NOT EXISTS chatwoot_assignee_id bigint;
ALTER TABLE public.conversation_links ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
CREATE TABLE public.chatwoot_agents (
  user_id uuid REFERENCES public.profiles(id), organization_id uuid REFERENCES public.organizations(id),
  account_id bigint NOT NULL, agent_id bigint NOT NULL,
  PRIMARY KEY(user_id, organization_id), UNIQUE(account_id,agent_id)
);
ALTER TABLE public.chatwoot_agents ENABLE ROW LEVEL SECURITY;
CREATE TABLE hub_private.sale_requests (
  user_id uuid NOT NULL, request_key uuid NOT NULL, input jsonb NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY(user_id,request_key)
);
CREATE TABLE hub_private.webhook_receipts (
  event_key text PRIMARY KEY, payload_hash text NOT NULL, state text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA hub_private FROM PUBLIC,anon,authenticated;
-- Replace the old permissive policies; historical migrations remain unchanged.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('organizations','branches','profiles','organization_members','branch_members','customers','customer_channels','conversation_links','products','sales','sale_items','extraction_suggestions','audit_events','integration_events','internal_rooms','internal_room_members','internal_messages') LOOP
  EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;
DROP FUNCTION public.get_current_user_role(uuid);
DROP FUNCTION public.is_manager_or_admin(uuid);
DROP FUNCTION public.user_has_branch_access(uuid);

-- Definer functions are narrowly scoped lookups, in a non-exposed schema.
-- They avoid recursive RLS on membership tables. No caller-supplied user ID.
CREATE FUNCTION hub_private.member_role(org uuid) RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.organization_members WHERE organization_id=org AND user_id=auth.uid()
$$;
CREATE FUNCTION hub_private.has_branch(branch uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.branches b JOIN public.branch_members bm ON bm.branch_id=b.id
 JOIN public.organization_members om ON om.organization_id=b.organization_id AND om.user_id=bm.user_id
 WHERE b.id=branch AND bm.user_id=auth.uid() AND b.active)
$$;
CREATE FUNCTION hub_private.can_conversation(org uuid, conv integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversation_links c
 WHERE c.organization_id=org AND c.chatwoot_conversation_id=conv AND hub_private.has_branch(c.branch_id)
 AND (hub_private.member_role(org)='manager' OR (hub_private.member_role(org)='agent'
 AND (c.assigned_user_id=auth.uid() OR (c.assigned_user_id IS NULL AND c.chatwoot_assignee_id IS NULL)))))
$$;
CREATE FUNCTION hub_private.has_room(room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.internal_rooms r
 JOIN public.internal_room_members m ON m.room_id=r.id AND m.user_id=auth.uid()
 WHERE r.id=room AND hub_private.member_role(r.organization_id) IS NOT NULL
 AND (r.branch_id IS NULL OR hub_private.has_branch(r.branch_id)))
$$;
CREATE FUNCTION hub_private.all_branches(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT hub_private.member_role(org)='manager' AND EXISTS (SELECT 1 FROM public.branches WHERE organization_id=org)
 AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.organization_id=org AND NOT hub_private.has_branch(b.id))
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hub_private TO authenticated;
REVOKE ALL ON public.organizations,public.branches,public.profiles,public.organization_members,public.branch_members,
 public.customers,public.customer_channels,public.conversation_links,public.products,public.sales,public.sale_items,
 public.extraction_suggestions,public.audit_events,public.integration_events,public.internal_rooms,public.internal_room_members,
 public.internal_messages,public.chatwoot_agents FROM anon,authenticated;
GRANT SELECT ON public.organizations,public.branches,public.profiles,public.organization_members,public.branch_members,
 public.customers,public.customer_channels,public.conversation_links,public.products,public.sales,public.sale_items,
 public.extraction_suggestions,public.audit_events,public.internal_rooms,public.internal_room_members,public.internal_messages,
 public.chatwoot_agents TO authenticated;
GRANT UPDATE(full_name,avatar_url) ON public.profiles TO authenticated;
GRANT INSERT ON public.internal_messages TO authenticated;
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY profile_edit ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY org_read ON public.organizations FOR SELECT TO authenticated USING(hub_private.member_role(id) IS NOT NULL);
CREATE POLICY member_read ON public.organization_members FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY branch_member_read ON public.branch_members FOR SELECT TO authenticated USING(user_id=auth.uid() AND hub_private.has_branch(branch_id));
CREATE POLICY branch_read ON public.branches FOR SELECT TO authenticated USING(hub_private.has_branch(id));
CREATE POLICY agent_mapping_read ON public.chatwoot_agents FOR SELECT TO authenticated USING(user_id=auth.uid() AND hub_private.member_role(organization_id) IN ('agent','manager'));
CREATE POLICY conversation_read ON public.conversation_links FOR SELECT TO authenticated USING(hub_private.can_conversation(organization_id,chatwoot_conversation_id));
CREATE POLICY customer_read ON public.customers FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.conversation_links c WHERE c.customer_id=customers.id AND c.organization_id=customers.organization_id));
CREATE POLICY channel_read ON public.customer_channels FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.customers c WHERE c.id=customer_channels.customer_id));
CREATE POLICY product_read ON public.products FOR SELECT TO authenticated USING(hub_private.member_role(organization_id) IN ('agent','manager'));
CREATE POLICY sale_read ON public.sales FOR SELECT TO authenticated USING(hub_private.has_branch(branch_id) AND
 (hub_private.member_role(organization_id)='manager' OR (hub_private.member_role(organization_id)='agent' AND agent_id=auth.uid())));
CREATE POLICY item_read ON public.sale_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sales s WHERE s.id=sale_items.sale_id));
CREATE POLICY suggestion_read ON public.extraction_suggestions FOR SELECT TO authenticated USING(hub_private.can_conversation(organization_id,chatwoot_conversation_id));
CREATE POLICY audit_read ON public.audit_events FOR SELECT TO authenticated USING(hub_private.member_role(organization_id)='manager' AND
 ((branch_id IS NOT NULL AND hub_private.has_branch(branch_id)) OR (branch_id IS NULL AND hub_private.all_branches(organization_id))));
CREATE POLICY room_read ON public.internal_rooms FOR SELECT TO authenticated USING(hub_private.has_room(id));
CREATE POLICY room_member_read ON public.internal_room_members FOR SELECT TO authenticated USING(user_id=auth.uid() AND hub_private.has_room(room_id));
CREATE POLICY message_read ON public.internal_messages FOR SELECT TO authenticated USING(hub_private.has_room(room_id));
CREATE POLICY message_insert ON public.internal_messages FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND hub_private.has_room(room_id) AND length(content) BETWEEN 1 AND 4000);

CREATE FUNCTION hub_private.record_sale(p_input jsonb, p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.conversation_links; previous hub_private.sale_requests;
 s public.sales; item jsonb; qty numeric; price numeric; subtotal numeric:=0; discount numeric; result jsonb;
BEGIN
 IF actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.conversation_links WHERE organization_id=(p_input->>'organization_id')::uuid
 AND chatwoot_conversation_id=(p_input->>'chatwoot_conversation_id')::integer FOR UPDATE;
 IF NOT FOUND OR c.chatwoot_account_id IS NULL OR NOT hub_private.can_conversation(c.organization_id,c.chatwoot_conversation_id)
 OR hub_private.member_role(c.organization_id) NOT IN ('agent','manager')
 OR c.branch_id IS DISTINCT FROM (p_input->>'branch_id')::uuid
 OR c.channel IS DISTINCT FROM p_input->>'channel'
 OR (hub_private.member_role(c.organization_id)='agent' AND c.assigned_user_id IS DISTINCT FROM actor)
 THEN RAISE EXCEPTION 'CONVERSATION_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_key::text,0));
 SELECT * INTO previous FROM hub_private.sale_requests WHERE user_id=actor AND request_key=p_key;
 IF FOUND THEN
  IF previous.input<>p_input THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23505'; END IF;
  RETURN previous.result;
 END IF;
 IF jsonb_typeof(p_input->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_input->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_ITEMS' USING ERRCODE='22023'; END IF;
 discount:=coalesce((p_input->>'discount')::numeric,0);
 IF discount<0 OR discount<>round(discount,2) THEN RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_input->'items') LOOP
  qty:=(item->>'quantity')::numeric; price:=(item->>'unit_price')::numeric;
  IF qty IS NULL OR price IS NULL OR qty<=0 OR qty>100000 OR qty<>round(qty,3) OR price<0 OR price>9999999 OR price<>round(price,2)
   OR coalesce(length(item->>'product_name'),0) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE='22023'; END IF;
  IF item->>'product_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.products WHERE id=(item->>'product_id')::uuid AND organization_id=c.organization_id AND active)
   THEN RAISE EXCEPTION 'PRODUCT_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  subtotal:=subtotal+round(qty*price,2);
 END LOOP;
 IF discount>subtotal THEN RAISE EXCEPTION 'INVALID_DISCOUNT' USING ERRCODE='22023'; END IF;
 IF c.customer_id IS NULL THEN
  IF coalesce(length(p_input->>'customer_name'),0) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'INVALID_CUSTOMER' USING ERRCODE='22023'; END IF;
  INSERT INTO public.customers(organization_id,name,phone) VALUES(c.organization_id,p_input->>'customer_name',nullif(regexp_replace(coalesce(p_input->>'customer_phone',''),'[^0-9]','','g'),'')) RETURNING id INTO c.customer_id;
  UPDATE public.conversation_links SET customer_id=c.customer_id WHERE id=c.id;
 ELSIF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=c.customer_id AND organization_id=c.organization_id) THEN
  RAISE EXCEPTION 'CUSTOMER_ACCESS_DENIED' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.sales(organization_id,branch_id,chatwoot_conversation_id,channel,customer_id,agent_id,subtotal,discount,total_amount,fulfillment_method,status,origin_type,delivery_address,notes,confirmed_at)
 VALUES(c.organization_id,c.branch_id,c.chatwoot_conversation_id,c.channel,c.customer_id,actor,subtotal,discount,subtotal-discount,
 (p_input->>'fulfillment_method')::public.fulfillment_method,'confirmed',(p_input->>'origin_type')::public.sale_origin_type,p_input->>'delivery_address',p_input->>'notes',now()) RETURNING * INTO s;
 INSERT INTO public.sale_items(sale_id,product_id,product_name_snapshot,unit_price_snapshot,quantity,total_item_price)
 SELECT s.id,(i->>'product_id')::uuid,i->>'product_name',(i->>'unit_price')::numeric,(i->>'quantity')::numeric,round((i->>'unit_price')::numeric*(i->>'quantity')::numeric,2) FROM jsonb_array_elements(p_input->'items') i;
 INSERT INTO public.audit_events(organization_id,branch_id,actor_id,action,entity_type,entity_id,metadata)
 VALUES(c.organization_id,c.branch_id,actor,'SALE_CONFIRMED','sale',s.id::text,jsonb_build_object('conversation_id',c.chatwoot_conversation_id,'total_amount',s.total_amount,'channel',c.channel));
 SELECT to_jsonb(s)||jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb)) INTO result FROM public.sale_items i WHERE i.sale_id=s.id;
 INSERT INTO hub_private.sale_requests VALUES(actor,p_key,p_input,result);
 RETURN result;
END $$;
CREATE FUNCTION public.record_sale(p_input jsonb,p_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hub_private.record_sale(p_input,p_key) $$;
REVOKE ALL ON FUNCTION public.record_sale(jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION hub_private.record_sale(jsonb,uuid),public.record_sale(jsonb,uuid) TO authenticated;

CREATE FUNCTION hub_private.claim_conversation(p_org uuid,p_conv integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversation_links; m public.chatwoot_agents; BEGIN
 SELECT * INTO c FROM public.conversation_links WHERE organization_id=p_org AND chatwoot_conversation_id=p_conv FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR NOT hub_private.can_conversation(p_org,p_conv) OR hub_private.member_role(p_org) NOT IN ('agent','manager') THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.chatwoot_agents WHERE organization_id=p_org AND user_id=auth.uid() AND account_id=c.chatwoot_account_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHATWOOT_MAPPING_REQUIRED' USING ERRCODE='42501'; END IF;
 IF c.assigned_user_id IS NOT NULL AND c.assigned_user_id<>auth.uid() THEN RAISE EXCEPTION 'ALREADY_ASSIGNED' USING ERRCODE='23505'; END IF;
 IF c.assigned_user_id IS NULL THEN
  UPDATE public.conversation_links SET assigned_user_id=auth.uid(),chatwoot_assignee_id=m.agent_id,bot_active=false WHERE id=c.id;
  INSERT INTO public.audit_events(organization_id,branch_id,actor_id,action,entity_type,entity_id) VALUES(p_org,c.branch_id,auth.uid(),'AGENT_CLAIMED_CONVERSATION','conversation',p_conv::text);
 END IF;
 RETURN jsonb_build_object('agent_id',m.agent_id,'account_id',m.account_id,'branch_id',c.branch_id,'user_id',auth.uid());
END $$;
CREATE FUNCTION public.claim_conversation(p_org uuid,p_conv integer) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hub_private.claim_conversation(p_org,p_conv) $$;
REVOKE ALL ON FUNCTION public.claim_conversation(uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION hub_private.claim_conversation(uuid,integer),public.claim_conversation(uuid,integer) TO authenticated;

-- Durable reservation: never replay an uncertain external side effect automatically.
CREATE FUNCTION hub_private.reserve_webhook(p_key text,p_hash text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r hub_private.webhook_receipts; BEGIN
 INSERT INTO hub_private.webhook_receipts(event_key,payload_hash) VALUES(p_key,p_hash) ON CONFLICT DO NOTHING;
 IF FOUND THEN RETURN 'acquired'; END IF;
 SELECT * INTO r FROM hub_private.webhook_receipts WHERE event_key=p_key;
 IF r.payload_hash<>p_hash THEN RETURN 'conflict'; END IF;
 RETURN r.state;
END $$;
CREATE FUNCTION hub_private.finish_webhook(p_key text,p_state text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_state NOT IN ('completed','uncertain') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 UPDATE hub_private.webhook_receipts SET state=p_state,updated_at=now() WHERE event_key=p_key AND state='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
END $$;
CREATE FUNCTION public.reserve_webhook(p_key text,p_hash text) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hub_private.reserve_webhook(p_key,p_hash) $$;
CREATE FUNCTION public.finish_webhook(p_key text,p_state text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hub_private.finish_webhook(p_key,p_state) $$;
GRANT EXECUTE ON FUNCTION hub_private.reserve_webhook(text,text),hub_private.finish_webhook(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_webhook(text,text),public.finish_webhook(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_webhook(text,text),public.finish_webhook(text,text) TO service_role;

ALTER TABLE public.conversation_links ADD COLUMN bot_event_key text;
CREATE TABLE hub_private.customer_identities (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), account_id bigint NOT NULL, external_id text NOT NULL,
 customer_id uuid NOT NULL REFERENCES public.customers(id), PRIMARY KEY(organization_id,account_id,external_id)
);
REVOKE ALL ON hub_private.customer_identities FROM PUBLIC,anon,authenticated;
CREATE FUNCTION hub_private.sync_webhook(p_org uuid,p_branch uuid,p_account bigint,p_conv integer,p_channel text,p_contact text,p_name text,p_phone text,p_human boolean,p_key text,p_assignee bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversation_links; customer uuid; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=p_branch AND organization_id=p_org AND active) THEN RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE='42501'; END IF;
 IF p_channel NOT IN ('whatsapp','instagram','facebook') OR p_account<=0 OR p_conv<=0 THEN RAISE EXCEPTION 'INVALID_EVENT'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text||p_account::text||coalesce(p_contact,p_conv::text),0));
 IF p_contact IS NOT NULL THEN
  SELECT customer_id INTO customer FROM hub_private.customer_identities WHERE organization_id=p_org AND account_id=p_account AND external_id=p_contact;
  IF NOT FOUND THEN
   INSERT INTO public.customers(organization_id,name,phone) VALUES(p_org,coalesce(nullif(p_name,''),'Contato Chatwoot'),nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'')) RETURNING id INTO customer;
   INSERT INTO hub_private.customer_identities VALUES(p_org,p_account,p_contact,customer);
   INSERT INTO public.customer_channels(customer_id,channel_type,external_id) VALUES(customer,p_channel,p_account::text||':'||p_contact);
  END IF;
 END IF;
 INSERT INTO public.conversation_links(organization_id,branch_id,customer_id,chatwoot_conversation_id,chatwoot_account_id,channel,bot_active)
 VALUES(p_org,p_branch,customer,p_conv,p_account,p_channel,NOT p_human) ON CONFLICT(organization_id,chatwoot_conversation_id) DO NOTHING;
 SELECT * INTO c FROM public.conversation_links WHERE organization_id=p_org AND chatwoot_conversation_id=p_conv FOR UPDATE;
 IF c.chatwoot_account_id IS DISTINCT FROM p_account OR c.branch_id IS DISTINCT FROM p_branch THEN RAISE EXCEPTION 'CONVERSATION_SCOPE_CONFLICT' USING ERRCODE='42501'; END IF;
 UPDATE public.conversation_links SET customer_id=coalesce(customer_id,customer),bot_active=bot_active AND NOT p_human WHERE id=c.id RETURNING * INTO c;
 IF p_key IS NOT NULL AND c.bot_active AND c.assigned_user_id IS NULL THEN
  IF c.bot_event_key IS NOT NULL THEN RAISE EXCEPTION 'BOT_TURN_PENDING'; END IF;
  UPDATE public.conversation_links SET bot_event_key=p_key WHERE id=c.id;
 END IF;
 IF p_assignee IS NOT NULL THEN
  UPDATE public.conversation_links SET chatwoot_assignee_id=p_assignee,
   assigned_user_id=(SELECT user_id FROM public.chatwoot_agents WHERE organization_id=p_org AND account_id=p_account AND agent_id=p_assignee)
  WHERE id=c.id RETURNING * INTO c;
 END IF;
 RETURN to_jsonb(c);
END $$;
CREATE FUNCTION public.sync_webhook(p_org uuid,p_branch uuid,p_account bigint,p_conv integer,p_channel text,p_contact text,p_name text,p_phone text,p_human boolean,p_key text,p_assignee bigint) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hub_private.sync_webhook(p_org,p_branch,p_account,p_conv,p_channel,p_contact,p_name,p_phone,p_human,p_key,p_assignee) $$;
CREATE FUNCTION hub_private.finish_bot_turn(p_org uuid,p_conv integer,p_key text,p_handoff boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.conversation_links SET bot_event_key=null,bot_active=bot_active AND NOT p_handoff WHERE organization_id=p_org AND chatwoot_conversation_id=p_conv AND bot_event_key=p_key;
END $$;
CREATE FUNCTION public.finish_bot_turn(p_org uuid,p_conv integer,p_key text,p_handoff boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hub_private.finish_bot_turn(p_org,p_conv,p_key,p_handoff) $$;
REVOKE ALL ON FUNCTION public.sync_webhook(uuid,uuid,bigint,integer,text,text,text,text,boolean,text,bigint), public.finish_bot_turn(uuid,integer,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_webhook(uuid,uuid,bigint,integer,text,text,text,text,boolean,text,bigint),hub_private.sync_webhook(uuid,uuid,bigint,integer,text,text,text,text,boolean,text,bigint),public.finish_bot_turn(uuid,integer,text,boolean),hub_private.finish_bot_turn(uuid,integer,text,boolean) TO service_role;
-- Validate all new writes without rewriting or migrating legacy rows.
ALTER TABLE public.branches ADD CONSTRAINT branches_org_id UNIQUE(organization_id,id);
ALTER TABLE public.customers ADD CONSTRAINT customers_org_id UNIQUE(organization_id,id);
ALTER TABLE public.conversation_links ADD CONSTRAINT conversation_branch_scope FOREIGN KEY(organization_id,branch_id) REFERENCES public.branches(organization_id,id) NOT VALID;
ALTER TABLE public.conversation_links ADD CONSTRAINT conversation_customer_scope FOREIGN KEY(organization_id,customer_id) REFERENCES public.customers(organization_id,id) NOT VALID;
ALTER TABLE public.sales ADD CONSTRAINT sale_branch_scope FOREIGN KEY(organization_id,branch_id) REFERENCES public.branches(organization_id,id) NOT VALID;
ALTER TABLE public.sales ADD CONSTRAINT sale_customer_scope FOREIGN KEY(organization_id,customer_id) REFERENCES public.customers(organization_id,id) NOT VALID;
ALTER TABLE public.internal_rooms ADD CONSTRAINT room_branch_scope FOREIGN KEY(organization_id,branch_id) REFERENCES public.branches(organization_id,id) NOT VALID;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_branch_scope FOREIGN KEY(organization_id,branch_id) REFERENCES public.branches(organization_id,id) NOT VALID;
NOTIFY pgrst,'reload schema';
COMMIT;
