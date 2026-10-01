import { test, expect } from "@playwright/test";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const shots = "../deploy/evidence/v0.3.26/shots";
async function api(page, path, options) {
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
async function completedInterest(page) {
  await page.goto(base);
  const runtime = await (
    await page.request.get(`${base}/api/v1/runtime`)
  ).json();
  expect(runtime.sms_mode, "只允许本地固定码，不发送真实短信").toBe(
    "fixed_code",
  );
  await page
    .getByLabel("手机号", { exact: true })
    .fill(`139${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("组件确认合成验收");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  for (const id of ["R", "I", "A"])
    await page.locator(`[data-interest-action=select][data-id=${id}]`).click();
  const created = page.waitForResponse(
    (r) =>
      /\/children\/[^/]+\/assessments$/.test(r.url()) &&
      r.request().method() === "POST",
  );
  await page.locator("[data-interest-action=start]").click();
  await page.locator("#explorer-consent").check();
  await page.locator("[data-action=agree-explorer]").click();
  const original = await (await created).json();
  const saved = await api(page, `/assessments/${original.id}/answers`, {
    method: "PATCH",
    body: {
      revision: original.revision,
      answers: original.questions.map((q) => ({
        question_code: q.code,
        option_codes: ["4"],
      })),
    },
  });
  const completed = await api(
    page,
    `/assessments/${original.id}/complete-exploration`,
    { method: "POST", body: { revision: saved.revision } },
  );
  await page.reload();
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "RIA",
  );
  return completed;
}
for (const width of [390, 1280])
  test(`组件确认 ${width}px：取消/Esc/关闭保留记录，确认组合后才新建探索`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const natives = [],
      errors = [];
    page.on("dialog", async (dialog) => {
      natives.push(dialog.type());
      await dialog.dismiss();
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 844 });
    const original = await completedInterest(page);
    const change = page.locator("[data-interest-action=remove][data-id=R]");
    const modal = page.locator(".component-confirm");
    await change.click();
    await expect(modal).toBeVisible();
    await expect(modal.locator("[autofocus]")).toBeFocused();
    const bounds = await modal.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(
      await modal.evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `${shots}/component-confirm-${width}.png`,
      animations: "disabled",
      style: "#toast { display:none !important }",
    });
    await modal
      .getByRole("button", { name: "保留原组合", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator("#interest-map")).toHaveAttribute(
      "data-selected",
      "RIA",
    );
    await expect(page.locator('[data-world-id="R"]')).toBeFocused();
    await change.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(page.locator("#interest-map")).toHaveAttribute(
      "data-selected",
      "RIA",
    );
    await expect(page.locator('[data-world-id="R"]')).toBeFocused();
    await change.click();
    await modal.getByRole("button", { name: "关闭确认", exact: true }).click();
    await expect(page.locator("#interest-map")).toHaveAttribute(
      "data-selected",
      "RIA",
    );
    expect((await api(page, `/assessments/${original.id}`)).answers).toEqual(
      original.answers,
    );
    expect(
      (await api(page, `/children/${original.child_id}/assessments`)).items,
    ).toHaveLength(1);
    await change.click();
    await modal.getByRole("button", { name: "调整组合", exact: true }).click();
    await expect(page.locator("#interest-map")).toHaveAttribute(
      "data-selected",
      "IA",
    );
    expect(
      (await api(page, `/children/${original.child_id}/assessments`)).items,
    ).toHaveLength(1);
    await page.locator("[data-interest-action=select][data-id=S]").click();
    const freshResponse = page.waitForResponse(
      (r) =>
        /\/children\/[^/]+\/assessments$/.test(r.url()) &&
        r.request().method() === "POST",
    );
    await page.locator("[data-interest-action=start]").click();
    const fresh = await (await freshResponse).json();
    expect(fresh.id).not.toBe(original.id);
    expect(fresh.selected_islands).toEqual(["I", "A", "S"]);
    expect(fresh.answers).toEqual([]);
    const preserved = await api(page, `/assessments/${original.id}`);
    expect(preserved.answers).toEqual(original.answers);
    expect(preserved.status).toBe("completed");
    expect(natives).toEqual([]);
    expect(errors).toEqual([]);
  });
test("组件确认：离页立即取消；重叠探索弹窗支持安全焦点返回和单实例清理", async ({
  page,
}) => {
  test.setTimeout(120000);
  const natives = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", async (dialog) => {
    natives.push(dialog.type());
    await dialog.dismiss();
  });
  const original = await completedInterest(page);
  await page.goto(`${base}/#settings`);
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("组件确认第二儿童");
  const childResponse = page.waitForResponse(
    (r) => /\/children$/.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const otherChild = (await (await childResponse).json()).id;
  expect(otherChild).not.toBe(original.child_id);
  await expect(page.locator("#child-select")).toHaveValue(otherChild);
  await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "",
  );
  await page.locator("#child-select").selectOption(original.child_id);
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "RIA",
  );
  await page.locator("[data-interest-action=remove][data-id=R]").click();
  await expect(page.locator(".component-confirm")).toBeVisible();
  // A normal child switch is disabled during act. Dispatch the existing handler
  // to exercise late-context protection without intercepting any API response.
  await page.locator("#child-select").evaluate((select, otherChild) => {
    select.value = otherChild;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, otherChild);
  await expect(page.locator(".component-confirm")).toHaveCount(0);
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "",
  );
  expect(
    (await api(page, `/children/${otherChild}/assessments`)).items,
  ).toEqual([]);
  expect((await api(page, `/assessments/${original.id}`)).answers).toEqual(
    original.answers,
  );
  await page.locator("#child-select").selectOption(original.child_id);
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "RIA",
  );
  await page.locator("[data-interest-action=remove][data-id=R]").click();
  await expect(page.locator(".component-confirm")).toBeVisible();
  await page.evaluate(() => {
    location.hash = "reports";
  });
  await expect(page.locator(".component-confirm")).toHaveCount(0);
  await page.goto(`${base}/#explore`);
  await expect(page.locator("#interest-map")).toHaveAttribute(
    "data-selected",
    "RIA",
  );
  await page.locator("[data-interest-action=start]").click();
  await expect(page.locator("#dialog[open]")).toBeVisible();
  await page.evaluate(async () => {
    const ui = await import(
      "./ui-components.js" +
        new URL(document.querySelector('script[src*="bootstrap.js"]').src)
          .search
    );
    window.__confirmResults = [];
    window.__focusBeforeConfirm = document.activeElement;
    ui.confirmDialog({ title: "第一条" }).then((v) =>
      window.__confirmResults.push(v),
    );
    ui.confirmDialog({ title: "第二条" }).then((v) =>
      window.__confirmResults.push(v),
    );
  });
  await expect(page.locator(".component-confirm")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__confirmResults))
    .toEqual([false]);
  await page.keyboard.press("Escape");
  await expect(page.locator(".component-confirm")).toHaveCount(0);
  await expect(page.locator("#dialog[open]")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__confirmResults))
    .toEqual([false, false]);
  expect(
    await page.evaluate(
      () => document.activeElement === window.__focusBeforeConfirm,
    ),
  ).toBe(true);
  expect((await api(page, `/assessments/${original.id}`)).answers).toEqual(
    original.answers,
  );
  await page.evaluate(async () => {
    const ui = await import(
      "./ui-components.js" +
        new URL(document.querySelector('script[src*="bootstrap.js"]').src)
          .search
    );
    ui.confirmDialog({ title: "跨标签页退出测试" });
    const channel = new BroadcastChannel("dingdong-auth");
    channel.postMessage({ logout: true });
    channel.close();
  });
  await expect(page.locator(".component-confirm")).toHaveCount(0);
  // This message tests forget()/boot() cleanup; it does not revoke the real
  // cookie session, so boot may restore it. No late confirmation survives.
  expect(natives).toEqual([]);
  expect(errors).toEqual([]);
});
