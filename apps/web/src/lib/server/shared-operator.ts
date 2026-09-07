import { supabaseRest } from "./supabase";
import { ChatwootError } from "./chatwoot";

/** Server-owned setting. Hub collaborators retain individual authorization. */
export async function sharedOperator(context: { organizationId: string; accessToken: string }, accountId: number) {
  const result = await supabaseRest<Array<{ shared_agent_id: number }>>("chatwoot_operation_settings", {
    accessToken: context.accessToken,
    params: { organization_id: `eq.${context.organizationId}`, account_id: `eq.${accountId}`, select: "shared_agent_id" },
  });
  if (result.error) throw new ChatwootError("OPERATION_CONFIGURATION_UNAVAILABLE", 503);
  return result.data?.[0]?.shared_agent_id ?? null;
}

/** The current operational flow requires the actual destination agent in Chatwoot. */
export async function requireIndividualAssignment(context: { organizationId: string; accessToken: string }, accountId: number) {
  if (await sharedOperator(context, accountId) !== null) {
    throw new ChatwootError("INDIVIDUAL_AGENT_MODE_REQUIRED", 409);
  }
}
