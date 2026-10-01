import { test, expect } from "@playwright/test";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4177";
async function login(page) {
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
  await page.getByLabel("姓名或称呼").fill("主线合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".experience-task")).toBeVisible();
}
async function answer(page) {
  await page.locator('[data-interest-action=answer][data-rating="4"]').click();
  await page.locator("[data-interest-action=next]").click();
}
async function layout(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  for (const el of await page
    .locator(".experience-task .button,.experience-records .button")
    .all()) {
    const box = await el.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}
test("主线真实保存：首次探索→中断续题→行动→记录→下一次，切儿童隔离", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const first = await page.locator("#child-select").inputValue();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await layout(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    style: "#toast { display: none !important; }",
    path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.25/shots"}/flow-first-390.png`,
  });
  await page.locator(".experience-task [data-action=journey-interest]").click();
  for (const id of ["R", "I", "A"])
    await page.locator(`[data-interest-action=select][data-id=${id}]`).click();
  await page.locator("[data-interest-action=start]").click();
  await expect(
    page
      .locator("#explorer-consent:visible,.interest-question-meta:visible")
      .first(),
  ).toBeVisible();
  if (await page.locator("#explorer-consent").isVisible()) {
    await page.locator("#explorer-consent").check();
    await page.locator("[data-action=agree-explorer]").click();
  }
  await expect(page.locator(".interest-question-meta")).toContainText(
    "第 1 / 9 题",
  );
  await answer(page);
  await page.goto(base + "/#explore");
  await page.reload();
  await expect(page.locator(".experience-task")).toContainText("继续上次探索");
  await page.locator(".experience-task .button").first().click();
  await expect(page.locator(".interest-question-meta")).toContainText(
    "第 2 / 9 题",
  );
  for (let i = 1; i < 9; i++) await answer(page);
  await expect(page.locator(".interest-result")).toBeVisible();
  await page.locator("[data-interest-action=back]").click();
  await expect(page.locator(".experience-task")).toContainText("选一个小活动");
  await page.locator(".experience-task a").first().click();
  await expect(
    page.getByRole("heading", { name: "今日陪伴", exact: true }),
  ).toBeVisible();
  await page.locator(".activity-card [data-action=activity]").first().click();
  await page.locator("[data-action=start-activity]").click();
  await expect(page.locator(".step-title")).toBeVisible();
  await page.goto(base + "/#explore");
  await page.reload();
  await expect(page.locator(".experience-task")).toContainText("继续这个活动");
  await page.screenshot({
    animations: "disabled",
    style: "#toast { display: none !important; }",
    path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.25/shots"}/flow-resume-390.png`,
  });
  await page.locator(".experience-task a").first().click();
  await expect(page.locator(".step-title")).toBeVisible();
  for (
    let i = 0;
    i < 10 && (await page.locator("[data-action=next-step]").isVisible());
    i++
  ) {
    const previous = await page.locator(".step-title").textContent();
    await page.locator("[data-action=next-step]").click();
    await expect(page.locator(".step-title")).not.toHaveText(previous);
  }
  await page.locator("#activity-note").fill("跟着主线完成的真实保存记录");
  await page.locator("[data-action=finish]").click();
  await expect(page.locator("#timeline")).toContainText(
    "跟着主线完成的真实保存记录",
  );
  await expect(page.locator(".experience-task")).toContainText("选一个小活动");
  await page.screenshot({
    animations: "disabled",
    style: "#toast { display: none !important; }",
    path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.25/shots"}/flow-next-390.png`,
  });
  await page.goto(base + "/#reports");
  await expect(page.locator(".experience-records li")).toHaveCount(2);
  await expect(page.locator(".experience-records time")).toHaveCount(2);
  await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  await page.screenshot({
    animations: "disabled",
    style: "#toast { display: none !important; }",
    path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.25/shots"}/flow-records-390.png`,
    fullPage: true,
  });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await layout(page);
  }
  await page.goto(base + "/#settings");
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("主线第二儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".experience-task")).toContainText("开始兴趣探索");
  await page.goto(base + "/#reports");
  await expect(page.locator(".experience-records li")).toHaveCount(0);
  await page.locator("#child-select").selectOption(first);
  await expect(page.locator(".experience-task")).toContainText("选一个小活动");
  await page.goto(base + "/#reports");
  await expect(page.locator(".experience-records li")).toHaveCount(2);
  expect(errors).toEqual([]);
});
