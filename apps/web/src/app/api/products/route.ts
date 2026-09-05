import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (!["agent", "manager"].includes(auth.context.role))
    return NextResponse.json({ error: "ACCESS_DENIED" }, { status: 403 });
  const result = await supabaseRest<any[]>("products", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: "eq." + auth.context.organizationId,
      active: "eq.true",
      select: "id,name,default_price",
      order: "name.asc",
      limit: "100",
    },
  });
  if (result.error)
    return NextResponse.json({ error: "CATALOG_UNAVAILABLE" }, { status: 503 });
  return NextResponse.json({
    products: (result.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.default_price),
    })),
  });
}
