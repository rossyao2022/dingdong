import { test, expect } from "@playwright/test";

/**
 * 家长端「机器人账户（CA 账户）」的真实浏览器闭环。
 *
 * 覆盖三件容易做假的事：
 *  1. NFC 凭据从地址栏摘掉（不留历史记录、不随截图带出去）
 *  2. 新号如实显示「待接通」，不假装已绑定
 *  3. 换机是两步：先归档旧号，再发新号，且弹窗讲清代价
 */
const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
// 每次运行都换一批凭据：数据库里对"活跃账户"的机器人凭据是全局唯一的，
// 固定串会让第二轮跑的时候撞上第一轮留下的活跃号（那是设计使然，不是缺陷）。
const token = (label) =>
  `e2e-${label}-${Math.random().toString(16).slice(2, 10)}`;
const ACCOUNT = /^ca_[0-9A-HJKMNP-TV-Z]{26}$/;
const issues = (page) =>
  page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );

async function login(page, number = phone()) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
}
async function child(page, name) {
  await page.getByLabel("姓名或称呼").fill(name);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  return (await (await response).json()).id;
}
/** 模拟家长再贴一次机器人标签：带着凭据进站，确认绑定。 */
async function tapTag(page, token) {
  await page.goto(`/?nfc_token=${token}#settings`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(token);
  const response = issues(page);
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  return await response;
}

test("NFC 承接：凭据不在地址栏留下，新号如实显示待接通", async ({ page }) => {
  await login(page);
  await child(page, "绑定合成儿童");
  const mine = token("single");
  await page.goto(`/?nfc_token=${mine}#settings`);

  // 绑定弹窗是自动弹出的，家长不必自己找入口。
  await expect(page.locator("#dialog")).toBeVisible();
  // 凭据已经从地址栏摘掉，但路由还在。
  expect(new URL(page.url()).searchParams.get("nfc_token")).toBeNull();
  expect(new URL(page.url()).hash).toBe("#settings");

  const dialog = page.locator("#dialog");
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = issues(page);
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const created = await response.json();
  expect(created.ca_account_id).toMatch(ACCOUNT);
  expect(created.status).toBe("active");
  // 对方没确认接通之前不许显示"已绑定"。
  expect(created.bind_state).toBe("unbound");
  // 接口只回短指纹，不回 token 原文。
  expect(JSON.stringify(created)).not.toContain(mine);

  const row = page.locator(".account-row").first();
  await expect(row.locator(".inline-code")).toHaveText(ACCOUNT);
  await expect(row).toContainText("使用中");
  await expect(row).toContainText("待接通");
  await expect(row).not.toContainText("已绑定");
  await expect(page.locator(".panel", { hasText: "机器人账户" })).toContainText(
    "机器人还没有确认接通",
  );
});

test("同一台机器人再次绑定复用同一个号，不换号", async ({ page }) => {
  await login(page);
  await child(page, "复用合成儿童");
  const shared = token("reuse");
  const first = await (await tapTag(page, shared)).json();

  const again = await (await tapTag(page, shared)).json();

  expect(again.ca_account_id).toBe(first.ca_account_id);
  await expect(page.locator(".account-row")).toHaveCount(1);
});

test("换机：确认弹窗讲清代价，旧号归档可查，新号重新开始", async ({ page }) => {
  await login(page);
  await child(page, "换机合成儿童");
  const oldToken = token("old");
  const old = await (await tapTag(page, oldToken)).json();
  const newToken = token("new");

  // 拿另一台机器人的凭据再绑一次：服务端回 409，界面必须自己转成"换机"流程，
  // 而不是丢一句报错让家长猜。
  await page.goto(`/?nfc_token=${newToken}#settings`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "确认绑定" }).click();

  await expect(
    dialog.getByRole("heading", { name: "换一台机器人" }),
  ).toBeVisible();
  await expect(dialog).toContainText("成长周期和阶段对比不会延续到新号");
  await expect(dialog).toContainText(old.ca_account_id);

  const retired = page.waitForResponse(
    (r) => r.url().endsWith("/retire") && r.request().method() === "POST",
  );
  const pending = issues(page);
  await dialog.getByRole("button", { name: "确认换机并归档旧号" }).click();
  expect((await retired).status()).toBe(200);
  const now = await (await pending).json();

  expect(now.ca_account_id).toMatch(ACCOUNT);
  expect(now.ca_account_id).not.toBe(old.ca_account_id);
  await expect(page.locator(".account-row")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "上一台机器的账户" }),
  ).toBeVisible();
  const archived = page.locator(".account-row").nth(1);
  await expect(archived.locator(".inline-code")).toHaveText(old.ca_account_id);
  await expect(archived).toContainText("已归档");
  await expect(archived).not.toContainText("待接通");
});

test("窄屏下账户号不撑破页面", async ({ page }) => {
  // 号码是 29 位定长串，最容易在 390px 上把卡片撑出横向滚动条。
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await child(page, "窄屏合成儿童");
  const account = await (await tapTag(page, token("mobile"))).json();

  const row = page.locator(".account-row").first();
  await expect(row.locator(".inline-code")).toHaveText(account.ca_account_id);
  await expect(row).toContainText("待接通");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
