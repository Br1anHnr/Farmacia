BEGIN;
-- Reading the operational queue is distinct from claiming or closing it.
-- Mutating RPCs retain their ownership checks; transfers already validate scope.
DROP POLICY IF EXISTS conversation_read ON public.conversation_links;
CREATE POLICY conversation_read ON public.conversation_links
FOR SELECT TO authenticated USING (
  hub_private.member_role(organization_id) IN ('agent', 'manager')
  AND hub_private.has_branch(branch_id)
);
NOTIFY pgrst, 'reload schema';
COMMIT;
