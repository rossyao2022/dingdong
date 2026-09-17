import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_STATUS,
  BIND_STATE,
  activeAccount,
  readNfcToken,
  readParam,
  replaceFlowNeeded,
  retiredAccounts,
  stripBindingParams,
} from "../ca-link.js";

const BASE = "https://ca.example.com";

test("凭据能从查询串里读出来", () => {
  assert.equal(
    readNfcToken(`${BASE}/?nfc_token=NDEF-abc.123#settings`),
    "NDEF-abc.123",
  );
});

test("凭据能从 hash 参数里读出来（NFC 标签常这么写）", () => {
  assert.equal(
    readNfcToken(`${BASE}/#settings?nfc_token=NDEF-abc.123`),
    "NDEF-abc.123",
  );
});

test("查询串优先于 hash，两者都有时取查询串", () => {
  assert.equal(
    readNfcToken(`${BASE}/?nfc_token=first#settings?nfc_token=second`),
    "first",
  );
});

test("裸 + 不当空格：token 是不透明字符串，不能改写它的字节", () => {
  // URLSearchParams 会把它读成 "a b"，那会让后端换到另一把凭据上。
  assert.equal(readNfcToken(`${BASE}/?nfc_token=a+b`), "a+b");
  assert.equal(readNfcToken(`${BASE}/?nfc_token=a%2Bb`), "a+b");
  assert.equal(readNfcToken(`${BASE}/?nfc_token=a%20b`), "a b");
});

test("没有凭据就是空串，不猜也不报错", () => {
  assert.equal(readNfcToken(`${BASE}/#settings`), "");
  assert.equal(readNfcToken(`${BASE}/`), "");
  assert.equal(readNfcToken(`${BASE}/?nfc_token=`), "");
  assert.equal(readNfcToken(""), "");
});

test("同名参数取第一个", () => {
  assert.equal(readNfcToken(`${BASE}/?nfc_token=a&nfc_token=b`), "a");
});

test("机器人标识是独立参数，不影响取凭据", () => {
  const href = `${BASE}/#settings?robot_ref=SN-001&nfc_token=tok`;
  assert.equal(readParam(href, "robot_ref"), "SN-001");
  assert.equal(readNfcToken(href), "tok");
  assert.equal(readParam(href, "missing"), "");
});

test("摘掉凭据后，hash 路由与其他参数都还在", () => {
  assert.equal(
    stripBindingParams(`${BASE}/?nfc_token=tok#settings`),
    "/#settings",
  );
  assert.equal(
    stripBindingParams(`${BASE}/?nfc_token=tok&invite=1#settings`),
    "/?invite=1#settings",
  );
  assert.equal(
    stripBindingParams(`${BASE}/#settings?nfc_token=tok`),
    "/#settings",
  );
  assert.equal(
    stripBindingParams(`${BASE}/#settings?nfc_token=tok&tab=consent`),
    "/#settings?tab=consent",
  );
  assert.equal(
    stripBindingParams(`${BASE}/#settings?tab=consent&nfc_token=tok`),
    "/#settings?tab=consent",
  );
});

test("摘掉机器人标识，凭据一并不留", () => {
  assert.equal(
    stripBindingParams(`${BASE}/#settings?robot_ref=SN-001&nfc_token=tok`),
    "/#settings",
  );
});

test("没有凭据时，地址原样不动（幂等）", () => {
  const href = `${BASE}/#journey`;
  assert.equal(stripBindingParams(href), "/#journey");
});

test("换机信号只认服务端那一个错误码", () => {
  assert.equal(
    replaceFlowNeeded({ status: 409, code: "ACCOUNT_REPLACEMENT_REQUIRED" }),
    true,
  );
  assert.equal(
    replaceFlowNeeded({ status: 409, code: "IDEMPOTENCY_CONFLICT" }),
    false,
  );
  assert.equal(
    replaceFlowNeeded({ status: 500, code: "ACCOUNT_REPLACEMENT_REQUIRED" }),
    false,
  );
  assert.equal(replaceFlowNeeded(undefined), false);
});

test("账户拆分：活跃唯一，归档可多条", () => {
  const rows = [
    { ca_account_id: "ca_2", status: "retired" },
    { ca_account_id: "ca_1", status: "retired" },
    { ca_account_id: "ca_3", status: "active" },
  ];
  assert.equal(activeAccount(rows).ca_account_id, "ca_3");
  assert.deepEqual(
    retiredAccounts(rows).map((r) => r.ca_account_id),
    ["ca_2", "ca_1"],
  );
  assert.equal(activeAccount([]), null);
  assert.equal(activeAccount(undefined), null);
});

test("状态词与运营后台用同一套说法，且两个维度分开", () => {
  assert.equal(ACCOUNT_STATUS.active, "使用中");
  assert.equal(ACCOUNT_STATUS.retired, "已归档");
  assert.equal(BIND_STATE.unbound, "待接通");
  assert.equal(BIND_STATE.bound, "已绑定");
});
