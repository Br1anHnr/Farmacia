/**
 * Cliente HTTP leve para a REST API do Supabase
 * Utiliza fetch nativo sem dependências externas adicionais.
 */

export const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export async function supabaseRest<T = any>(
  endpoint: string,
  options: {
    accessToken?: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: any;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): Promise<{
  data: T | null;
  error: string | null;
  status: number;
  totalCount?: number;
}> {
  try {
    if (!options.accessToken)
      return { data: null, error: "USER_TOKEN_REQUIRED", status: 401 };
    const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) =>
        url.searchParams.set(k, v),
      );
    }

    const headers: Record<string, string> = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    };

    const res = await fetch(url.toString(), {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        data: null,
        error: `Supabase error (${res.status}): ${errorText}`,
        status: res.status,
      };
    }

    const data = res.status === 204 ? null : await res.json();
    const count = res.headers.get("content-range")?.split("/")[1];
    return {
      data,
      error: null,
      status: res.status,
      totalCount: count && count !== "*" ? Number(count) : undefined,
    };
  } catch (err) {
    return { data: null, error: (err as Error).message, status: 500 };
  }
}

export async function supabaseAuthLogin(email: string, password: string) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        data: null,
        error: data.error_description || data.msg || "Credenciais inválidas",
        status: res.status,
      };
    }

    return { data, error: null, status: 200 };
  } catch (err) {
    return { data: null, error: (err as Error).message, status: 500 };
  }
}

export async function supabaseAuthGetUser(accessToken: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        data: null,
        error: data.msg || "Sessão inválida",
        status: res.status,
      };
    }

    return { data, error: null, status: 200 };
  } catch (err) {
    return { data: null, error: (err as Error).message, status: 500 };
  }
}

export async function supabaseAuthLogout(accessToken: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return { success: response.ok };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
