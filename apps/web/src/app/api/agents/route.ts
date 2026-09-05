import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  // Busca membros da organizacao com papel e perfil
  const membersRes = await supabaseRest<any[]>("organization_members", {
    accessToken: auth.context.accessToken,
    params: {
      organization_id: `eq.${auth.context.organizationId}`,
      select: "user_id,role",
    },
  });

  if (membersRes.error) {
    return NextResponse.json(
      { error: "AGENTS_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const profilesRes = await supabaseRest<any[]>("profiles", {
    accessToken: auth.context.accessToken,
    params: {
      select: "id,full_name",
    },
  });

  const profilesMap = new Map<string, string>();
  (profilesRes.data || []).forEach((p) => {
    profilesMap.set(p.id, p.full_name);
  });

  const branchesRes = await supabaseRest<any[]>("branch_members", {
    accessToken: auth.context.accessToken,
    params: {
      select: "user_id,branch_id,branches(name)",
    },
  });

  const branchMap = new Map<string, { branch_id: string; branch_name: string }>();
  (branchesRes.data || []).forEach((b) => {
    if (b.branch_id) {
      branchMap.set(b.user_id, {
        branch_id: b.branch_id,
        branch_name: b.branches?.name || "Filial",
      });
    }
  });

  const agents = (membersRes.data || [])
    .filter((m) => ["agent", "manager"].includes(m.role))
    .map((m) => {
      const b = branchMap.get(m.user_id);
      return {
        id: m.user_id,
        name: profilesMap.get(m.user_id) || (m.role === "manager" ? "Gerente" : "Atendente"),
        role: m.role === "manager" ? "Gerente" : "Atendente",
        branch_id: b?.branch_id || auth.context.branchIds[0],
        branch_name: b?.branch_name || "Matriz Centro",
      };
    });

  return NextResponse.json({ agents });
}
