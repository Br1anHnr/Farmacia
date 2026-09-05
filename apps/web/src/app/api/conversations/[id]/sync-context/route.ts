import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (!["agent", "manager"].includes(auth.context.role)) {
    return NextResponse.json({ error: "ACCESS_DENIED" }, { status: 403 });
  }

  const id = params.id;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return NextResponse.json(
      { error: "INVALID_CONVERSATION_ID" },
      { status: 400 },
    );
  }

  const adminToken = process.env.SUPABASE_SECRET_KEY || auth.context.accessToken;

  // 1. Verifica se ja existe vinculo
  const existing = await supabaseRest<any[]>("conversation_links", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: `eq.${auth.context.organizationId}`,
      chatwoot_conversation_id: `eq.${id}`,
      branch_id: `in.(${auth.context.branchIds.join(",")})`,
      select: "*",
    },
  });

  if (existing.data?.length === 1) {
    return NextResponse.json({
      linked: true,
      conversation: existing.data[0],
    });
  }

  // 2. Se nao existir, busca dados no Chatwoot para vincular sob demanda
  const cwBase = process.env.CHATWOOT_BASE_URL;
  const cwToken = process.env.CHATWOOT_API_TOKEN;
  const cwAccount = Number(process.env.CHATWOOT_ACCOUNT_ID || "1");

  if (!cwBase || !cwToken || auth.context.branchIds.length === 0) {
    return NextResponse.json(
      { error: "CONVERSATION_NOT_FOUND" },
      { status: 404 },
    );
  }

  try {
    const cwRes = await fetch(
      `${cwBase}/api/v1/accounts/${cwAccount}/conversations/${id}`,
      {
        headers: { api_access_token: cwToken },
        signal: AbortSignal.timeout(6000),
      },
    );

    if (!cwRes.ok) {
      return NextResponse.json(
        { error: "CONVERSATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const cwData = await cwRes.json();
    const sender = cwData.meta?.sender || cwData.sender || {};
    const contactName = sender.name || "Cliente WhatsApp";
    const contactPhone = sender.phone_number || null;
    const targetBranchId = auth.context.branchIds[0];

    // 2.1 Garante cliente no Supabase
    let customerId: string | undefined;
    if (contactPhone) {
      const findCust = await supabaseRest<any[]>("customers", {
        accessToken: adminToken,
        params: {
          organization_id: `eq.${auth.context.organizationId}`,
          phone: `eq.${contactPhone}`,
          select: "id",
        },
      });
      if (findCust.data?.[0]?.id) {
        customerId = findCust.data[0].id;
      }
    }

    if (!customerId) {
      const newCust = await supabaseRest<any[]>("customers", {
        accessToken: adminToken,
        method: "POST",
        body: {
          organization_id: auth.context.organizationId,
          name: contactName,
          phone: contactPhone,
        },
      });
      if (newCust.data?.[0]?.id) {
        customerId = newCust.data[0].id;
        if (contactPhone) {
          await supabaseRest("customer_channels", {
            accessToken: adminToken,
            method: "POST",
            body: {
              customer_id: customerId,
              channel_type: "whatsapp",
              external_id: contactPhone,
            },
          });
        }
      }
    }

    // 2.2 Cria link no Supabase
    if (customerId && targetBranchId) {
      const newLink = await supabaseRest<any[]>("conversation_links", {
        accessToken: adminToken,
        method: "POST",
        body: {
          organization_id: auth.context.organizationId,
          branch_id: targetBranchId,
          customer_id: customerId,
          chatwoot_account_id: cwAccount,
          chatwoot_conversation_id: Number(id),
          channel: "whatsapp",
          status: "open",
          bot_active: false,
        },
      });

      if (newLink.data?.[0]?.id) {
        return NextResponse.json({
          linked: true,
          conversation: newLink.data[0],
        });
      }
    }

    return NextResponse.json(
      { error: "CONVERSATION_NOT_FOUND" },
      { status: 404 },
    );
  } catch {
    return NextResponse.json(
      { error: "DATA_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
