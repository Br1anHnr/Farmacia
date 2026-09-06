function required(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name}_REQUIRED`);
  }
  return value.trim();
}

function withoutCredentialOverrides(extraHeaders = {}) {
  for (const name of Object.keys(extraHeaders)) {
    if (["apikey", "authorization"].includes(name.toLowerCase())) {
      throw new Error("SUPABASE_CREDENTIAL_HEADER_OVERRIDE_DENIED");
    }
  }
  return extraHeaders;
}

function publishableKey(value) {
  const key = required(value, "SUPABASE_PUBLISHABLE_KEY");
  if (/^sb_secret_/i.test(key)) {
    throw new Error("SUPABASE_SECRET_KEY_NOT_PUBLISHABLE");
  }
  return key;
}

function userJwt(value) {
  const token = required(value, "SUPABASE_USER_JWT");
  if (/^sb_/i.test(token)) {
    throw new Error("SUPABASE_API_KEY_NOT_ALLOWED_AS_BEARER");
  }
  return token;
}

export function publicSupabaseHeaders(publishable, extraHeaders = {}) {
  return {
    ...withoutCredentialOverrides(extraHeaders),
    apikey: publishableKey(publishable),
  };
}

export function userSupabaseHeaders(publishable, jwt, extraHeaders = {}) {
  return {
    ...withoutCredentialOverrides(extraHeaders),
    apikey: publishableKey(publishable),
    Authorization: `Bearer ${userJwt(jwt)}`,
  };
}

export function adminSupabaseHeaders(secret, extraHeaders = {}) {
  const key = required(secret, "SUPABASE_SECRET_KEY");
  if (/^sb_publishable_/i.test(key)) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY_NOT_ADMIN");
  }
  return {
    ...withoutCredentialOverrides(extraHeaders),
    apikey: key,
  };
}
