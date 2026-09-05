import { NextRequest, NextResponse } from "next/server";
import { checkMutationOrigin } from "@/lib/server-auth";
import { supabaseAuthLogout } from "@/lib/supabase";
export async function POST(req: NextRequest) {
  const error = checkMutationOrigin(req, true);
  if (error) return error;
  const token = req.cookies.get("sb_access_token")?.value;
  const result = token ? await supabaseAuthLogout(token) : { success: true };
  const response = NextResponse.json(
    result.success
      ? { success: true, redirectTo: "/login" }
      : { error: "SESSION_REVOCATION_FAILED", success: false },
    { status: result.success ? 200 : 503 },
  );
  for (const name of [
    "sb_access_token",
    "sb_refresh_token",
    "mf_user_role",
    "mf_user_id",
  ])
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  return response;
}
