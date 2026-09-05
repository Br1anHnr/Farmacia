import { NextRequest, NextResponse } from "next/server";
import { supabaseAuthLogin } from "@/lib/supabase";
import {
  authorizeToken,
  checkMutationOrigin,
  userContext,
} from "@/lib/server-auth";
export async function POST(req: NextRequest) {
  const originError = checkMutationOrigin(req, true);
  if (originError) return originError;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    !body.email.trim() ||
    !body.password ||
    body.email.length > 254 ||
    body.password.length > 1024
  )
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  const result = await supabaseAuthLogin(
    body.email.trim().toLowerCase(),
    body.password,
  );
  if (result.error || !result.data?.access_token)
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  const auth = await authorizeToken(result.data.access_token);
  if ("response" in auth) return auth.response;
  const user = userContext(auth.context);
  const response = NextResponse.json({
    success: true,
    user,
    redirectTo: user.role === "manager" ? "/dashboard" : "/chatwoot-widget",
  });
  const options = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.min(Number(result.data.expires_in) || 3600, 3600),
  };
  response.cookies.set("sb_access_token", result.data.access_token, options);
  // No unused long-lived refresh token retained; expiry requires login until SSO evaluation.
  response.cookies.set("sb_refresh_token", "", { ...options, maxAge: 0 });
  response.cookies.set("mf_user_role", "", { ...options, maxAge: 0 });
  response.cookies.set("mf_user_id", "", { ...options, maxAge: 0 });
  return response;
}
