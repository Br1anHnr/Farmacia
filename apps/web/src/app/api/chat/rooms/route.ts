import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/server/supabase";

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const rooms = await supabaseRest<any[]>("internal_rooms", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: `eq.${auth.context.organizationId}`,
      select: "id,name,branch_id,is_general,branches(name)",
      order: "is_general.desc,name.asc",
    },
  });
  if (rooms.error) {
    return NextResponse.json({ error: "ROOMS_UNAVAILABLE" }, { status: 503 });
  }

  return NextResponse.json({
    rooms: (rooms.data || []).map((room) => ({
      id: room.id,
      name: room.is_general ? "Sala Geral" : room.name,
      branch_id: room.branch_id,
      branch_name: room.branches?.name || null,
      is_general: room.is_general,
    })),
  });
}
