BEGIN;

-- Existing installations used the same stable branch IDs with provisional
-- names/codes. Reconcile by ID so foreign keys and history remain intact.
CREATE OR REPLACE FUNCTION hub_private.configure_multifarma_branches(p_org uuid)
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
  WHERE organization_id = p_org
    AND code IN ('GUA-01', 'GUA-02', 'POT-01')
  ORDER BY code;
END
$$;

REVOKE ALL ON FUNCTION hub_private.configure_multifarma_branches(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION hub_private.configure_multifarma_branches(uuid)
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
    PERFORM hub_private.configure_multifarma_branches(organization_row.id);
    PERFORM hub_private.ensure_multifarma_internal_rooms(organization_row.id);
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
