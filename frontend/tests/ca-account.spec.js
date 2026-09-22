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

async function login(page, number = phone(), url = "/") {
  await page.goto(url);
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

test("绑定成功后停在账户页并高亮新号，标签不带路由也不跳回探索页", async ({
  page,
}) => {
  await login(page);
  await child(page, "落点合成儿童");
  const mine = token("landing");

  // 真实机器人标签就是裸链接：只有凭据，没有 hash 路由。
  await page.goto(`/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = issues(page);
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  const created = await (await pending).json();

  // 绑定成功必须落在「账户与关联」，家长不用自己找回去。
  expect(new URL(page.url()).hash).toBe("#settings");
  await expect(page.getByRole("heading", { name: "机器人账户" })).toBeVisible();

  // 新号高亮，并且高亮的正是刚生成的那个号。
  const fresh = page.locator(".account-row.is-new");
  await expect(fresh).toHaveCount(1);
  await expect(fresh.locator(".inline-code")).toHaveText(created.ca_account_id);
  await expect(fresh).toContainText("刚生成");
  await expect(page.locator(".account-row")).toHaveCount(1);

  // 成功提示：号已生成 + 接通后才开始同步，两件事都要说清。
  await expect(page.locator("#toast")).toContainText("账户号已建立");
  const panel = page.locator(".panel", { hasText: "机器人账户" });
  await expect(panel).toContainText("账户号已经生成");
  await expect(panel).toContainText("数据不会开始同步");

  // 高亮是"刚生成"的一次性提示：重渲染之后不再冒充新号。
  await page.reload();
  await expect(page.locator(".account-row")).toHaveCount(1);
  await expect(page.locator(".account-row.is-new")).toHaveCount(0);
  await expect(page.locator(".account-row")).toContainText(
    created.ca_account_id,
  );
});

test("新会话从标签进来：登录建档案后绑定，同样落在账户页", async ({ page }) => {
  const mine = token("fresh");
  // 凭据是在登录之前就取到的，登录、建档案这一路都不能丢。
  await login(page, phone(), `/?nfc_token=${mine}`);
  await child(page, "新会话合成儿童");

  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = issues(page);
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  const account = await (await pending).json();

  // 建档案后默认落点是探索页，绑定成功必须改落到「账户与关联」。
  expect(new URL(page.url()).hash).toBe("#settings");
  await expect(page.locator(".account-row.is-new")).toContainText(
    account.ca_account_id,
  );
});

test("手填绑定：空凭据就地提示，对话框不关", async ({ page }) => {
  await login(page);
  await child(page, "手填合成儿童");
  // 建档后应用会落到探索页，等它稳定再点导航，避免和建档后的自动跳转赛跑。
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
  await page.locator("nav").getByRole("link", { name: "账户与关联" }).click();
  await expect(page.getByRole("heading", { name: "机器人账户" })).toBeVisible();

  const panel = page.locator(".panel", { hasText: "机器人账户" });
  await panel.getByRole("button", { name: "绑定机器人" }).click();

  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  // 操作指引与格式/长度提示都在弹窗里。
  await expect(dialog).toContainText("碰一下机器人上的标签");
  await expect(dialog).toContainText("2048");

  await dialog.getByRole("button", { name: "确认绑定" }).click();

  const err = dialog.locator(".form-error");
  await expect(err).toBeVisible();
  await expect(err).not.toBeEmpty();
  await expect(err).toContainText("请先填写机器人凭据");
  // 对话框不关，家长补上凭据即可继续。
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();

  // 进「账户与关联」会滚动到该面板，落点取决于滚动动画的时序；弹窗是浮层，
  // 背景滚动位置只影响这张图的背景。固定到页首，避免同一份代码两次运行出不同的图。
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "../.trellis/tasks/T-008/shots/empty-credential.png",
  });
});

test("绑定落点截图：桌面与 390×844", async ({ page }) => {
  await login(page);
  await child(page, "截图合成儿童");
  const mine = token("shot");
  await page.goto(`/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = issues(page);
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  const created = await (await pending).json();

  await expect(page.locator(".account-row.is-new")).toContainText(
    created.ca_account_id,
  );
  // 滚动到高亮的那一行再截图：否则高亮落在折叠线以下，截图证明不了什么。
  // 再往下推一点，避开固定在底部的 toast。
  await page.locator(".account-row.is-new").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 150));
  await page.screenshot({ path: "docs/t007-bind-landed-desktop.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".account-row.is-new").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/t007-bind-landed-mobile.png" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
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
