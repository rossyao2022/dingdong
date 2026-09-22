import { test, expect } from "@playwright/test";

/**
 * 账户页给家长看的机器人摘要，叫「机器人标识（前 8 位）」，不叫「指纹」。
 *
 * 同一份界面里另有「不采集真实指纹」的承诺（测评页），两处共用一个词会让家长
 * 以为我们在偷偷采集。摘要值本身不变（服务端仍只回 8 位前缀）。
 */
const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (label) =>
  `e2e-${label}-${Math.random().toString(16).slice(2, 10)}`;

async function login(page, number = phone()) {
  await page.goto("/");
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

test("账户页把机器人摘要叫「机器人标识（前 8 位）」，不说「指纹」", async ({
  page,
}) => {
  await login(page);
  await child(page, "标识合成儿童");
  const mine = token("label");
  await page.goto(`/?nfc_token=${mine}#settings`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  const created = await (await pending).json();
  const summary = created.nfc_token_fingerprint;
  expect(summary).toMatch(/^[0-9a-f]{8}$/);

  const row = page.locator(".account-row").first();
  await expect(row).toContainText("机器人标识（前 8 位）");
  // 摘要值没变：仍是服务端回的那 8 位。
  await expect(row).toContainText(summary);

  const panel = page.locator(".panel", { hasText: "机器人账户" });
  await expect(panel).not.toContainText("指纹");

  await row.scrollIntoViewIfNeeded();
  // 等底部的绑定成功提示自己收起，否则它正好压在这一行文字上，截图证明不了什么。
  await expect(page.locator("#toast")).not.toHaveClass(/show/, {
    timeout: 10000,
  });
  await page.screenshot({
    path: "../.trellis/tasks/T-012/shots/account-row-desktop.png",
  });

  // 文案变长了，窄屏要确认没把卡片撑出横向滚动条。
  await page.setViewportSize({ width: 390, height: 844 });
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../.trellis/tasks/T-012/shots/account-row-mobile.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1280, height: 720 });

  // 换机弹窗在同一页，同样不该说「指纹」，且要照旧显示同一个摘要。
  await page.goto(`/?nfc_token=${token("label-new")}#settings`);
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await expect(
    dialog.getByRole("heading", { name: "换一台机器人" }),
  ).toBeVisible();
  await expect(dialog).toContainText(summary);
  await expect(dialog).not.toContainText("指纹");
  await page.screenshot({
    path: "../.trellis/tasks/T-012/shots/replace-dialog-desktop.png",
  });
});
