export function sessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    path: "/",
    httpOnly: true,
    secure,
    // Mutations still require the Hub's own Origin. Never share tokens via postMessage.
    sameSite: secure ? "none" as const : "lax" as const,
  };
}
