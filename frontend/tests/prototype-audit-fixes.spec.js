import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const shots = "../deploy/evidence/v0.3.25/shots";
async function login(page) {
  await page.goto(base);
  expect(
    (await (await page.request.get(base + "/api/v1/runtime")).json()).sms_mode,
    "仅本地固定码",
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
  await page.getByLabel("姓名或称呼").fill("遗漏修复验收");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
}
async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const API = await import(
        "./api.js" +
          new URL(document.querySelector('script[src*="bootstrap.js"]').src)
            .search
      );
      return API.request(path, options);
    },
    { path, options },
  );
}
async function shot(page, name) {
  await expect(page.locator("#toast.show")).toHaveCount(0, { timeout: 10000 });
  await page.screenshot({
    path: `${shots}/${name}.png`,
    animations: "disabled",
  });
}
async function openTask(page, mode = "guide", guide = "cognitive") {
  await page.goto(base + "/#fingerprint");
  await page.locator("[data-fp-action=sample]").click();
  await page.locator("[data-fp-action=pattern][data-fp-pattern=whorl]").click();
  await page.locator("[data-action=exploration-guide-task]").click();
  await page.locator("#activity-mode").selectOption(mode);
  await page.locator("#activity-guide-mode").selectOption(guide);
  await page.locator("[data-action=start-activity]").click();
  await expect(page.locator(".step-title")).toBeVisible();
}
async function skip(page) {
  await page.locator("[data-action=skip]").click();
  await expect(page.locator("#timeline")).toBeVisible();
}
async function finish(page) {
  for (let i = 1; i < 3; i++) {
    await page.locator("[data-action=next-step]").click();
    await expect(
      page.getByText("第 " + (i + 1) + " / 3 步", { exact: true }),
    ).toBeVisible();
  }
  await page.locator("#activity-note").fill("完成活动的可导出真实记录");
  await page.locator("[data-action=finish]").click();
  await expect(page.locator("#timeline")).toContainText(
    "完成活动的可导出真实记录",
  );
}
function watch(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
test("原四类偏好真实保存、刷新恢复、儿童隔离、退出", async ({ page }) => {
  const errors = watch(page);
  await login(page);
  const child = await page.locator("#child-select").inputValue();
  await page.goto(base + "/#companion");
  await expect(
    page.locator("[data-action=style][data-value=imitative]"),
  ).toBeVisible();
  await page.locator("[data-action=style][data-value=imitative]").click();
  await expect(
    page.locator("[data-value=imitative][data-action=style]"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.locator("[data-value=imitative][data-action=style]"),
  ).toHaveAttribute("aria-pressed", "true");
  await shot(page, "repair-companion-390");
  const pref = await api(page, `/children/${child}/companion-preference`);
  expect(pref.guide_mode).toBe("imitative");
  expect(pref.revision).toBeGreaterThan(0);
  await page.goto(base + "/#settings");
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("另一个儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  const other = await page.locator("#child-select").inputValue();
  expect(other).not.toBe(child);
  await page.goto(base + "/#companion");
  await expect(
    page.locator("[data-value=cognitive][data-action=style]"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-value=open][data-action=style]").click();
  await expect(
    page.locator("[data-value=open][data-action=style]"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("#child-select").selectOption(child);
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.goto(base + "/#companion");
  await expect(
    page.locator("[data-value=imitative][data-action=style]"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("#logout-shortcut").click();
  await expect(
    page.getByRole("heading", { name: "家长登录", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("活动四种引导实际不同、自主模式、上一步、筛选与真实导出", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = watch(page);
  await login(page);
  const child = await page.locator("#child-select").inputValue();
  const texts = [];
  await page.goto(base + "/#companion");
  await page.locator("[data-action=style][data-value=imitative]").click();
  await expect(
    page.locator("[data-action=style][data-value=imitative]"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto(base + "/#home");
  await page.locator("[data-action=activity]").first().click();
  await expect(page.locator("#activity-mode")).toHaveValue("guide");
  await expect(page.locator("#activity-guide-mode")).toHaveValue("imitative");
  await page.locator("[data-action=start-activity]").click();
  await expect(page.locator(".activity-guidance")).toContainText("例子");
  await skip(page);
  for (const guide of ["cognitive", "imitative", "reverse", "open"]) {
    await openTask(page, "guide", guide);
    texts.push(await page.locator(".activity-guidance").innerText());
    const record = await api(
      page,
      "/activity-records/" + page.url().split("/").pop(),
    );
    expect(record.guide_mode).toBe(guide);
    expect(record.style).toBe("cognitive");
    if (guide === "imitative") await shot(page, "repair-guide-imitative-390");
    if (guide === "reverse") {
      const id = record.id;
      const before = await page.locator(".activity-guidance").innerText();
      await page.goto(base + "/#companion");
      await page.locator("[data-action=style][data-value=open]").click();
      await expect(
        page.locator("[data-action=style][data-value=open]"),
      ).toHaveAttribute("aria-pressed", "true");
      await page.goto(base + "/#activity/" + id);
      await expect(page.locator(".activity-guidance")).toHaveText(before);
      expect((await api(page, "/activity-records/" + id)).guide_mode).toBe(
        "reverse",
      );
    }
    await skip(page);
  }
  expect(new Set(texts).size).toBe(4);
  await openTask(page, "web", "reverse");
  const recordId = page.url().split("/").pop();
  const record = await api(page, "/activity-records/" + recordId);
  await expect(page.locator(".activity-guidance")).toHaveText(
    record.activity.alternative,
  );
  await page.locator("[data-action=next-step]").click();
  await expect(page.getByText("第 2 / 3 步", { exact: true })).toBeVisible();
  await shot(page, "repair-activity-previous-390");
  await page.locator("[data-action=previous-step]").click();
  await expect(page.getByText("第 1 / 3 步", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("第 1 / 3 步", { exact: true })).toBeVisible();
  await finish(page);
  await page
    .locator("[data-action=journey-filter][data-value=skipped]")
    .click();
  await expect(page.locator("#timeline")).not.toContainText(
    "完成活动的可导出真实记录",
  );
  await expect(page.locator("#timeline")).toContainText("已跳过");
  await page
    .locator("[data-action=journey-filter][data-value=completed]")
    .click();
  await expect(page.locator("#timeline")).toContainText(
    "完成活动的可导出真实记录",
  );
  await expect(page.locator("#timeline")).not.toContainText("已跳过");
  await shot(page, "repair-journey-filter-390");
  await page.evaluate(() => {
    window.__exportRevokeCount = 0;
    const old = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.__exportRevokeCount++;
      old(url);
    };
  });
  const downloaded = page.waitForEvent("download");
  await page.locator("[data-action=export-child]").click();
  const d = await downloaded;
  const exported = JSON.parse(readFileSync(await d.path(), "utf8"));
  expect(exported.schema_version).toBe("ca-child-export-v1");
  expect(exported.child.id).toBe(child);
  expect(exported.activities.some((r) => r.id === recordId)).toBe(true);
  expect(exported.activities.find((r) => r.id === recordId).guide_mode).toBe(
    "reverse",
  );
  expect(JSON.stringify(exported)).not.toMatch(
    /nfc_token|access_token|refresh_token|password|sample_slots|blob:|fingerprint_image/,
  );
  await expect
    .poll(() => page.evaluate(() => window.__exportRevokeCount))
    .toBeGreaterThan(0);
  await page.goto(base + "/#settings");
  await shot(page, "repair-export-settings-390");
  for (let i = 0; i < 16; i++) {
    const r = await api(page, `/children/${child}/activity-records`, {
      method: "POST",
      body: {
        request_id: crypto.randomUUID(),
        activity_version_id: record.activity_version_id,
        mode: "guide",
        style: "cognitive",
        guide_mode: "open",
      },
    });
    await api(page, "/activity-records/" + r.id + "/finish", {
      method: "POST",
      body: { status: "skipped" },
    });
  }
  await page.goto(base + "/#journey");
  await page
    .locator("[data-action=journey-filter][data-value=skipped]")
    .click();
  await expect(page.locator("#timeline article")).toHaveCount(20);
  await page.locator("[data-action=more-records]").click();
  await expect(page.locator("#timeline article")).toHaveCount(21);
  await expect(page.locator("[data-action=more-records]")).toHaveCount(0);
  await page.goto(base + "/#settings");
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("没有活动的儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  await page.goto(base + "/#journey");
  await expect(page.locator("#timeline article")).toHaveCount(0);
  await expect(page.locator("#timeline")).toContainText("第一份记录");
  expect(errors).toEqual([]);
});
test("伙伴四情境、服务端分布、重做保留旧结果与家长支持", async ({ page }) => {
  const errors = watch(page);
  await login(page);
  await page.goto(base + "/#companion");
  await page.locator("[data-action=companion-exploration]").click();
  await expect(
    page.locator("#consent-check,#answer-form").first(),
  ).toBeVisible();
  if (await page.locator("#consent-check").count()) {
    await page.locator("#consent-check").check();
    await page.locator("[data-action=agree-assessment]").click();
  }
  await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
  const old = page.url().split("/").pop();
  for (let i = 1; i <= 4; i++) {
    await expect(
      page.getByText("第 " + i + " / 4 题", { exact: false }),
    ).toBeVisible();
    await page.locator("#answer-form input[name=answer]").first().check();
    await page.locator("#answer-form button[type=submit]").click();
  }
  await page.locator("[data-action=complete-exploration]").click();
  await expect(page.locator(".guidance-summary")).toBeVisible();
  const s = await api(page, "/assessments/" + old);
  expect(s.guidance_summary.counts).toEqual({
    cognitive: 4,
    imitative: 0,
    reverse: 0,
    open: 0,
  });
  await page.reload();
  await expect(page.locator(".guidance-summary")).toContainText("4");
  await shot(page, "repair-guidance-result-390");
  await page.goto(base + "/#companion");
  await page.locator("[data-action=companion-exploration]").click();
  await expect(page.locator(".guidance-summary")).toBeVisible();
  expect(page.url()).toContain(old);
  await page.locator("[data-action=redo-exploration]").click();
  await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
  expect(page.url()).not.toContain(old);
  expect((await api(page, "/assessments/" + old)).guidance_summary).toEqual(
    s.guidance_summary,
  );
  await page.goto(base + "/#reports");
  await expect(
    page.getByRole("heading", { name: "体验记录", exact: true }),
  ).toBeVisible();
  await page.goto(base + "/#services");
  await page.locator("[data-action=parent-reflection]").click();
  await expect(page.locator("#dialog")).toContainText("三个");
  expect(await page.locator("#dialog ol li").count()).toBe(3);
  await shot(page, "repair-parent-reflection-390");
  await page.getByRole("button", { name: "关闭对话框", exact: true }).click();
  const ca = page.locator('a[href="https://happykua.com/CareerAcademy.html"]');
  await expect(ca).toHaveAttribute("rel", /noopener/);
  await expect(ca).toHaveAttribute("rel", /noreferrer/);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
