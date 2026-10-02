import { test, expect } from "@playwright/test";
import { createHmac, randomUUID, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { shell } from "./support.js";

const shots = process.env.E2E_SHOTS_DIR;
const backend = process.env.E2E_BACKEND_URL;
async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const api = await import("./api.js");
      return api.request(path, options);
    },
    { path, options },
  );
}

let opsFixtureSession = null;
const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  if (opsFixtureSession) {
    expect(opsFixtureSession).toMatch(/^[a-z0-9]{32}$/);
    shell(
      `from django.conf import settings; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; from django.contrib.sessions.models import Session; from django.contrib.auth import get_user_model; session=Session.objects.get(session_key='${opsFixtureSession}'); uid=session.get_decoded().get('_auth_user_id'); get_user_model().objects.filter(pk=uid,username__startswith='ui-text-').update(is_active=False); session.delete()`,
    );
    opsFixtureSession = null;
  }
  expect(pageErrors.get(page)).toEqual([]);
});

test("synthetic bound report keeps all periods and opens all eight dimensions by keyboard", async ({
  page,
}) => {
  test.skip(
    !shots || !backend,
    "requires explicit isolated synthetic environment",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    (await (await page.request.get("/api/v1/runtime")).json()).sms_mode,
  ).toBe("fixed_code");
  await page
    .getByLabel("手机号", { exact: true })
    .fill(`139${String(randomInt(1e8)).padStart(8, "0")}`);
  await page.locator("#send-code").click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("报告明细合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  const child = await page.locator("#child-select").inputValue();
  await page.goto("/?nfc_token=SYNTHETIC-CLOSED-LOOP-NFC#settings");
  await expect(page.locator("#bind-robot-form")).toBeVisible();
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "确认绑定", exact: true }).click();
  const account = await (await created).json();
  expect(account.is_prototype_demo).toBe(true);
  expect(child).toMatch(/^[a-f0-9-]{36}$/);
  expect(account.ca_account_id).toMatch(/^ca_[a-zA-Z0-9]+$/);
  shell(
    `from django.conf import settings; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; from dingdong_ca.core.models import CaAccount; row=CaAccount.objects.get(child_id='${child}',ca_account_id='${account.ca_account_id}',status='active'); assert row.prototype_demo; row.bind_state='bound'; row.save(update_fields=['bind_state'])`,
  );
  const policy = await api(page, "/policies/current?purpose=dingdong_sync", {
    auth: false,
  });
  await api(page, `/children/${child}/consents`, {
    method: "POST",
    body: { request_id: randomUUID(), policy_version_id: policy.id },
  });
  for (const weekly of [3, 7, 14, 21]) {
    const data = JSON.parse(
      readFileSync("../backend/tests/fixtures/prototype-insights.json", "utf8"),
    );
    data.growth.weekly_turns = weekly;
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
      backend + "/api/dingdong/prototype/events",
      {
        data: raw,
        headers: {
          "Content-Type": "application/json",
          "X-Dingdong-Timestamp": stamp,
          "X-Dingdong-Signature": signature,
          "X-Dingdong-Event-ID": "synthetic-text-" + randomUUID(),
          "X-Dingdong-Event-Type": envelope.event_type,
        },
      },
    );
    expect(response.status()).toBe(201);
  }
  await page.goto("/#reports");
  await expect(page.locator(".dd-report-summary")).toBeVisible();
  await expect(page.locator("#main h1")).toHaveCount(1);
  await expect(page.locator("#dingdong-growth-report")).toContainText("模拟");
  const details = page.locator(".dd-report-comparison");
  await expect(details).not.toHaveAttribute("open", "");
  for (const weekly of [3, 7, 14, 21]) {
    await page
      .locator(`[data-action=dingdong-weekly-turns][data-value="${weekly}"]`)
      .click();
    await expect(
      page.locator(
        `[data-action=dingdong-weekly-turns][data-value="${weekly}"]`,
      ),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      (
        await api(
          page,
          `/children/${child}/prototype-demo?weekly_turns=${weekly}`,
        )
      ).weekly_turns,
    ).toBe(weekly);
  }
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator(".dd-report-row")).toHaveCount(9);
  await expect(page.locator(".dd-report-chart circle")).toHaveCount(56);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await details.locator("summary").press("Space");
  await page.locator("#dingdong-growth-report").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: shots + "/report-focused-390.png",
    animations: "disabled",
  });
  await api(page, `/ca-accounts/${account.ca_account_id}/retire`, {
    method: "POST",
    body: {},
  });
});

test("isolated ops fixture: metric details stay on dashboard and reference handbooks remain reachable", async ({
  page,
  context,
}) => {
  test.skip(
    !shots || !backend,
    "requires explicit isolated synthetic environment",
  );
  const result = shell(
    `from django.conf import settings; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; from django.contrib.auth import get_user_model; from django.test import Client; import uuid; u=get_user_model().objects.create(username='ui-text-'+uuid.uuid4().hex,account_kind='staff',name='界面验收合成运营',is_staff=True,is_superuser=True); u.set_unusable_password(); u.save(); c=Client(); c.force_login(u); print(c.cookies['sessionid'].value)`,
  );
  opsFixtureSession = result.trim().split("\n").pop();
  await context.addCookies([
    { name: "sessionid", value: result.trim().split("\n").pop(), url: backend },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(backend + "/ops/");
  await expect(page.locator(".ops-metric-scope").first()).toBeVisible();
  const scope = page.locator(".ops-metric-scope").first();
  await expect(scope).not.toHaveAttribute("open", "");
  await scope.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(scope).toHaveAttribute("open", "");
  await expect(page).toHaveURL(backend + "/ops/");
  await scope.locator("summary").press("Space");
  await page.screenshot({
    path: shots + "/ops-focused-390.png",
    animations: "disabled",
  });
  for (const route of [
    "families",
    "services",
    "ca-accounts",
    "questionnaires",
    "activities",
    "accounts",
    "reports",
    "jobs",
    "audit",
    "exhibition",
    "dingdong-push",
  ]) {
    const response = await page.goto(backend + "/ops/" + route + "/");
    expect(response.status(), route).toBe(200);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        route + " " + width,
      ).toBeLessThanOrEqual(1);
    }
    for (const details of await page.locator("details.ops-help").all()) {
      await details.locator("summary").press("Enter");
      await expect(details).toHaveAttribute("open", "");
    }
  }
});
