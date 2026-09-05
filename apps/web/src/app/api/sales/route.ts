import { NextResponse, type NextRequest } from "next/server";
import { CreateSaleInputSchema } from "@hub-farmacia/contracts";
import { supabaseRest } from "@/lib/supabase";
import { authorize, uuid } from "@/lib/server-auth";
export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (!["agent", "manager"].includes(auth.context.role))
    return NextResponse.json({ error: "SALE_ACCESS_DENIED" }, { status: 403 });
  const key = request.headers.get("idempotency-key");
  if (!key || !uuid.test(key))
    return NextResponse.json(
      { error: "IDEMPOTENCY_KEY_REQUIRED" },
      { status: 400 },
    );
  let json;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = CreateSaleInputSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_SALE_INPUT" }, { status: 400 });
  const { agent_id, agent_name, ...input } = parsed.data;
  if (
    input.organization_id !== auth.context.organizationId ||
    !auth.context.branchIds.includes(input.branch_id)
  )
    return NextResponse.json({ error: "SALE_ACCESS_DENIED" }, { status: 403 });
  const result = await supabaseRest<any>("rpc/record_sale", {
    accessToken: auth.context.accessToken,
    method: "POST",
    body: { p_input: input, p_key: key },
  });
  if (
    result.error ||
    !uuid.test(result.data?.id || "") ||
    !Array.isArray(result.data?.items)
  )
    return NextResponse.json(
      {
        error:
          result.status === 409 ? "IDEMPOTENCY_CONFLICT" : "SALE_NOT_PERSISTED",
      },
      { status: [400, 403, 409].includes(result.status) ? result.status : 503 },
    );
  return NextResponse.json(result.data, { status: 201 });
}
