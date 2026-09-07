BEGIN;

-- Keep room identity stable while deriving display names and memberships from
-- the current branch and organization membership tables.
CREATE OR REPLACE FUNCTION hub_private.refresh_internal_room_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.internal_room_members membership
  USING public.internal_rooms room
  WHERE room.id = membership.room_id
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_members organization_member
        WHERE organization_member.organization_id = room.organization_id
          AND organization_member.user_id = membership.user_id
      )
      OR (
        room.branch_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.branch_members branch_member
          WHERE branch_member.branch_id = room.branch_id
            AND branch_member.user_id = membership.user_id
        )
      )
    );

  INSERT INTO public.internal_room_members (room_id, user_id)
  SELECT room.id, organization_member.user_id
  FROM public.internal_rooms room
  JOIN public.organization_members organization_member
    ON organization_member.organization_id = room.organization_id
  WHERE room.is_general
  ON CONFLICT (room_id, user_id) DO NOTHING;

  INSERT INTO public.internal_room_members (room_id, user_id)
  SELECT room.id, branch_member.user_id
  FROM public.internal_rooms room
  JOIN public.branch_members branch_member ON branch_member.branch_id = room.branch_id
  JOIN public.organization_members organization_member
    ON organization_member.organization_id = room.organization_id
   AND organization_member.user_id = branch_member.user_id
  WHERE room.branch_id IS NOT NULL
  ON CONFLICT (room_id, user_id) DO NOTHING;
END
$$;

CREATE OR REPLACE FUNCTION hub_private.ensure_multifarma_internal_rooms(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org) THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';
  END IF;

  INSERT INTO public.internal_rooms (id, organization_id, branch_id, name, is_general)
  SELECT '77777777-7777-7777-7777-777777777771', p_org, NULL, 'Sala Geral', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.internal_rooms
    WHERE organization_id = p_org AND is_general
  );

  INSERT INTO public.internal_rooms (id, organization_id, branch_id, name, is_general)
  SELECT CASE branch.code
      WHEN 'GUA-01' THEN '77777777-7777-7777-7777-777777777773'::uuid
      WHEN 'GUA-02' THEN '77777777-7777-7777-7777-777777777772'::uuid
      WHEN 'POT-01' THEN '77777777-7777-7777-7777-777777777774'::uuid
    END,
    branch.organization_id, branch.id, 'Equipe — ' || branch.name, false
  FROM public.branches branch
  WHERE branch.organization_id = p_org
    AND branch.active
    AND branch.code IN ('GUA-01', 'GUA-02', 'POT-01')
    AND NOT EXISTS (
      SELECT 1 FROM public.internal_rooms room
      WHERE room.organization_id = branch.organization_id
        AND room.branch_id = branch.id
    );

  UPDATE public.internal_rooms room
  SET name = CASE
    WHEN room.is_general THEN 'Sala Geral'
    ELSE 'Equipe — ' || branch.name
  END
  FROM public.branches branch
  WHERE room.organization_id = p_org
    AND room.branch_id = branch.id;

  UPDATE public.internal_rooms
  SET name = 'Sala Geral'
  WHERE organization_id = p_org AND is_general;

  PERFORM hub_private.refresh_internal_room_memberships();
END
$$;

CREATE OR REPLACE FUNCTION hub_private.refresh_internal_room_memberships_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM hub_private.refresh_internal_room_memberships();
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS refresh_rooms_after_organization_members ON public.organization_members;
CREATE TRIGGER refresh_rooms_after_organization_members
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH STATEMENT EXECUTE FUNCTION hub_private.refresh_internal_room_memberships_trigger();

DROP TRIGGER IF EXISTS refresh_rooms_after_branch_members ON public.branch_members;
CREATE TRIGGER refresh_rooms_after_branch_members
AFTER INSERT OR UPDATE OR DELETE ON public.branch_members
FOR EACH STATEMENT EXECUTE FUNCTION hub_private.refresh_internal_room_memberships_trigger();

DROP TRIGGER IF EXISTS refresh_rooms_after_internal_rooms ON public.internal_rooms;
CREATE TRIGGER refresh_rooms_after_internal_rooms
AFTER INSERT OR UPDATE ON public.internal_rooms
FOR EACH STATEMENT EXECUTE FUNCTION hub_private.refresh_internal_room_memberships_trigger();

REVOKE ALL ON FUNCTION
  hub_private.refresh_internal_room_memberships(),
  hub_private.ensure_multifarma_internal_rooms(uuid),
  hub_private.refresh_internal_room_memberships_trigger()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  hub_private.refresh_internal_room_memberships(),
  hub_private.ensure_multifarma_internal_rooms(uuid)
TO service_role;

DO $$
DECLARE organization_row record;
BEGIN
  FOR organization_row IN
    SELECT DISTINCT organization_id AS id
    FROM public.branches
    WHERE id IN (
      '22222222-2222-2222-2222-222222222221',
      '22222222-2222-2222-2222-222222222222',
      '22222222-2222-2222-2222-222222222223'
    )
  LOOP
    PERFORM hub_private.ensure_multifarma_internal_rooms(organization_row.id);
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
