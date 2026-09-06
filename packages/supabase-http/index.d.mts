export type SupabaseHeaders = Record<string, string>;

export function publicSupabaseHeaders(
  publishable: string,
  extraHeaders?: SupabaseHeaders,
): SupabaseHeaders;

export function userSupabaseHeaders(
  publishable: string,
  jwt: string,
  extraHeaders?: SupabaseHeaders,
): SupabaseHeaders;

export function adminSupabaseHeaders(
  secret: string,
  extraHeaders?: SupabaseHeaders,
): SupabaseHeaders;
