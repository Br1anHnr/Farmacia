import { NextRequest, NextResponse } from "next/server";
import { authorize, userContext } from "@/lib/server-auth";
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ("response" in auth) return auth.response;
  return NextResponse.json({
    authenticated: true,
    user: userContext(auth.context),
  });
}
