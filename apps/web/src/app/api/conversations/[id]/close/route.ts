import { NextResponse, type NextRequest } from "next/server";
import { CloseConversationInputSchema } from "@hub-farmacia/contracts";
import { supabaseAdminRest, supabaseRest } from "@/lib/server/supabase";
import { uuid } from "@/lib/server-auth";
import { conversationAccess } from "@/lib/conversation-access";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
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
    input.chatwoot_account_id !== auth.accountId ||
    input.organization_id !== auth.context.organizationId ||
    !auth.context.branchIds.includes(input.branch_id)
  )
    return NextResponse.json({ error: "CLOSURE_ACCESS_DENIED" }, { status: 403 });

  // Se a conversa for aberta e nao tiver atendente atribuido, atribui ao agente que esta fechando
  if (auth.context.role === "agent") {
    try {
      const convCheck = await supabaseAdminRest<any[]>("conversation_links", {
        params: {
          organization_id: `eq.${auth.context.organizationId}`,
          chatwoot_account_id: `eq.${auth.accountId}`,
          chatwoot_conversation_id: `eq.${conversationId}`,
          select: "id,assigned_user_id",
        },
      });
      if (convCheck.data?.[0] && !convCheck.data[0].assigned_user_id) {
        await supabaseAdminRest("conversation_links", {
          method: "PATCH",
          params: { id: `eq.${convCheck.data[0].id}` },
          body: { assigned_user_id: auth.context.userId },
        });
      }
    } catch {
      // Segue para a RPC que fara a validacao de seguranca
    }
  }

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

  // Sincroniza resolucao com Chatwoot se configurado (best-effort)
  const cwBase = process.env.CHATWOOT_BASE_URL;
  const cwToken = process.env.CHATWOOT_API_TOKEN;
  const cwAccount = auth.accountId;

  if (cwBase && cwToken) {
    try {
      // 1. Marca como resolvida no Chatwoot
      fetch(
        `${cwBase}/api/v1/accounts/${cwAccount}/conversations/${conversationId}/toggle_status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            api_access_token: cwToken,
          },
          body: JSON.stringify({ status: "resolved" }),
          signal: AbortSignal.timeout(4000),
        },
      ).catch(() => {});

      // 2. Envia nota interna de fechamento
      const outcomeDesc =
        input.outcome === "sale"
          ? `Venda confirmada e registrada no sistema`
          : input.outcome === "not_sold"
          ? `Não venda registrada (${input.reason || "sem motivo"})`
          : input.outcome === "resolved"
          ? `Dúvida resolvida com sucesso`
          : `Atendimento cancelado`;

      fetch(
        `${cwBase}/api/v1/accounts/${cwAccount}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            api_access_token: cwToken,
          },
          body: JSON.stringify({
            content: `[MultiFarma Hub] Atendimento finalizado por ${auth.context.fullName}. Desfecho: ${outcomeDesc}.`,
            private: true,
          }),
          signal: AbortSignal.timeout(4000),
        },
      ).catch(() => {});
    } catch {
      // Nao falha a resposta se o Chatwoot estiver temporariamente inacessivel
    }
  }

  return NextResponse.json(result.data, { status: 201 });
}
