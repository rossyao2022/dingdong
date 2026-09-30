import { test, expect } from "@playwright/test";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4176";
async function api(page, path) {
  return page.evaluate(async (path) => {
    const version = new URL(
      document.querySelector('script[src*="bootstrap.js"]').src,
    ).search;
    return (await import("./api.js" + version)).request(path);
  }, path);
}

test("未绑定从统一问卷入口完成22题，经真实Worker生成并回看自己的CA报告", async ({
  page,
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
  await page.getByRole("button", { name: "生成演示报告", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看初始报告", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "查看初始报告", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "初始报告", exact: true }),
  ).toBeVisible();
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
    path: "../deploy/evidence/v0.3.24/shots/ux-ca-report-detail-390.png",
    animations: "disabled",
  });
  await page.goto(base + "/#reports");
  await expect(page.locator("#personal-assessments")).toBeVisible();
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await expect(
    page.locator("#personal-assessments [data-action=report]"),
  ).toHaveCount(1);
  await page.screenshot({
    path: "../deploy/evidence/v0.3.24/shots/ux-ca-report-list-390.png",
    animations: "disabled",
  });
});
