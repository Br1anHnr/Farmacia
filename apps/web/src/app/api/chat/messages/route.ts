import { NextRequest, NextResponse } from "next/server";
import { authorize, uuid } from "@/lib/server-auth";
import { supabaseAdminRest, supabaseRest } from "@/lib/server/supabase";
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
  else
    return {
      response: NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 }),
    };
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
function format(m: any, defaultSender?: string) {
  return {
    ...m,
    sender: m.profiles?.full_name || defaultSender || m.sender_id,
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
  const senderIds = Array.from(new Set((res.data || []).map((m) => m.sender_id))).filter(
    (senderId) => uuid.test(senderId),
  );
  const profiles = senderIds.length
    ? await supabaseAdminRest<any[]>("profiles", {
        params: {
          id: `in.(${senderIds.join(",")})`,
          select: "id,full_name",
        },
      })
    : { data: [], error: null };
  if (profiles.error)
    return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503 });
  const names = new Map((profiles.data || []).map((profile) => [profile.id, profile.full_name]));
  return NextResponse.json({
    messages: (res.data || []).reverse().map((m) => format(m, names.get(m.sender_id))),
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
  if (body.message_id !== undefined && (typeof body.message_id !== "string" || !uuid.test(body.message_id))) {
    return NextResponse.json({ error: "INVALID_MESSAGE_ID" }, { status: 400 });
  }
  if (
    typeof body.content !== "string" ||
    !body.content.trim() ||
    body.content.length > 4000
  )
    return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  const res = await supabaseRest<any[]>("internal_messages", {
    accessToken: auth.context.accessToken,
    method: "POST",
    ...(body.message_id ? {
      params: { on_conflict: "id" },
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    } : {}),
    body: {
      ...(body.message_id ? { id: body.message_id } : {}),
      room_id: auth.roomId,
      sender_id: auth.context.userId,
      content: body.content.trim(),
    },
  });
  if (!res.error && body.message_id && !res.data?.length) {
    const existing = await supabaseRest<any[]>("internal_messages", {
      accessToken: auth.context.accessToken,
      params: { id: `eq.${body.message_id}`, room_id: `eq.${auth.roomId}`, sender_id: `eq.${auth.context.userId}`, select: "id,room_id,sender_id,content,created_at" },
    });
    if (existing.error) return NextResponse.json({ error: "MESSAGE_NOT_PERSISTED" }, { status: 503 });
    if (existing.data?.length !== 1 || existing.data[0].content !== body.content.trim()) {
      return NextResponse.json({ error: "MESSAGE_ID_CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ message: format(existing.data[0], auth.context.fullName), replayed: true });
  }
  if (res.error || !res.data?.[0]?.id)
    return NextResponse.json(
      { error: "MESSAGE_NOT_PERSISTED" },
      { status: 503 },
    );
  return NextResponse.json(
    { message: format(res.data[0], auth.context.fullName) },
    { status: 201 },
  );
}
