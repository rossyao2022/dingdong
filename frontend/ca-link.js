/**
 * 机器人绑定（CA 账户）在浏览器侧的纯函数。
 *
 * 单独成文件只有一个理由：这几条规则要被单元测试盯住。尤其是
 * 「凭据用完就从地址栏摘掉」——NFC token 留在 URL 里，就会被浏览历史、
 * 截图、聊天里分享的链接一起带走。
 *
 * 这里**不用 `URLSearchParams`**：它按表单语义解析，会把裸 `+` 当成空格。
 * `+` 在查询串里是合法字符，token 又是不透明字符串，我们无从知道它的字母表，
 * 所以查询串按原样切分、只做百分号解码。
 */

export const ACCOUNT_STATUS = { active: "使用中", retired: "已归档" };
export const BIND_STATE = { unbound: "待接通", bound: "已绑定" };

/** 绑定请求会带进来的参数：凭据本身，以及（若对方提供）机器人标识。 */
const BINDING_PARAMS = ["nfc_token", "robot_ref"];

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** 从 `a=1&b=2` 里取某个键的值；键不存在返回空串。 */
function paramValue(source, key) {
  for (const part of String(source || "").split("&")) {
    if (!part) continue;
    const mark = part.indexOf("=");
    const name = mark < 0 ? part : part.slice(0, mark);
    if (safeDecode(name) !== key) continue;
    return safeDecode(mark < 0 ? "" : part.slice(mark + 1));
  }
  return "";
}

/** 从 `a=1&b=2` 里删掉若干键，其余原样保留（含编码方式与顺序）。 */
function dropParams(source, keys) {
  return String(source || "")
    .split("&")
    .filter((part) => {
      if (!part) return false;
      const mark = part.indexOf("=");
      return !keys.includes(safeDecode(mark < 0 ? part : part.slice(0, mark)));
    })
    .join("&");
}

function hashQuery(rawHash) {
  const mark = rawHash.indexOf("?");
  return mark < 0
    ? { head: rawHash, tail: "" }
    : { head: rawHash.slice(0, mark), tail: rawHash.slice(mark + 1) };
}

/**
 * 从地址里取参数。机器人标签把 URL 写成哪种形状都认：查询串
 * （`/?nfc_token=…`）或 hash 参数（`/#settings?nfc_token=…`）。
 * 两种都没有就返回空串——绝不猜。
 */
export function readParam(href, key) {
  let url;
  try {
    url = new URL(href, "http://localhost");
  } catch {
    return "";
  }
  const direct = paramValue(url.search.replace(/^\?/, ""), key);
  if (direct) return direct;
  const rawHash = url.hash.replace(/^#/, "");
  return paramValue(hashQuery(rawHash).tail, key);
}

export const readNfcToken = (href) => readParam(href, "nfc_token");

/**
 * 去掉地址里的绑定凭据，其余部分（尤其是 hash 路由）原样保留。
 * 返回值是相对路径，可直接交给 `history.replaceState`。
 */
export function stripBindingParams(href) {
  const url = new URL(href, "http://localhost");
  const query = dropParams(url.search.replace(/^\?/, ""), BINDING_PARAMS);
  const { head, tail } = hashQuery(url.hash.replace(/^#/, ""));
  const rest = tail ? dropParams(tail, BINDING_PARAMS) : "";
  const hash = rest ? head + "?" + rest : head;
  return url.pathname + (query ? "?" + query : "") + (hash ? "#" + hash : "");
}

/**
 * 服务端返回 `ACCOUNT_REPLACEMENT_REQUIRED` 表示「这个孩子已有活跃账户，
 * 而且是另一台机器人」。这不是失败，是要家长先确认换机代价，再走两步流程。
 */
export function replaceFlowNeeded(err) {
  return (
    Boolean(err) &&
    err.status === 409 &&
    err.code === "ACCOUNT_REPLACEMENT_REQUIRED"
  );
}

export const activeAccount = (rows) =>
  (rows || []).find((a) => a.status === "active") || null;

export const retiredAccounts = (rows) =>
  (rows || []).filter((a) => a.status !== "active");
