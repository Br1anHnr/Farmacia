export type ChatwootConversation = {
  id: number;
  account_id: number;
  inbox_id: number;
  labels?: string[];
  assignee_id?: number | null;
  assignee?: { id?: number } | null;
  meta?: {
    sender?: { id?: number; name?: string; phone_number?: string };
    assignee?: { id?: number } | null;
  };
  inbox?: { id?: number; name?: string; channel_type?: string };
};

export function chatwootAssigneeId(conversation: ChatwootConversation) {
  const value =
    conversation.assignee_id ??
    conversation.assignee?.id ??
    conversation.meta?.assignee?.id ??
    null;
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

export type ChatwootAgent = {
  id: number;
  account_id: number;
  email: string;
  name?: string;
  available_name?: string;
  confirmed?: boolean;
  role?: string;
};

export class ChatwootError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function configuration(accountId: number) {
  const baseUrl = process.env.CHATWOOT_BASE_URL?.replace(/\/$/, "");
  const token = process.env.CHATWOOT_API_TOKEN;
  const configuredAccount = Number(process.env.CHATWOOT_ACCOUNT_ID);
  if (!baseUrl || !token || !Number.isSafeInteger(configuredAccount)) {
    throw new ChatwootError("CHATWOOT_CONFIGURATION_REQUIRED", 503);
  }
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || accountId !== configuredAccount) {
    throw new ChatwootError("CHATWOOT_ACCOUNT_DENIED", 403);
  }
  return { baseUrl, token };
}

async function request<T>(
  accountId: number,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { baseUrl, token } = configuration(accountId);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/accounts/${accountId}${path}`, {
      ...init,
      headers: {
        api_access_token: token,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
  } catch {
    throw new ChatwootError("CHATWOOT_UNAVAILABLE", 502);
  }
  if (!response.ok) {
    throw new ChatwootError(
      response.status === 404 ? "CHATWOOT_CONVERSATION_NOT_FOUND" : "CHATWOOT_REQUEST_FAILED",
      response.status === 404 ? 404 : 502,
    );
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export async function getChatwootConversation(accountId: number, conversationId: number) {
  const conversation = await request<ChatwootConversation>(
    accountId,
    `/conversations/${conversationId}`,
  );
  if (conversation.id !== conversationId || conversation.account_id !== accountId) {
    throw new ChatwootError("CHATWOOT_IDENTITY_MISMATCH", 502);
  }
  return conversation;
}

export async function listChatwootInboxAgents(accountId: number, inboxId: number) {
  const result = await request<{ payload?: ChatwootAgent[] } | ChatwootAgent[]>(
    accountId,
    `/inbox_members/${inboxId}`,
  );
  return Array.isArray(result) ? result : result.payload || [];
}

export async function listChatwootAccountAgents(accountId: number) {
  const result = await request<{ payload?: ChatwootAgent[] } | ChatwootAgent[]>(
    accountId,
    "/agents",
  );
  return Array.isArray(result) ? result : result.payload || [];
}

export async function assignChatwootConversation(
  accountId: number,
  conversationId: number,
  assigneeId: number,
) {
  return setChatwootConversationAssignee(accountId, conversationId, assigneeId);
}

export async function setChatwootConversationAssignee(
  accountId: number,
  conversationId: number,
  assigneeId: number | null,
) {
  await request<ChatwootAgent | null>(
    accountId,
    `/conversations/${conversationId}/assignments`,
    { method: "POST", body: JSON.stringify({ assignee_id: assigneeId }) },
  );
  const confirmed = await getChatwootConversation(accountId, conversationId);
  if (chatwootAssigneeId(confirmed) !== assigneeId) {
    throw new ChatwootError("CHATWOOT_ASSIGNMENT_NOT_CONFIRMED", 502);
  }
  return confirmed;
}

export async function getChatwootConversationLabels(
  accountId: number,
  conversationId: number,
) {
  const result = await request<{ payload?: string[] } | string[]>(
    accountId,
    `/conversations/${conversationId}/labels`,
  );
  return Array.isArray(result) ? result : result.payload || [];
}

export async function replaceChatwootConversationLabels(
  accountId: number,
  conversationId: number,
  labels: string[],
) {
  const result = await request<{ payload?: string[] } | string[]>(
    accountId,
    `/conversations/${conversationId}/labels`,
    { method: "POST", body: JSON.stringify({ labels }) },
  );
  const confirmed = Array.isArray(result) ? result : result.payload || [];
  if (confirmed.length !== labels.length || labels.some((label) => !confirmed.includes(label))) {
    throw new ChatwootError("CHATWOOT_LABELS_NOT_CONFIRMED", 502);
  }
  return confirmed;
}

export async function createChatwootPrivateNote(
  accountId: number,
  conversationId: number,
  content: string,
) {
  return request<{ id: number }>(accountId, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, private: true }),
  });
}

export function attendantLabel(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!normalized) throw new ChatwootError("INVALID_AGENT_LABEL", 400);
  return `atendente-${normalized}`;
}

export function conversationAccountId(request: Request) {
  const value = new URL(request.url).searchParams.get("account_id");
  const accountId = Number(value);
  if (!value || !Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new ChatwootError("INVALID_CHATWOOT_ACCOUNT_ID", 400);
  }
  return accountId;
}

export function chatwootErrorResponse(error: unknown) {
  if (error instanceof ChatwootError) {
    return { error: error.message, status: error.status };
  }
  return { error: "CHATWOOT_UNAVAILABLE", status: 502 };
}
