import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 答题最后一题的按钮文案（P-08）。
 *
 * 改前实测：第 4/4 题的按钮仍写「保存并继续」，但点下去并不会再出现下一题，
 * 而是进入「准备好留下这次选择了吗？」的提交确认页 —— 文案与实际动作不符。
 * 改后要求：末题为「保存并完成」，第 1–3 题仍为「保存并下一题」。
 *
 * 证据截图写到任务目录（`frontend/docs/` 不进版本库，验收证据要能随任务归档）。
 */
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-011", "shots");
mkdirSync(shots, { recursive: true });

const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

test("探索四题：末题按钮为「保存并完成」，前几题仍为「保存并下一题」", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.getByLabel("姓名或称呼").fill("末题文案测试小芽");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();

  await page.locator("#main-nav").getByRole("link", { name: "测评与报告" }).click();
  await page.getByRole("button", { name: "开始探索体验", exact: true }).click();
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();

  const nextButton = page.getByRole("button", {
    name: "保存并下一题",
    exact: true,
  });
  const doneButton = page.getByRole("button", {
    name: "保存并完成",
    exact: true,
  });

  for (let i = 1; i <= 4; i++) {
    await expect(
      page.getByText(`第 ${i} / 4 题`, { exact: false }),
    ).toBeVisible();
    if (i < 4) {
      await expect(nextButton).toBeVisible();
      await expect(doneButton).toHaveCount(0);
    } else {
      await expect(doneButton).toBeVisible();
      await expect(nextButton).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(shots, "t011-last-question-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: join(shots, "t011-last-question-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    await page.getByRole("radio").first().check();
    await (i < 4 ? nextButton : doneButton).click();
  }

  // 末题按钮点下去应当落在提交确认页，而不是凭空多出一题。
  await expect(
    page.getByRole("button", { name: "完成探索体验", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(shots, "t011-after-last-question-desktop.png"),
  });
});
