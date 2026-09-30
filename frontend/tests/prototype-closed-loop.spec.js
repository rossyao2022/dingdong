import { test, expect } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { shell } from "./support.js";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4175";
const shots = "../deploy/evidence/v0.3.22/shots";
async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const api = await import("./api.js");
      return api.request(path, options);
    },
    { path, options },
  );
}
async function login(page, name = "闭环合成儿童") {
  await page.goto(base);
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
  await page.getByLabel("姓名或称呼").fill(name);
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  return page.locator("#child-select").inputValue();
}
async function shot(page, name) {
  await expect(page.locator("#toast.show")).toHaveCount(0, { timeout: 10000 });
  await page.screenshot({
    path: `${shots}/${name}.png`,
    animations: "disabled",
  });
}
async function bind(page, token) {
  await page.goto(
    base + "/?nfc_token=" + encodeURIComponent(token) + "#settings",
  );
  await expect(page.locator("#bind-robot-form")).toBeVisible();
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "确认绑定", exact: true }).click();
  return pending;
}
test("真实同一机器人第二儿童占用不误导刷新，原家长解除后可新绑", async ({
  page,
}) => {
  const childA = await login(page);
  const token = "closed-loop-" + Date.now();
  const first = await (await bind(page, token)).json();
  await expect(page.locator(".account-row")).toHaveCount(1);
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("另一合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  const childB = await page.locator("#child-select").inputValue();
  const conflict = await bind(page, token);
  expect(conflict.status()).toBe(409);
  await expect(page.locator("#dialog .form-error")).toContainText(
    "机器人已被其他孩子绑定，请原绑定家长先解绑，再重新绑定。",
  );
  await expect(page.locator("#dialog [data-action=refresh]")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "occupied-robot-390");
  await page.getByRole("button", { name: "关闭对话框", exact: true }).click();
  await page.locator("#child-select").selectOption(childA);
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.goto(base + "/#settings");
  await expect(page.locator(".account-row")).toContainText(first.ca_account_id);
  await page.locator("[data-action=retire-account]").click();
  await page.locator("[data-action=confirm-retire]").click();
  await expect(page.locator(".account-row")).toContainText("已归档");
  await page.locator("#child-select").selectOption(childB);
  await expect(page.locator(".six-islands")).toBeVisible();
  const second = await (await bind(page, token)).json();
  expect(second.ca_account_id).not.toBe(first.ca_account_id);
  expect(second.bind_state).toBe("unbound");
  expect(
    (await api(page, `/children/${childA}/ca-accounts`)).items[0].status,
  ).toBe("retired");
});
test("真实儿童资料revision冲突仍能载入最新并重新保存", async ({ page }) => {
  const child = await login(page, "旧版称呼");
  await page.goto(base + "/#settings");
  await page.getByRole("button", { name: "编辑档案", exact: true }).click();
  await page.locator("#edit-child-form [name=name]").fill("本页修改");
  const row = await api(page, "/children/" + child);
  await api(page, "/children/" + child, {
    method: "PATCH",
    body: {
      name: "另一页面保存",
      gender: row.gender,
      birth_date: row.birth_date,
      revision: row.revision,
    },
  });
  const pending = page.waitForResponse(
    (r) =>
      r.url().endsWith("/children/" + child) &&
      r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  const conflict = await pending;
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).code).toBe("EDIT_CONFLICT");
  await expect(page.locator("#child-conflict")).toBeVisible();
  await page.locator("[data-action=child-conflict-load]").click();
  await page.locator("[data-action=child-conflict-load-confirm]").click();
  await expect(page.locator("#edit-child-form [name=name]")).toHaveValue(
    "另一页面保存",
  );
  await page.locator("#edit-child-form [name=name]").fill("最终修改");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect((await api(page, "/children/" + child)).name).toBe("最终修改");
});
test("普通新用户无设备无预置输入，真实22题经Worker生成CA报告", async ({
  page,
}) => {
  test.setTimeout(240000);
  const child = await login(page, "新家长报告合成儿童");
  await page.goto(base + "/#reports");
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await expect(
    page.locator("#consent-check:visible, #answer-form:visible"),
  ).toBeVisible();
  if (await page.locator("#consent-check").isVisible()) {
    await page.getByLabel("我已阅读并同意本次测评用途").check();
    await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  }
  for (let i = 1; i <= 22; i++) {
    await expect(
      page.getByText(new RegExp("第 " + i + " / 22 题")),
    ).toBeVisible();
    await page.getByRole("radio").first().check();
    await page
      .getByRole("button", {
        name: i === 22 ? "保存并完成" : "保存并下一题",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "生成演示报告", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "生成演示报告", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看初始报告", exact: true }),
  ).toBeVisible({ timeout: 180000 });
  await page.getByRole("button", { name: "查看初始报告", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "初始报告", exact: true }),
  ).toBeVisible();
  const reports = await api(page, `/children/${child}/reports`);
  expect(reports.items.length).toBeGreaterThan(0);
  const generated = await api(page, "/reports/" + reports.items[0].id);
  expect(generated.child_id).toBe(child);
  expect(generated.sections.length).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "new-parent-real-ca-report-390");
});

async function signedPush(page, weekly = 7, value = 6) {
  const data = JSON.parse(
    readFileSync("../backend/tests/fixtures/prototype-insights.json", "utf8"),
  );
  data.growth.weekly_turns = weekly;
  data.companion.value = value;
  data.companion.effective_turns = 24;
  data.companion.updated_at = new Date().toISOString();
  const envelope = {
    event_type: "dingdong.prototype.companion_milestone",
    occurred_at: data.companion.updated_at,
    milestone: { interval: 3, completed_turns: 24 },
    data,
  };
  const raw = JSON.stringify(envelope),
    stamp = String(Math.floor(Date.now() / 1000));
  const signature =
    "sha256=" +
    createHmac("sha256", "synthetic-only-signing-secret")
      .update(stamp + "." + raw)
      .digest("hex");
  const response = await page.request.post(
    (process.env.E2E_BACKEND_URL || "http://127.0.0.1:8020") +
      "/api/dingdong/prototype/events",
    {
      data: raw,
      headers: {
        "Content-Type": "application/json",
        "X-Dingdong-Timestamp": stamp,
        "X-Dingdong-Signature": signature,
        "X-Dingdong-Event-ID": "synthetic-browser-" + randomUUID(),
        "X-Dingdong-Event-Type": envelope.event_type,
      },
    },
  );
  expect(response.status()).toBe(201);
  expect((await response.json()).duplicate).toBe(false);
  return data;
}
function boundFixture(child, id) {
  // Explicit local-only fixture changes solely the newly issued synthetic device row.
  // It does not claim a supplier binding acknowledgement or sender delivery.
  expect(child).toMatch(/^[a-f0-9-]{36}$/);
  expect(id).toMatch(/^ca_[a-zA-Z0-9]+$/);
  shell(
    `from django.conf import settings; from dingdong_ca.core.models import CaAccount; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; row=CaAccount.objects.get(child_id='${child}',ca_account_id='${id}',status='active'); assert row.prototype_demo; row.bind_state='bound'; row.save(update_fields=['bind_state'])`,
  );
}
async function grantRobot(page, child) {
  const policy = await api(page, "/policies/current?purpose=dingdong_sync", {
    auth: false,
  });
  return api(page, `/children/${child}/consents`, {
    method: "POST",
    body: { request_id: randomUUID(), policy_version_id: policy.id },
  });
}
test("会展A真实解绑保留CA记录→B新号待接通→合成bound与验签推送投影→完整报告", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const childA = await login(page, "会展家长A合成儿童");
  await page.goto(base + "/#companion");
  await page.locator("[data-action=companion-exploration]").click();
  await expect(page.locator("#consent-check")).toBeVisible();
  await page.locator("#consent-check").check();
  await page.locator("[data-action=agree-assessment]").click();
  await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
  const savedSession = page.url().split("/").pop();
  for (let i = 1; i <= 4; i++) {
    await expect(
      page.getByText(`第 ${i} / 4 题`, { exact: false }),
    ).toBeVisible();
    await page.locator("#answer-form input[name=answer]").first().check();
    await page.locator("#answer-form button[type=submit]").click();
  }
  await page.locator("[data-action=complete-exploration]").click();
  await expect(page.locator(".guidance-summary")).toBeVisible();
  // A owns a real CA report, generated by the worker before any robot binding.
  await page.goto(base + "/#reports");
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await expect(
    page.locator("#consent-check:visible, #answer-form:visible"),
  ).toBeVisible();
  if (await page.locator("#consent-check").isVisible()) {
    await page.getByLabel("我已阅读并同意本次测评用途").check();
    await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  }
  for (let i = 1; i <= 22; i++) {
    await expect(
      page.getByText(new RegExp("第 " + i + " / 22 题")),
    ).toBeVisible();
    await page.getByRole("radio").first().check();
    await page
      .getByRole("button", {
        name: i === 22 ? "保存并完成" : "保存并下一题",
        exact: true,
      })
      .click();
  }
  await page.getByRole("button", { name: "生成演示报告", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看初始报告", exact: true }),
  ).toBeVisible({ timeout: 180000 });
  const caReportId = (await api(page, `/children/${childA}/reports`)).items[0]
    .id;
  const token = "SYNTHETIC-CLOSED-LOOP-NFC";
  const firstResponse = await bind(page, token);
  expect(firstResponse.status()).toBe(201);
  const first = await firstResponse.json();
  expect(first.is_prototype_demo).toBe(true);
  expect(first.bind_state).toBe("unbound");
  await expect(page.locator(".account-row")).toContainText("待接通");
  await page.goto(base + "/#reports");
  await expect(page.locator("#dingdong-growth-report")).toContainText(
    "等待连接",
  );
  boundFixture(childA, first.ca_account_id);
  await page.reload();
  await expect(page.locator("#dingdong-growth-report")).toContainText(
    "同意查看机器人记录",
  );
  await grantRobot(page, childA);
  await page.reload();
  const existingProjection = await page.evaluate(async (child) => {
    const api = await import("./api.js");
    try {
      await api.request(`/children/${child}/prototype-demo`);
      return true;
    } catch (error) {
      return false;
    }
  }, childA);
  if (!existingProjection)
    await expect(page.locator("#dingdong-growth-report")).toContainText(
      "暂时无法读取",
    );
  await expect(
    page.getByRole("button", { name: "开始测评", exact: true }),
  ).toBeVisible();
  for (const weekly of [3, 7, 14, 21]) await signedPush(page, weekly, 6);
  await page.locator("[data-action=dingdong-report-refresh]").click();
  await expect(page.locator(".dd-report-summary")).toContainText("6");
  await expect(
    page.getByRole("heading", { name: "成长周期报告", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "陪学伙伴", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".dd-report-row")).toHaveCount(9);
  await expect(page.locator(".dd-report-chart circle")).toHaveCount(56);
  for (const weekly of [3, 14, 21, 7]) {
    await page
      .locator(`[data-action=dingdong-weekly-turns][data-value="${weekly}"]`)
      .click();
    await expect(
      page.locator(
        `[data-action=dingdong-weekly-turns][data-value="${weekly}"]`,
      ),
    ).toHaveAttribute("aria-pressed", "true");
    const view = await api(
      page,
      `/children/${childA}/prototype-demo?weekly_turns=${weekly}`,
    );
    expect(view.weekly_turns).toBe(weekly);
    expect(view.sync_source).toBe("push");
  }
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#dingdong-growth-report").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await shot(page, "dingdong-report-" + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".dd-report-trend").scrollIntoViewIfNeeded();
  await shot(page, "dingdong-curve-390");
  await page.screenshot({
    path: shots + "/dingdong-report-full-390.png",
    fullPage: true,
    animations: "disabled",
  });
  await signedPush(page, 7, 33);
  await page.locator("[data-action=dingdong-report-refresh]").click();
  await expect(page.locator(".dd-report-summary")).toContainText("33");
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  try {
    const childB = await login(other, "会展家长B合成儿童");
    const occupied = await bind(other, token);
    expect(occupied.status()).toBe(409);
    await expect(other.locator("#dialog .form-error")).toContainText(
      "原绑定家长先解绑",
    );
    await expect(other.locator("#dialog [data-action=refresh]")).toHaveCount(0);
    await page.goto(base + "/#settings");
    await expect(page.locator("[data-action=retire-account]")).toHaveText(
      "解绑机器人",
    );
    await page.locator("[data-action=retire-account]").click();
    await expect(page.locator("#dialog")).toContainText(
      "探索、活动和测评报告会保留",
    );
    await shot(page, "demo-unbind-confirm-390");
    await page.getByRole("button", { name: "确认解绑", exact: true }).click();
    await expect(page.locator(".account-row")).toContainText("已归档");
    await page.goto(base + "/#reports");
    await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
    expect((await api(page, "/assessments/" + savedSession)).status).toBe(
      "completed",
    );
    expect((await api(page, "/reports/" + caReportId)).child_id).toBe(childA);
    const lost = await page.evaluate(async (child) => {
      const api = await import("./api.js");
      try {
        await api.request(`/children/${child}/prototype-demo`);
        return 200;
      } catch (e) {
        return e.status;
      }
    }, childA);
    expect(lost).toBe(404);
    await other.getByRole("button", { name: "确认绑定", exact: true }).click();
    await expect(other.locator(".account-row")).toContainText("待接通");
    const second = (await api(other, `/children/${childB}/ca-accounts`))
      .items[0];
    expect(second.ca_account_id).not.toBe(first.ca_account_id);
    expect(second.is_prototype_demo).toBe(true);
    expect(second.bind_state).toBe("unbound");
    const retry = await bind(other, token);
    expect((await retry.json()).ca_account_id).toBe(second.ca_account_id);
    boundFixture(childB, second.ca_account_id);
    const grantB = await grantRobot(other, childB);
    await other.goto(base + "/#reports");
    await expect(other.locator(".dd-report-summary")).toContainText("33");
    await other.setViewportSize({ width: 390, height: 844 });
    await other.locator("#dingdong-growth-report").scrollIntoViewIfNeeded();
    await shot(other, "demo-new-parent-report-390");
    await api(other, "/consents/" + grantB.id + "/revoke", {
      method: "POST",
      body: {},
    });
    await other.reload();
    await expect(other.locator("#dingdong-growth-report")).toContainText(
      "同意查看机器人记录",
    );
    await expect(other.locator(".dd-report-chart")).toHaveCount(0);
    // Fixture is scoped to this newly created demo row; release local association for repeat runs.
    await api(other, `/ca-accounts/${second.ca_account_id}/retire`, {
      method: "POST",
      body: {},
    });
  } finally {
    await ctx.close();
  }
  expect(errors).toEqual([]);
});
