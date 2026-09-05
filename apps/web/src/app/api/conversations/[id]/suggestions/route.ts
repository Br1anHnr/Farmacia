import { NextResponse, type NextRequest } from "next/server";
import { conversationAccess } from "@/lib/conversation-access";
import { supabaseRest } from "@/lib/supabase";
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await conversationAccess(request, params.id);
  if ("response" in auth) return auth.response;
  // Existing extractor prices are synthetic; never offer them to a real sale.
  if ((process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production"))
    return NextResponse.json({ suggestions: [], available: false });
  const result = await supabaseRest<any[]>("extraction_suggestions", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: "eq." + auth.context.organizationId,
      chatwoot_conversation_id: "eq." + params.id,
      select: "*",
      order: "created_at.desc",
      limit: "10",
    },
  });
  if (result.error)
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  return NextResponse.json({ suggestions: result.data || [], demo: true });
}
