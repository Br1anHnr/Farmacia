BEGIN;

-- Recover a missing agent mapping only when existing conversation state proves
-- that one Chatwoot agent maps to exactly one organization member.
WITH candidate AS (
  SELECT
    mapping.id AS mapping_id,
    min(conversation.assigned_user_id::text)::uuid AS user_id
  FROM public.chatwoot_agents mapping
  JOIN public.conversation_links conversation
    ON conversation.organization_id = mapping.organization_id
   AND conversation.chatwoot_account_id = mapping.account_id
   AND conversation.chatwoot_assignee_id = mapping.agent_id
  JOIN public.organization_members member
    ON member.organization_id = mapping.organization_id
   AND member.user_id = conversation.assigned_user_id
   AND member.role IN ('agent', 'manager')
  WHERE mapping.user_id IS NULL
    AND conversation.assigned_user_id IS NOT NULL
  GROUP BY mapping.id
  HAVING count(DISTINCT conversation.assigned_user_id) = 1
), unambiguous AS (
  SELECT candidate.*
  FROM candidate
  JOIN public.chatwoot_agents mapping ON mapping.id = candidate.mapping_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.chatwoot_agents existing
    WHERE existing.organization_id = mapping.organization_id
      AND existing.account_id = mapping.account_id
      AND existing.user_id = candidate.user_id
      AND existing.id <> mapping.id
  )
)
UPDATE public.chatwoot_agents mapping
SET user_id = unambiguous.user_id,
    last_synced_at = timezone('utc'::text, now())
FROM unambiguous
WHERE mapping.id = unambiguous.mapping_id;

NOTIFY pgrst, 'reload schema';
COMMIT;
