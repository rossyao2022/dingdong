import { test, expect } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { shell, confirmSyntheticBinding } from "./support.js";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4176";
const backend = process.env.E2E_BACKEND_URL || "http://127.0.0.1:8024";
const shots =
  process.env.E2E_SHOTS_DIR ||
  `../deploy/evidence/v${readFileSync("../VERSION", "utf8").trim()}/shots`;

async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const version = new URL(
        document.querySelector('script[src*="bootstrap.js"]').src,
      ).search;
      const api = await import("./api.js" + version);
      return api.request(path, options);
    },
    { path, options },
  );
}
async function login(page, route = "") {
  await page.goto(base + "/" + route);
  expect(
    (await (await page.request.get(base + "/api/v1/runtime")).json()).sms_mode,
  ).toBe("fixed_code");
  await page
    .getByLabel("手机号", { exact: true })
    .fill("139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  await page.locator("#send-code").click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
}
async function child(page, name = "家长体验合成儿童") {
  await page.getByLabel("姓名或称呼").fill(name);
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  return page.locator("#child-select").inputValue();
}
const companionURL = "https://www.dingdongrobo.top/dingdong/companion/main";
async function companionEntry(page, position) {
  const link = page.getByRole("link", {
    name: "进入 DINGDONG 天赋陪伴空间",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", companionURL);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(companionURL, { timeout: 30000 });
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  expect(new URL(popup.url()).search).toBe("");
  expect(new URL(popup.url()).hash).toBe("");
  console.log("Companion navigation verified:", position, popup.url());
  await popup.close();
}
async function shot(page, name) {
  await page.screenshot({
    path: `${shots}/${name}.png`,
    animations: "disabled",
    fullPage: true,
  });
}
async function push(page, weekly = 7) {
  const data = JSON.parse(
    readFileSync("../backend/tests/fixtures/prototype-insights.json", "utf8"),
  );
  data.growth.weekly_turns = weekly;
  data.companion.effective_turns = 24;
  data.companion.updated_at = new Date().toISOString();
  const payload = {
    event_type: "dingdong.prototype.companion_milestone",
    occurred_at: data.companion.updated_at,
    milestone: { interval: 3, completed_turns: 24 },
    data,
  };
  const raw = JSON.stringify(payload),
    stamp = String(Math.floor(Date.now() / 1000));
  const signature =
    "sha256=" +
    createHmac("sha256", "synthetic-only-signing-secret")
      .update(stamp + "." + raw)
      .digest("hex");
  const eventId = "ux-local-" + randomUUID();
  const response = await page.request.post(
    backend + "/api/dingdong/prototype/events",
    {
      data: raw,
      headers: {
        "Content-Type": "application/json",
        "X-Dingdong-Timestamp": stamp,
        "X-Dingdong-Signature": signature,
        "X-Dingdong-Event-ID": eventId,
        "X-Dingdong-Event-Type": payload.event_type,
      },
    },
  );
  expect(response.status()).toBe(201);
  await expect
    .poll(
      () =>
        shell(
          `from dingdong_ca.core.models import DingDongPushEvent; print(DingDongPushEvent.objects.get(event_id='${eventId}').processing_status)`,
        )
          .trim()
          .split("\n")
          .pop(),
      { timeout: 15000 },
    )
    .toBe("processed");
}
async function bindFixture(page, childId) {
  await page.goto(base + "/?nfc_token=SYNTHETIC-CLOSED-LOOP-NFC#settings");
  await expect(page.locator("#bind-robot-form")).toBeVisible();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "确认绑定", exact: true }).click();
  const row = await (await response).json();
  expect(row.bind_state).toBe("unbound");
  expect(childId).toMatch(/^[a-f0-9-]{36}$/);
  expect(row.ca_account_id).toMatch(/^ca_[a-zA-Z0-9]+$/);
  shell(
    `from django.conf import settings; from dingdong_ca.core.models import CaAccount; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; row=CaAccount.objects.get(child_id='${childId}',ca_account_id='${row.ca_account_id}',status='active'); assert row.prototype_demo; row.bind_state='bound'; row.save(update_fields=['bind_state'])`,
  );
  return row;
}

test("展会不能绕过登录建档，导航和CA默认探索保持", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "#exhibition");
  await expect(page.locator(".dd-report")).toHaveCount(0);
  await child(page);
  expect(page.url()).toContain("#explore");
  await expect(page.locator("#mobile-nav a")).toHaveCount(5);
  await page.goto(base + "/#reports");
  await expect(page.locator("#personal-assessments")).toBeVisible();
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await expect(page.locator("#main")).not.toContainText("还没有连接机器人记录");
  await expect(page.locator("#main")).not.toContainText("成长观察");
  await page.locator(".assessment-start summary").click();
  const catalog = await api(page, "/assessment-config");
  const eligible = catalog.questionnaires.filter((q) =>
    ["exploration", "assessment"].includes(q.purpose),
  );
  await expect(
    page.locator(".assessment-start [data-action=begin-bank]"),
  ).toHaveCount(eligible.length);
  await shot(page, "unbound-ca-reports-390");
  await page.goto(base + "/#companion");
  await expect(
    page.locator(".robot-entry [data-action=bind-robot]"),
  ).toBeVisible();
  await expect(
    page.locator("[data-action=companion-exploration]"),
  ).toBeVisible();
  await expect(page.locator("[data-action=style]")).toHaveCount(4);
  await expect(
    page.locator('.robot-entry a[href="#exhibition"]'),
  ).toBeVisible();
  await page.goto(base + "/#settings");
  await expect(page.locator('#main a[href="#companion"]')).toContainText(
    "我的 DingDong",
  );
  await expect(page.locator("[data-action=link-robot]")).toHaveCount(0);
});

test("独立展会全量报告、共享聊天、频率与成功访问记录，无个人绑定", async ({
  page,
}) => {
  await login(page);
  const id = await child(page);
  await push(page, 7);
  await push(page, 3);
  await push(page, 14);
  await push(page, 21);
  const visited = [];
  const reportRequests = [];
  page.on("request", (r) => {
    if (r.url().includes("/exhibition/report?")) reportRequests.push(r.url());
  });
  page.on("response", (r) => {
    if (r.url().endsWith("/exhibition/visits") && r.status() < 300)
      visited.push(r);
  });
  await page.goto(base + "/#exhibition");
  await expect(page.locator(".dd-report-comparison")).toBeVisible();
  await expect(page.locator(".dd-report")).toContainText("演示内容");
  await expect(
    page.getByRole("link", { name: "进入 DINGDONG 天赋陪伴空间", exact: true }),
  ).toBeVisible();
  expect(new URL(reportRequests[0]).searchParams.get("cached")).toBe("1");
  await companionEntry(page, "unbound-exhibition");
  await expect(page.locator(".dd-report-row")).toHaveCount(9);
  await expect.poll(() => visited.length).toBeGreaterThanOrEqual(2);
  expect((await api(page, `/children/${id}/ca-accounts`)).items).toHaveLength(
    0,
  );
  expect((await api(page, `/children/${id}/reports`)).items).toHaveLength(0);
  await page
    .locator('[data-action=dingdong-weekly-turns][data-value="3"]')
    .click();
  await expect(
    page.locator('[data-value="3"][data-action=dingdong-weekly-turns]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".dd-report-frequency")).toContainText(
    "不会修改机器人设置",
  );
  for (const weekly of [7, 14, 21]) {
    await page
      .locator(`[data-action=dingdong-weekly-turns][data-value="${weekly}"]`)
      .click();
    await expect(
      page.locator(
        `[data-action=dingdong-weekly-turns][data-value="${weekly}"]`,
      ),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".dd-report-comparison")).toBeVisible();
  }
  const refreshed = page.waitForResponse(
    (r) =>
      r.url().includes("/exhibition/report?") &&
      !new URL(r.url()).searchParams.has("cached"),
  );
  await page.locator("[data-action=dingdong-report-refresh]").click();
  expect((await refreshed).status()).toBe(200);
  await expect(page.locator(".dd-report-comparison")).toBeVisible();
  console.log(
    "Report cache first-read, 3/7/14/21 and explicit refresh verified",
  );
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await shot(page, `exhibition-report-${width}`);
  }
});

test("已绑定报告授权、聊天不依赖报告、切儿童与解绑立即恢复个人结果", async ({
  page,
}) => {
  await login(page);
  const id = await child(page);
  await push(page);
  await bindFixture(page, id);
  await page.reload();
  await expect(page.locator(".account-row")).toContainText("已绑定");
  await expect(
    page.getByRole("link", { name: "进入 DINGDONG 天赋陪伴空间", exact: true }),
  ).toBeVisible();
  await companionEntry(page, "bound-settings");
  await page.goto(base + "/#reports");
  await expect(page.locator("#dingdong-growth-report")).toContainText(
    "同意查看机器人记录",
  );
  await expect(page.locator("#personal-assessments")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "进入 DINGDONG 天赋陪伴空间", exact: true }),
  ).toBeVisible();
  await companionEntry(page, "bound-reports");
  await page.goto(base + "/#companion");
  await companionEntry(page, "bound-companion");
  const policy = await api(page, "/policies/current?purpose=dingdong_sync", {
    auth: false,
  });
  await api(page, `/children/${id}/consents`, {
    method: "POST",
    body: { request_id: randomUUID(), policy_version_id: policy.id },
  });
  await page.goto(base + "/#reports");
  await page.reload();
  await expect(
    page.locator("#dingdong-growth-report .dd-report-comparison"),
  ).toBeVisible();
  await expect(
    page.locator(".report-jumps [data-target=personal-assessments]"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "bound-full-report-390");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${shots}/ux-bound-report-390.png`,
    animations: "disabled",
    fullPage: false,
  });
  await page.goto(base + "/#settings");
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  const other = await child(page, "另一合成儿童");
  await page.goto(base + "/#reports");
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await page.locator("#child-select").selectOption(id);
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.goto(base + "/#settings");
  await page.locator("[data-action=retire-account]").click();
  await page.locator("[data-action=confirm-retire]").click();
  await expect(page.locator(".account-row")).toContainText("已归档");
  await page.goto(base + "/#reports");
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await expect(page.locator("#personal-assessments")).toBeVisible();
  expect(other).not.toBe(id);
});

test("换儿童后重新读取该孩子的机器人，换机不会归档上一儿童的机器人", async ({
  page,
}) => {
  await login(page);
  const childA = await child(page, "换机A合成儿童");
  const tokenA = "replacement-a-" + randomUUID(),
    tokenB = "replacement-b-" + randomUUID(),
    tokenC = "replacement-c-" + randomUUID();
  const accountA = await api(page, `/children/${childA}/ca-accounts`, {
    method: "POST",
    body: { request_id: randomUUID(), nfc_token: tokenA },
  });
  confirmSyntheticBinding(accountA);
  await page.goto(base + "/#settings");
  await expect(page.locator(".account-row")).toContainText(
    accountA.ca_account_id,
  );
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  const childB = await child(page, "换机B合成儿童");
  const accountB = await api(page, `/children/${childB}/ca-accounts`, {
    method: "POST",
    body: { request_id: randomUUID(), nfc_token: tokenB },
  });
  confirmSyntheticBinding(accountB);
  await page.locator("#child-select").selectOption(childA);
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.goto(base + "/#settings");
  await expect(page.locator(".account-row")).toContainText(
    accountA.ca_account_id,
  );
  // Keep the same document and memory: leaving A's cached robot panel must not leak it into B's replacement.
  await page.locator("#child-select").selectOption(childB);
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#settings";
  });
  await page.locator("[data-action=replace-robot]").click();
  await expect(page.locator("#replace-robot-form")).toBeVisible();
  await page.getByLabel("新机器人的凭据").fill(tokenC);
  await expect(page.locator("#replace-robot-form")).toBeVisible();
  await page.getByRole("button", { name: "确认换机", exact: true }).click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  const rowsA = (await api(page, `/children/${childA}/ca-accounts`)).items;
  const rowsB = (await api(page, `/children/${childB}/ca-accounts`)).items;
  expect(
    rowsA.find((row) => row.ca_account_id === accountA.ca_account_id).status,
  ).toBe("active");
  expect(
    rowsB.find((row) => row.ca_account_id === accountB.ca_account_id).status,
  ).toBe("retired");
  expect(rowsB.filter((row) => row.status === "active")).toHaveLength(1);
});
