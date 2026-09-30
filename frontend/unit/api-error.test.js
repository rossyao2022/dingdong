import test from "node:test";
import assert from "node:assert/strict";

import { errorBody } from "../api.js";

/**
 * 5xx 的统一文案（T-024 的 S-06）：本地 `DEBUG=True` 时后端回的是 HTML 调试页，
 * `response.json()` 解析失败会回落成「服务返回了无法识别的响应。」——那是内部
 * 说法，不是给家长看的。这里盯住"5xx 一定用统一文案、4xx 仍用后端文案"。
 */
const SERVER_ERROR = "服务暂时不可用，请稍后再试。";

test("5xx 用统一文案，不带后端原始说法", () => {
  for (const status of [500, 502, 503, 504]) {
    const body = errorBody(status, { message: "服务返回了无法识别的响应。" });
    assert.equal(body.message, SERVER_ERROR, String(status));
  }
});

test("5xx 不把调试页文本或业务码当文案", () => {
  const body = errorBody(500, {
    message: "<html><body>IntegrityError at /api/v1/…</body></html>",
    code: "INTERNAL",
  });
  assert.equal(body.message, SERVER_ERROR);
  // code 仍可保留，供排查用；它不进用户可见文案。
  assert.equal(body.code, "INTERNAL");
});

test("4xx 仍用后端给的业务文案与 code", () => {
  const body = errorBody(422, {
    message: "这次复测建议已经处理过了，请刷新页面",
    code: "REASSESSMENT_ALREADY_ANSWERED",
  });
  assert.equal(body.message, "这次复测建议已经处理过了，请刷新页面");
  assert.equal(body.code, "REASSESSMENT_ALREADY_ANSWERED");
});

test("5xx 且响应体解析不出内容时也给同一句", () => {
  assert.equal(errorBody(500, undefined).message, SERVER_ERROR);
  assert.equal(errorBody(500, null).message, SERVER_ERROR);
});

test("429 保留 Retry-After，供发码倒计时使用", async () => {
  const { request } = await import("../api.js");
  const oldFetch = globalThis.fetch;
  const oldDocument = globalThis.document;
  globalThis.document = { cookie: "" };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "RATE_LIMITED",
        message: "发送短信验证码太频繁，稍后再重试。",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "93" },
      },
    );
  try {
    await assert.rejects(request("/auth/sms", { auth: false }), (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.code, "RATE_LIMITED");
      assert.equal(error.retryAfter, 93);
      return true;
    });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
