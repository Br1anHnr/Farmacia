import { NextResponse, type NextRequest } from "next/server";
import { CloseConversationInputSchema } from "@hub-farmacia/contracts";
import { supabaseRest } from "@/lib/supabase";
import { authorize, uuid } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (!["agent", "manager"].includes(auth.context.role))
    return NextResponse.json({ error: "CLOSURE_ACCESS_DENIED" }, { status: 403 });

  const conversationId = Number(params.id);
  const key = request.headers.get("idempotency-key");
  if (!Number.isInteger(conversationId) || conversationId <= 0)
    return NextResponse.json({ error: "INVALID_CONVERSATION" }, { status: 400 });
  if (!key || !uuid.test(key))
    return NextResponse.json(
      { error: "IDEMPOTENCY_KEY_REQUIRED" },
      { status: 400 },
    );

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = CloseConversationInputSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_CLOSURE_INPUT" }, { status: 400 });

  const input =
    parsed.data.outcome === "sale"
      ? (({ agent_id: _agentId, agent_name: _agentName, ...sale }) => sale)(
          parsed.data,
        )
      : parsed.data;
  if (
    input.chatwoot_conversation_id !== conversationId ||
    input.organization_id !== auth.context.organizationId ||
    !auth.context.branchIds.includes(input.branch_id)
  )
    return NextResponse.json({ error: "CLOSURE_ACCESS_DENIED" }, { status: 403 });

  const result = await supabaseRest<any>("rpc/close_conversation", {
    accessToken: auth.context.accessToken,
    method: "POST",
    body: { p_input: input, p_key: key },
  });
  const persisted =
    !result.error &&
    result.data?.persisted === true &&
    result.data?.outcome === input.outcome &&
    (input.outcome !== "sale" || uuid.test(result.data?.sale_id || ""));
  if (!persisted)
    return NextResponse.json(
      {
        error:
          result.status === 409
            ? "CLOSURE_CONFLICT"
            : "CONVERSATION_NOT_CLOSED",
      },
      { status: [400, 403, 409].includes(result.status) ? result.status : 503 },
    );

  return NextResponse.json(result.data, { status: 201 });
}
