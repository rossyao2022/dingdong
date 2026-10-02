// randomUUID is HTTPS-only; getRandomValues also works on public HTTP origins.
export function createRequestId(source = globalThis.crypto) {
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let access = "";
let refreshInFlight;
let epoch = 0;
let authQueue = Promise.resolve();
// Cookies are shared by tabs: finish each rotation before another tab reads it.
// The local queue also protects login/logout on browsers without Web Locks.
function withAuthLock(operation) {
  const locks = globalThis.navigator?.locks;
  if (typeof locks?.request === "function")
    return locks.request("dingdong-auth-session", operation);
  const pending = authQueue.then(operation);
  authQueue = pending.catch(() => {});
  return pending;
}
function requireEpoch(current) {
  if (current !== epoch)
    // Cancellation belongs to the old identity; 401 would log the new user out.
    throw new APIError(0, {
      code: "AUTH_STATE_CHANGED",
      message: "登录状态已改变。",
    });
}
// 5xx 一律给这一句：后端出错时回的可能是 HTML 调试页（本地 DEBUG=True），
// 解析失败会落到「无法识别的响应」这种内部说法，不是给家长看的文案。
const SERVER_ERROR_MESSAGE = "服务暂时不可用，请稍后再试。";
/**
 * 失败响应的错误体。5xx 用统一文案，不带后端原始说法（可能是 HTML 调试页解析出的
 * 「无法识别的响应」）；4xx 仍用后端给的业务文案与 code。
 */
export function errorBody(status, data) {
  if (status >= 500) return { code: data?.code, message: SERVER_ERROR_MESSAGE };
  return data;
}
export class APIError extends Error {
  constructor(status, body, retryAfter = 0) {
    super(body.message || "请求失败，请稍后重试。");
    this.status = status;
    this.code = body.code;
    this.fields = body.field_errors || [];
    this.retryAfter = retryAfter;
  }
}
export function clearAuth() {
  epoch++;
  access = "";
  refreshInFlight = undefined;
}
const csrf = () =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrftoken="))
    ?.split("=")[1];
export async function request(
  path,
  { method = "GET", body, auth = true, retry = true } = {},
) {
  const current = epoch;
  const headers = {};
  if (access && auth) headers.Authorization = "Bearer " + access;
  if (csrf()) headers["X-CSRFToken"] = csrf();
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch("/api/v1" + path, {
      method,
      headers,
      credentials: "same-origin",
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new APIError(0, {
      code: "NETWORK_ERROR",
      message: "连接中断，操作结果可能尚未返回。请查询最新状态或重试。",
    });
  } finally {
    clearTimeout(timer);
  }
  const data =
    response.status === 204
      ? null
      : await response
          .json()
          .catch(() => ({ message: "服务返回了无法识别的响应。" }));
  if (response.status === 401 && auth && retry) {
    // A delayed response must not replay the old user's operation after a switch.
    requireEpoch(current);
    await refresh();
    requireEpoch(current);
    return request(path, { method, body, auth, retry: false });
  }
  if (response.status >= 500)
    throw new APIError(response.status, errorBody(response.status, data));
  if (!response.ok)
    throw new APIError(
      response.status,
      data,
      Number(response.headers.get("Retry-After")) || 0,
    );
  return data;
}
export async function refresh() {
  if (refreshInFlight) return refreshInFlight;
  const current = epoch;
  const pending = withAuthLock(async () => {
    requireEpoch(current);
    if (!csrf()) await request("/auth/csrf", { auth: false });
    requireEpoch(current);
    const r = await request("/auth/refresh", {
      method: "POST",
      body: {},
      auth: false,
    });
    requireEpoch(current);
    access = r.access_token;
  });
  refreshInFlight = pending;
  try {
    await pending;
  } catch (e) {
    if (current === epoch && [401, 403].includes(e.status)) access = "";
    throw e;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = undefined;
  }
}
export async function login(challenge, code) {
  clearAuth();
  const current = epoch;
  return withAuthLock(async () => {
    requireEpoch(current);
    const r = await request("/auth/login", {
      method: "POST",
      auth: false,
      body: { challenge_id: challenge, code },
    });
    requireEpoch(current);
    access = r.access_token;
    return r.user;
  });
}
export async function logout() {
  // Invalidate in-memory results now, then revoke the cookie after any rotation.
  clearAuth();
  await withAuthLock(() =>
    request("/auth/logout", { method: "POST", auth: false, body: {} }),
  );
}
export async function all(path) {
  const items = [];
  let cursor;
  do {
    const page = await request(
      path +
        (path.includes("?") ? "&" : "?") +
        "page_size=100" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    );
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return items;
}
