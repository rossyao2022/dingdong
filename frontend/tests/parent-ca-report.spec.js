import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { shell } from "./support.js";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4176";
async function api(page, path) {
  return page.evaluate(async (path) => {
    const version = new URL(
      document.querySelector('script[src*="bootstrap.js"]').src,
    ).search;
    return (await import("./api.js" + version)).request(path);
  }, path);
}

test("未绑定完成22题，经真实Worker保存，体验记录去重并回看原回答", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
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
    page.getByRole("heading", { name: "建立儿童档案", exact: true }),
  ).toBeVisible();
  await page.getByLabel("姓名或称呼").fill("未绑定测评合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  const child = await page.locator("#child-select").inputValue();
  await page.goto(base + "/#reports");
  await page.locator(".assessment-start summary").click();
  const initial = (await api(page, "/assessment-config")).questionnaires.find(
    (q) => q.code === "initial-assessment",
  );
  expect(initial).toBeTruthy();
  await page
    .locator(".assessment-start .card")
    .filter({
      has: page.getByRole("heading", { name: initial.title, exact: true }),
    })
    .getByRole("button", { name: "开始这份问卷", exact: true })
    .click();
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
  await page.getByRole("button", { name: "完成并保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: initial.title, exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".question .report-section")).toHaveCount(22);
  await expect
    .poll(
      async () => (await api(page, `/children/${child}/reports`)).items.length,
      { timeout: 90000 },
    )
    .toBe(1);
  const reports = await api(page, `/children/${child}/reports`);
  expect(reports.items.length).toBe(1);
  const generated = await api(page, "/reports/" + reports.items[0].id);
  expect(generated.child_id).toBe(child);
  expect(generated.sections.length).toBeGreaterThan(0);
  expect(
    (await api(page, `/children/${child}/ca-accounts`)).items,
  ).toHaveLength(0);
  await page
    .locator("#toast.show")
    .waitFor({ state: "hidden", timeout: 10000 });
  await page.screenshot({
    path: "../deploy/evidence/v0.3.25/shots/ux-ca-record-detail-390.png",
    animations: "disabled",
  });
  await page.goto(base + "/#reports");
  await expect(page.locator("#personal-assessments")).toBeVisible();
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await expect(
    page.locator("#personal-assessments .experience-records li"),
  ).toHaveCount(1);
  await expect(page.locator(".experience-records time")).toHaveCount(1);
  await expect(page.locator(".experience-records li")).toContainText(
    initial.title,
  );
  await expect(page.locator("#personal-assessments")).not.toContainText(
    "初始报告",
  );
  await page.locator(".experience-records a").click();
  await expect(
    page.getByRole("heading", { name: initial.title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".question .report-section")).toHaveCount(22);
  await page.goto(base + "/#reports");
  await page.screenshot({
    path: "../deploy/evidence/v0.3.25/shots/ux-ca-record-list-390.png",
    animations: "disabled",
  });
  const backend = process.env.E2E_BACKEND_URL || "http://127.0.0.1:8025";
  const cookie = shell(
    `from django.contrib.auth import get_user_model; from django.contrib.auth.models import Group; from django.test import Client; u=get_user_model().objects.create_user(username='forms-e2e-${randomUUID()}',password='synthetic-local-only',account_kind='staff',is_staff=True,name='合成表单运营');u.groups.set(Group.objects.filter(name='operations'));c=Client();c.force_login(u);print(c.cookies['sessionid'].value)`,
  )
    .trim()
    .split("\n")
    .at(-1);
  const opsContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await opsContext.addCookies([
    {
      name: "sessionid",
      value: cookie,
      url: backend,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const ops = await opsContext.newPage();
  const errors = [];
  ops.on("pageerror", (e) => errors.push(e.message));
  await ops.goto(backend + "/ops/children/" + child + "/");
  await ops.getByRole("link", { name: "测评表单", exact: true }).click();
  await expect(ops.locator("#assessment-form-text")).toContainText(
    initial.title,
  );
  const preview = await ops.locator("#assessment-form-text").inputValue();
  await ops.locator("#assessment-form-copy").click();
  await expect(ops.locator("#assessment-copy-status")).toContainText("已复制");
  expect(await ops.evaluate(() => navigator.clipboard.readText())).toBe(
    preview,
  );
  const jsonLink = await ops
    .getByRole("link", { name: "下载 JSON", exact: true })
    .getAttribute("href");
  const csvLink = await ops
    .getByRole("link", { name: "下载 CSV", exact: true })
    .getAttribute("href");
  const document = await (await ops.request.get(backend + jsonLink)).json();
  expect(document.schema_version).toBe("ca-assessment-form-v1");
  expect(document.assessments).toHaveLength(1);
  expect(document.assessments[0].questions).toHaveLength(22);
  expect(document.assessments[0].title).toBe(initial.title);
  expect(
    document.assessments[0].questions.every(
      (q) => q.selected_option_codes.length === 1,
    ),
  ).toBe(true);
  expect(JSON.stringify(document)).not.toContain("phone");
  const csv = await ops.request.get(backend + csvLink);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(document.snapshot_digest);
  await ops.screenshot({
    path: "../deploy/evidence/v0.3.25/shots/ops-assessment-form-1280.png",
    fullPage: true,
  });
  await ops.setViewportSize({ width: 390, height: 844 });
  await ops.reload();
  expect(
    await ops.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await ops.screenshot({
    path: "../deploy/evidence/v0.3.25/shots/ops-assessment-form-390.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await opsContext.close();
});
