import { NextRequest, NextResponse } from "next/server";
import { authorize } from "./server-auth";
import { supabaseRest } from "./supabase";
export async function conversationAccess(request: NextRequest, id: string) {
  const auth = await authorize(request);
  if ("response" in auth) return auth;
  if (!["agent", "manager"].includes(auth.context.role))
    return {
      response: NextResponse.json({ error: "ACCESS_DENIED" }, { status: 403 }),
    };
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    return {
      response: NextResponse.json(
        { error: "INVALID_CONVERSATION_ID" },
        { status: 400 },
      ),
    };
  const result = await supabaseRest<any[]>("conversation_links", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: "eq." + auth.context.organizationId,
      chatwoot_conversation_id: "eq." + id,
      branch_id: "in.(" + auth.context.branchIds.join(",") + ")",
      select: "*",
    },
  });
  if (result.error)
    return {
      response: NextResponse.json(
        { error: "DATA_UNAVAILABLE" },
        { status: 503 },
      ),
    };
  if (result.data?.length !== 1)
    return {
      response: NextResponse.json(
        { error: "CONVERSATION_NOT_FOUND" },
        { status: 404 },
      ),
    };
  return { context: auth.context, conversation: result.data[0] };
}
