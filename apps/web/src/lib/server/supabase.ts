import {
  adminSupabaseHeaders,
  publicSupabaseHeaders,
  userSupabaseHeaders,
} from "../../../../../packages/supabase-http/index.mjs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

type RestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
};

type UserRestOptions = RestOptions & { accessToken?: string };

type RestResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
  totalCount?: number;
};

async function request<T>(
  endpoint: string,
  options: RestOptions,
  headers: Record<string, string>,
): Promise<RestResult<T>> {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
    }
    const response = await fetch(url.toString(), {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        data: null,
        error: `Supabase error (${response.status}): ${await response.text()}`,
        status: response.status,
      };
    }
    const data = response.status === 204 ? null : await response.json();
    const count = response.headers.get("content-range")?.split("/")[1];
    return {
      data,
      error: null,
      status: response.status,
      totalCount: count && count !== "*" ? Number(count) : undefined,
    };
  } catch (error) {
    return { data: null, error: (error as Error).message, status: 500 };
  }
}

/** Data API/RPC under the signed-in user's JWT and existing RLS policies. */
export async function supabaseRest<T = unknown>(
  endpoint: string,
  options: UserRestOptions = {},
): Promise<RestResult<T>> {
  if (!options.accessToken)
    return { data: null, error: "USER_TOKEN_REQUIRED", status: 401 };
  try {
    return request<T>(
      endpoint,
      options,
      userSupabaseHeaders(
        SUPABASE_PUBLISHABLE_KEY,
        options.accessToken,
        {
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...options.headers,
        },
      ),
    );
  } catch (error) {
    return { data: null, error: (error as Error).message, status: 500 };
  }
}

/** Server-only administrative Data API calls. Never carries a bearer token. */
export async function supabaseAdminRest<T = unknown>(
  endpoint: string,
  options: RestOptions = {},
): Promise<RestResult<T>> {
  try {
    return request<T>(
      endpoint,
      options,
      adminSupabaseHeaders(process.env.SUPABASE_SECRET_KEY || "", {
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      }),
    );
  } catch (error) {
    return { data: null, error: (error as Error).message, status: 500 };
  }
}

export async function supabaseAuthLogin(email: string, password: string) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: publicSupabaseHeaders(SUPABASE_PUBLISHABLE_KEY, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ email, password }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      return {
        data: null,
        error: data.error_description || data.msg || "Credenciais inválidas",
        status: response.status,
      };
    }
    return { data, error: null, status: 200 };
  } catch (error) {
    return { data: null, error: (error as Error).message, status: 500 };
  }
}

export async function supabaseAuthGetUser(accessToken: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      cache: "no-store",
      headers: userSupabaseHeaders(SUPABASE_PUBLISHABLE_KEY, accessToken),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        data: null,
        error: data.msg || "Sessão inválida",
        status: response.status,
      };
    }
    return { data, error: null, status: 200 };
  } catch (error) {
    return { data: null, error: (error as Error).message, status: 500 };
  }
}

export async function supabaseAuthLogout(accessToken: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: userSupabaseHeaders(SUPABASE_PUBLISHABLE_KEY, accessToken),
    });
    return { success: response.ok };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
