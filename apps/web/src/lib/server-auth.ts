import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthGetUser, supabaseRest } from "./supabase";
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied = (status: number, error: string) => ({
  response: NextResponse.json({ error }, { status }),
});
/** Fresh server-owned membership; never trust role cookies or user_metadata. */
export async function authorize(request: NextRequest, managerOnly = false) {
  const token =
    request.cookies.get("sb_access_token")?.value ||
    request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const originError = checkMutationOrigin(request);
  if (originError) return { response: originError };
  return authorizeToken(token, managerOnly);
}
export async function authorizeToken(
  token: string | undefined,
  managerOnly = false,
) {
  if (!token) return denied(401, "UNAUTHENTICATED");
  const auth = await supabaseAuthGetUser(token);
  if (auth.error || !uuid.test(auth.data?.id || ""))
    return denied(401, "UNAUTHENTICATED");
  const members = await supabaseRest<any[]>("organization_members", {
    accessToken: token,
    params: { user_id: "eq." + auth.data.id, select: "organization_id,role" },
  });
  if (members.error) return denied(503, "AUTHORIZATION_UNAVAILABLE");
  // Multiple organizations require an explicit, validated selection in a later increment.
  if (members.data?.length !== 1 || !uuid.test(members.data[0].organization_id))
    return denied(403, "MEMBERSHIP_REQUIRED");
  const member = members.data[0];
  if (!["manager", "agent", "admin", "viewer"].includes(member.role))
    return denied(403, "INVALID_ROLE");
  if (managerOnly && member.role !== "manager")
    return denied(403, "ACCESS_DENIED_MANAGER_ONLY");
  const branches = await supabaseRest<any[]>("branch_members", {
    accessToken: token,
    params: {
      user_id: "eq." + auth.data.id,
      select: "branch_id,branches!inner(organization_id)",
      "branches.organization_id": "eq." + member.organization_id,
    },
  });
  if (branches.error) return denied(503, "AUTHORIZATION_UNAVAILABLE");
  const branchIds: string[] = (branches.data || [])
    .map((b) => b.branch_id)
    .filter((id) => uuid.test(id));
  if (!branchIds.length) return denied(403, "BRANCH_MEMBERSHIP_REQUIRED");
  return {
    context: {
      accessToken: token,
      email: String(auth.data.email || ""),
      fullName: String(
        auth.data.user_metadata?.full_name || auth.data.email || "Usuário",
      ),
      userId: auth.data.id as string,
      organizationId: member.organization_id as string,
      role: member.role as string,
      branchIds,
    },
  };
}

export function checkMutationOrigin(request: NextRequest, required = false) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || request.nextUrl.origin;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== expected) ||
    (!origin && (required || request.cookies.has("sb_access_token")))
  ) {
    return NextResponse.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  }
  return null;
}
export function userContext(c: {
  userId: string;
  organizationId: string;
  role: string;
  branchIds: string[];
  email: string;
  fullName: string;
}) {
  return {
    user_id: c.userId,
    organization_id: c.organizationId,
    role: c.role,
    branch_ids: c.branchIds,
    primary_branch_id: c.branchIds[0],
    email: c.email,
    full_name: c.fullName,
  };
}
