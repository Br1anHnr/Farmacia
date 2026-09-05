import { NextRequest, NextResponse } from "next/server";
import { authorize, uuid } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/supabase";
async function roomAccess(request: NextRequest, room: unknown) {
  const auth = await authorize(request);
  if ("response" in auth) return auth;
  if (typeof room !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(room))
    return {
      response: NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 }),
    };
  const params: Record<string, string> = {
    organization_id: "eq." + auth.context.organizationId,
    select: "id,branch_id",
  };
  if (uuid.test(room)) params.id = "eq." + room;
  else if (room === "geral") params.is_general = "eq.true";
  else params.name = "ilike.*" + room + "*";
  const rooms = await supabaseRest<any[]>("internal_rooms", {
    accessToken: auth.context.accessToken,
    params,
  });
  if (rooms.error)
    return {
      response: NextResponse.json(
        { error: "DATA_UNAVAILABLE" },
        { status: 503 },
      ),
    };
  if (rooms.data?.length !== 1)
    return {
      response: NextResponse.json(
        { error: "ROOM_ACCESS_DENIED" },
        { status: 403 },
      ),
    };
  return { context: auth.context, roomId: rooms.data[0].id };
}
function format(m: any) {
  return {
    ...m,
    sender: m.sender_id,
    time: new Date(m.created_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
export async function GET(request: NextRequest) {
  const auth = await roomAccess(
    request,
    request.nextUrl.searchParams.get("room") || "geral",
  );
  if ("response" in auth) return auth.response;
  const res = await supabaseRest<any[]>("internal_messages", {
    accessToken: auth.context.accessToken,
    params: {
      room_id: "eq." + auth.roomId,
      select: "id,sender_id,content,created_at",
      order: "created_at.desc",
      limit: "100",
    },
  });
  if (res.error)
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  return NextResponse.json({
    messages: (res.data || []).reverse().map(format),
  });
}
export async function POST(request: NextRequest) {
  // Authenticate before parsing any user-controlled body.
  const session = await authorize(request);
  if ("response" in session) return session.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const auth = await roomAccess(request, body.room || "geral");
  if ("response" in auth) return auth.response;
  if (
    typeof body.content !== "string" ||
    !body.content.trim() ||
    body.content.length > 4000
  )
    return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  const res = await supabaseRest<any[]>("internal_messages", {
    accessToken: auth.context.accessToken,
    method: "POST",
    body: {
      room_id: auth.roomId,
      sender_id: auth.context.userId,
      content: body.content.trim(),
    },
  });
  if (res.error || !res.data?.[0]?.id)
    return NextResponse.json(
      { error: "MESSAGE_NOT_PERSISTED" },
      { status: 503 },
    );
  return NextResponse.json({ message: format(res.data[0]) }, { status: 201 });
}
