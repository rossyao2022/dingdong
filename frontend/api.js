// randomUUID is HTTPS-only; getRandomValues also works on public HTTP origins.
export function createRequestId(source = globalThis.crypto) {
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let access = "";
let refreshInFlight;
let epoch = 0;
export class APIError extends Error {
  constructor(status, body) {
    super(body.message || "请求失败，请稍后重试。");
    this.status = status;
    this.code = body.code;
    this.fields = body.field_errors || [];
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
    await refresh();
    return request(path, { method, body, auth, retry: false });
  }
  if (!response.ok) throw new APIError(response.status, data);
  return data;
}
export async function refresh() {
  if (refreshInFlight) return refreshInFlight;
  const current = epoch;
  const pending = (async () => {
    if (!csrf()) await request("/auth/csrf", { auth: false });
    const r = await request("/auth/refresh", {
      method: "POST",
      body: {},
      auth: false,
    });
    if (current !== epoch)
      throw new APIError(401, { message: "登录状态已改变。" });
    access = r.access_token;
  })();
  refreshInFlight = pending;
  try {
    await pending;
  } catch (e) {
    if (current === epoch) access = "";
    throw e;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = undefined;
  }
}
export async function login(challenge, code) {
  const r = await request("/auth/login", {
    method: "POST",
    auth: false,
    body: { challenge_id: challenge, code },
  });
  access = r.access_token;
  return r.user;
}
export async function logout() {
  await request("/auth/logout", { method: "POST", auth: false, body: {} });
  clearAuth();
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
