import { test, expect } from "@playwright/test";
import { shell } from "./support.js";

// Run against the real isolated PostgreSQL-backed app. Never fulfil API responses.
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const screenshotDir = "../.trellis/.runtime/prototype-integration/shots";
const widths = [320, 390, 430];

async function loginAndChild(page, name = "原型整合验收") {
  await page.goto(base);
  const runtime = await (
    await page.request.get(`${base}/api/v1/runtime`)
  ).json();
  expect(runtime.sms_mode, "本用例必须使用本地固定码，禁止真实发码").toBe(
    "fixed_code",
  );
  const phone = `139${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  await page.getByLabel("手机号", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.getByLabel("姓名或称呼").fill(name);
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
}

async function startWithConsent(page, selector) {
  await page.locator(selector).click();
  const consent = page.locator("#explorer-consent");
  await expect(
    page
      .locator(
        "#explorer-consent, .interest-question, .interest-result, .talent-question, .talent-report-heading",
      )
      .first(),
  ).toBeVisible();
  if (await consent.isVisible()) {
    await consent.check();
    await page.locator("[data-action=agree-explorer]").click();
  }
  await expect(
    page
      .locator(".interest-question, .interest-result, .talent-question")
      .first(),
  ).toBeVisible();
}

async function nextSaved(page, kind, rating) {
  const attr = kind === "interest" ? "rating" : "value";
  const answer = page.locator(
    `[data-${kind}-action='answer'][data-${attr}='${rating}']`,
  );
  await answer.click();
  await expect(answer).toHaveAttribute("aria-pressed", "true");
  const next = page.locator(`[data-${kind}-action='next']`);
  await expect(next).toBeEnabled();
  await next.click();
}

async function layout(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  const broken = await page
    .locator("#main img, #dialog[open] img")
    .evaluateAll(async (images) => {
      images.forEach((image) => {
        image.loading = "eager";
      });
      await Promise.all(
        images.map((image) =>
          Promise.race([
            image.decode().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]),
        ),
      );
      return images
        .filter((image) => !image.naturalWidth)
        .map((image) => image.getAttribute("src"));
    });
  expect(broken).toEqual([]);
  const dialog = page.locator("#dialog[open]");
  if (await dialog.count()) {
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      (await page.viewportSize()).width + 1,
    );
  }
}

function watch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function noSensitiveStorage(page) {
  const data = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(Object.keys(data.local)).not.toContain("dingdong-islands-v4");
  expect(Object.keys(data.local)).not.toContain("dingdong-talents-v1");
  expect(JSON.stringify(data)).not.toMatch(
    /"answers"|"selected_islands"|"blob:|synthetic-preview/,
  );
}

test("六岛完整、选三顺序、九题真实保存、刷新恢复与儿童隔离", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = watch(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAndChild(page);
  await expect(page.locator("[data-interest-action='select']")).toHaveCount(6);
  await expect(page.locator(".module-nav > *")).toHaveCount(4);
  for (const id of ["E", "C", "I"])
    await page
      .locator(`[data-interest-action='select'][data-id='${id}']`)
      .click();
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "ECI",
  );
  await page.locator("[data-interest-action='earlier'][data-id='I']").click();
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "EIC",
  );
  await page
    .locator(".six-islands")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: `${screenshotDir}/home-islands-390.png`,
    style: "#toast { display: none !important; }",
  });
  await page
    .locator(".selection-station")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: `${screenshotDir}/home-selection-390.png`,
    style: "#toast { display: none !important; }",
  });
  await startWithConsent(page, "[data-interest-action='start']");
  await expect(page.locator(".interest-question-meta")).toContainText(
    "第 1 / 9 题",
  );
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await layout(page);
    for (const rating of await page
      .locator("[data-interest-action='answer']")
      .all()) {
      const bounds = await rating.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(
        await rating.evaluate((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        ),
      ).toBeGreaterThanOrEqual(14);
    }
    await page.screenshot({
      path: `${screenshotDir}/interest-question-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await nextSaved(page, "interest", 0);
  await expect(page.locator("#interest-question-title")).toBeFocused();
  await nextSaved(page, "interest", 4);
  await page.reload();
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "EIC",
  );
  await startWithConsent(page, "[data-interest-action='start']");
  await expect(page.locator(".interest-question-meta")).toContainText(
    "第 3 / 9 题",
  );
  const completedResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/complete-exploration") &&
      r.request().method() === "POST",
  );
  for (let i = 2; i < 9; i++) await nextSaved(page, "interest", 4);
  const completed = await (await completedResponse).json();
  expect(completed.status).toBe("completed");
  expect(completed.answers).toHaveLength(9);
  expect(completed.selected_islands).toEqual(["E", "I", "C"]);
  await expect(page.locator(".interest-result")).toBeVisible();
  await expect(page.locator(".interest-profile")).toHaveCount(3);
  await expect(page.locator(".interest-profile").first()).toContainText("2.7");
  await expect(page.locator(".interest-profile").nth(1)).toContainText("4.0");
  await expect(page.locator(".interest-result-hero")).toContainText(
    "E · I · C",
  );
  await expect(
    page
      .locator(".career-explorer, .career-section, .career-combination")
      .first(),
  ).toBeVisible();
  await layout(page);
  await page.screenshot({ path: `${screenshotDir}/interest-result-390.png` });
  await page.locator("[data-interest-action='task'][data-id='E']").click();
  await expect(page.locator("#dialog-title")).toHaveText("家庭小舞台");
  await page.locator("[data-action='start-activity']").click();
  await expect(page.locator(".step-title")).toBeVisible();
  for (let step = 0; step < 2; step++) {
    await page.locator("[data-action='next-step']").click();
    await expect(
      page.locator(".tag").filter({ hasText: `第 ${step + 2} / 3 步` }),
    ).toBeVisible();
  }
  await page.locator("#activity-note").fill("从兴趣组合打开，完成真实小行动");
  await page.locator("[data-action='finish']").click();
  await expect(page.locator("#timeline")).toContainText("家庭小舞台");
  await expect(page.locator("#timeline")).toContainText(
    "从兴趣组合打开，完成真实小行动",
  );
  await page.goto(`${base}/#explore`);
  await page.reload();
  await startWithConsent(page, "[data-interest-action='start']");
  await expect(page.locator(".interest-result")).toBeVisible();
  await page.locator("[data-interest-action='back']").click();
  const originalChild = await page.locator("#child-select").inputValue();
  await page.goto(`${base}/#settings`);
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("隔离的另一个儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "",
  );
  await page.locator("#child-select").selectOption(originalChild);
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "EIC",
  );
  await noSensitiveStorage(page);
  expect(errors).toEqual([]);
});

test("24题八维观察真实作答、断点恢复、最低分相同不强排前三", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAndChild(page, "八维真实作答验收");
  await page.goto(`${base}/#talents`);
  await startWithConsent(page, "[data-talent-action='start']");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await layout(page);
    await page.screenshot({
      path: `${screenshotDir}/talent-question-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 4; i++) await nextSaved(page, "talent", 1);
  await expect(page.locator("#talent-question-title")).toBeFocused();
  await page.reload();
  await expect(page.locator("[data-talent-action='start']")).toContainText(
    "继续",
  );
  await startWithConsent(page, "[data-talent-action='start']");
  await expect(page.locator(".talent-question-top")).toContainText(
    "第 5 / 24 题",
  );
  const completedResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/complete-exploration") &&
      r.request().method() === "POST",
  );
  for (let i = 4; i < 24; i++) await nextSaved(page, "talent", 1);
  const completed = await (await completedResponse).json();
  expect(completed.status).toBe("completed");
  expect(completed.answers).toHaveLength(24);
  await expect(page.locator(".talent-result-card")).toHaveCount(8);
  for (const score of await page.locator(".talent-score").all())
    await expect(score).toContainText("3");
  await expect(page.locator(".talent-report-overview")).toContainText(
    "一样值得探索",
  );
  await expect(page.locator(".talent-radar")).toBeVisible();
  await page.reload();
  await expect(page.locator(".talent-result-card")).toHaveCount(8);
  await layout(page);
  await page.screenshot({ path: `${screenshotDir}/talent-report-390.png` });
  await noSensitiveStorage(page);
  expect(errors).toEqual([]);
});

test("八维最高分及第四名并列全部呈现，重新探索保留历史结果", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = watch(page);
  await loginAndChild(page, "八维并列验收");
  await page.goto(`${base}/#talents`);
  await startWithConsent(page, "[data-talent-action='start']");
  const firstResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/complete-exploration") &&
      r.request().method() === "POST",
  );
  for (let i = 0; i < 24; i++) await nextSaved(page, "talent", 5);
  const first = await (await firstResponse).json();
  await expect(page.locator(".talent-result-card")).toHaveCount(8);
  for (const score of await page.locator(".talent-score").all())
    await expect(score).toContainText("15");
  await expect(page.locator(".talent-report-overview")).toContainText(
    "一样值得探索",
  );
  await page.locator("[data-talent-action='restart']").click();
  const types = await page.evaluate(() =>
    window.TalentData.questions.map((q) => q.type),
  );
  const top = ["word", "music", "logic", "space"];
  const secondResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/complete-exploration") &&
      r.request().method() === "POST",
  );
  for (const type of types)
    await nextSaved(page, "talent", top.includes(type) ? 5 : 1);
  const second = await (await secondResponse).json();
  expect(second.id).not.toBe(first.id);
  await expect(page.locator(".talent-top-tags > span")).toHaveCount(4);
  for (const dimension of top)
    await expect(
      page.locator(`[data-talent-dimension='${dimension}'] .talent-score`),
    ).toContainText("15");
  for (const dimension of ["body", "self", "social", "nature"])
    await expect(
      page.locator(`[data-talent-dimension='${dimension}'] .talent-score`),
    ).toContainText("3");
  await page.goto(`${base}/#talents/${first.id}`);
  await expect(page.locator(".talent-result-card")).toHaveCount(8);
  for (const score of await page.locator(".talent-score").all())
    await expect(score).toContainText("15");
  await noSensitiveStorage(page);
  expect(errors).toEqual([]);
});

test("过期草稿重新打开建立新答卷，原答案保留且选岛不丢", async ({ page }) => {
  const errors = watch(page);
  await loginAndChild(page, "过期草稿验收");
  for (const id of ["R", "I", "A"])
    await page
      .locator(`[data-interest-action='select'][data-id='${id}']`)
      .click();
  const firstResponse = page.waitForResponse(
    (r) =>
      /\/children\/[^/]+\/assessments$/.test(r.url()) &&
      r.request().method() === "POST",
  );
  await startWithConsent(page, "[data-interest-action='start']");
  const first = await (await firstResponse).json();
  await nextSaved(page, "interest", 0);
  // Change only this test's own draft, using the same isolated Django settings as the app.
  const changed = shell(`from datetime import timedelta
from django.utils import timezone
from dingdong_ca.core.models import AssessmentSession
print(AssessmentSession.objects.filter(pk="${first.id}", status="draft").update(expires_at=timezone.now()-timedelta(minutes=1)))`)
    .trim()
    .split("\n")
    .pop();
  expect(changed).toBe("1");
  await page.reload();
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "RIA",
  );
  const secondResponse = page.waitForResponse(
    (r) =>
      /\/children\/[^/]+\/assessments$/.test(r.url()) &&
      r.request().method() === "POST",
  );
  await startWithConsent(page, "[data-interest-action='start']");
  const second = await (await secondResponse).json();
  expect(second.id).not.toBe(first.id);
  expect(second.answers).toEqual([]);
  expect(second.selected_islands).toEqual(["R", "I", "A"]);
  await expect(page.locator(".interest-question-meta")).toContainText(
    "第 1 / 9 题",
  );
  const preserved = shell(`from dingdong_ca.core.models import AssessmentSession
s=AssessmentSession.objects.get(pk="${first.id}")
print(s.answers == {"R-0": ["0"]})`)
    .trim()
    .split("\n")
    .pop();
  expect(preserved).toBe("True");
  expect(errors).toEqual([]);
});

test("指纹四类完整指南、示例及临时预览不上传，离开释放图片", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = watch(page);
  const uploads = [];
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH"].includes(request.method()) &&
      /fingerprint|upload|slot/.test(request.url())
    )
      uploads.push(request.url());
  });
  await loginAndChild(page);
  await page.goto(`${base}/#fingerprint`);
  await page.locator("[data-fp-action='sample']").click();
  for (const pattern of ["whorl", "loop", "reverse", "arch"]) {
    await page
      .locator(`[data-fp-action='pattern'][data-fp-pattern='${pattern}']`)
      .click();
    await expect(page.locator("#fp-guide-container")).not.toBeEmpty();
    await expect(page.locator("#fp-guide-container")).toContainText("陪伴");
    if (pattern === "whorl") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .locator("#fp-guide-report")
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: `${screenshotDir}/guide-whorl-390.png`,
        style: "#toast { display: none !important; }",
      });
      await page
        .locator(".fp-guide-columns > article")
        .nth(1)
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: `${screenshotDir}/guide-learning-390.png`,
        style: "#toast { display: none !important; }",
      });
      await page
        .locator(".fp-guide-activity")
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: `${screenshotDir}/guide-activity-390.png`,
        style: "#toast { display: none !important; }",
      });
    }
    await page
      .locator("#fp-guide-container [data-action='exploration-guide-task']")
      .click();
    await expect(page.locator("[data-action='start-activity']")).toBeVisible();
    await page.locator("#dialog [data-action='close']").click();
  }
  await page.evaluate(() => {
    window.__revokedPreviews = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (value) => {
      window.__revokedPreviews.push(value);
      revoke(value);
    };
  });
  // A generated 1px PNG; no human fingerprint is used or stored.
  await page.locator("#fp-file-input").setInputFiles({
    name: "synthetic-preview.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const preview = page.locator("#fp-stage img[src^='blob:']");
  await expect(preview).toBeVisible();
  const blob = await preview.getAttribute("src");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await layout(page);
    await page.screenshot({
      path: `${screenshotDir}/fingerprint-${width}.png`,
    });
  }
  await page.goto(`${base}/#explore`);
  expect(
    await page.evaluate(
      (blob) => window.__revokedPreviews.includes(blob),
      blob,
    ),
  ).toBe(true);
  await page.goto(`${base}/#fingerprint`);
  await expect(page.locator("#fp-stage img[src^='blob:']")).toHaveCount(0);
  await noSensitiveStorage(page);
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("四模块和六岛在手机平板桌面无溢出、遮挡或坏图", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watch(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginAndChild(page);
  for (const width of [...widths, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/#explore`);
    await expect(page.locator(".six-islands")).toBeVisible();
    await layout(page);
    const intro = await page
      .locator(".six-world-intro > div")
      .first()
      .boundingBox();
    const guide = await page.locator(".six-guide").boundingBox();
    const heroOverlap =
      Math.min(intro.x + intro.width, guide.x + guide.width) -
        Math.max(intro.x, guide.x) >
        1 &&
      Math.min(intro.y + intro.height, guide.y + guide.height) -
        Math.max(intro.y, guide.y) >
        1;
    expect(heroOverlap, `${width}px 介绍文字与机器人互相覆盖`).toBe(false);
    const buttons = await page.locator(".six-islands > button").all();
    for (let i = 0; i < buttons.length; i++) {
      const a = await buttons[i].boundingBox();
      expect(a.width).toBeGreaterThan(90);
      for (let j = i + 1; j < buttons.length; j++) {
        const b = await buttons[j].boundingBox();
        const overlap =
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
        expect(overlap, `${width}px 第${i + 1}和${j + 1}座岛卡片重叠`).toBe(
          false,
        );
      }
    }
    await page.screenshot({
      path: `${screenshotDir}/home-${width}.png`,
      fullPage: true,
      style: "#toast { display: none !important; }",
    });
    for (const route of [
      "talents",
      "fingerprint",
      "home",
      "reports",
      "settings",
    ]) {
      await page.goto(`${base}/#${route}`);
      await expect(page.locator("#main[aria-busy='false']")).toBeVisible();
      await layout(page);
    }
  }
  expect(errors).toEqual([]);
});
