"use client";
import { useEffect, useState } from "react";
import { watchHubSession, type HubSession } from "./hub-session";

export function useHubSession(refreshKey: unknown = null) {
  const [session, setSession] = useState<HubSession>({ user: null, accountId: 0, loading: true, error: null });
  useEffect(() => watchHubSession((next) => setSession((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)), [refreshKey]);
  return session;
}
