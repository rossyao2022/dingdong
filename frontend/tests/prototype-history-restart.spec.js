import { test, expect } from "@playwright/test";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

for (const purpose of ["interest", "talent"])
  test(`${purpose}历史结果重新探索后刷新保留新答卷${purpose === "talent" ? "（重新授权）" : ""}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    const runtime = await (
      await page.request.get(`${base}/api/v1/runtime`)
    ).json();
    expect(runtime.sms_mode, "禁止向真实供应商发送短信").toBe("fixed_code");
    const phone = `139${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await page.getByLabel("手机号", { exact: true }).fill(phone);
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.getByLabel("验证码", { exact: true }).fill("00000");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "建立儿童档案" }),
    ).toBeVisible();
    await page.getByLabel("姓名或称呼").fill("历史继续隔离验收");
    await page.getByRole("button", { name: "保存档案", exact: true }).click();
    await expect(page.locator(".six-islands")).toBeVisible();
    if (purpose === "interest")
      for (const id of ["R", "I", "A"])
        await page
          .locator(`[data-interest-action=select][data-id=${id}]`)
          .click();
    else await page.goto(`${base}/#talents`);
    const createdResponse = page.waitForResponse(
      (r) =>
        /\/children\/[^/]+\/assessments$/.test(r.url()) &&
        r.request().method() === "POST",
    );
    await page
      .locator(
        `[data-${purpose === "talent" ? "talent" : "interest"}-action=start]`,
      )
      .click();
    await page.locator("#explorer-consent").check();
    await page.locator("[data-action=agree-explorer]").click();
    const original = await (await createdResponse).json();
    // Prepare a completed result through real answer/complete APIs, never by inserting a result or fulfilling requests.
    await page.evaluate(
      async ({ original, purpose }) => {
        const API = await import(
          "./api.js" +
            new URL(document.querySelector('script[src*="bootstrap.js"]').src)
              .search
        );
        const saved = await API.request(`/assessments/${original.id}/answers`, {
          method: "PATCH",
          body: {
            revision: original.revision,
            answers: original.questions.map((q) => ({
              question_code: q.code,
              option_codes: [purpose === "interest" ? "4" : "5"],
            })),
          },
        });
        await API.request(`/assessments/${saved.id}/complete-exploration`, {
          method: "POST",
          body: { revision: saved.revision },
        });
      },
      { original, purpose },
    );
    const route = purpose === "interest" ? "interest" : "talents";
    await page.goto(`${base}/#${route}/${original.id}`);
    if (purpose === "interest") {
      await page.locator("[data-action=show-interest-result]").click();
      await expect(page.locator(".interest-result")).toBeVisible();
    } else await expect(page.locator(".talent-result-card")).toHaveCount(8);
    if (purpose === "talent")
      await page.evaluate(async (child) => {
        const API = await import(
          "./api.js" +
            new URL(document.querySelector('script[src*="bootstrap.js"]').src)
              .search
        );
        const grants = await API.all(`/children/${child}/consents`);
        const grant = grants.find(
          (row) => row.purpose === "assessment_processing" && !row.revoked_at,
        );
        await API.request(`/consents/${grant.id}/revoke`, { method: "POST" });
      }, original.child_id);
    const freshResponse = page.waitForResponse(
      (r) =>
        /\/children\/[^/]+\/assessments$/.test(r.url()) &&
        r.request().method() === "POST",
    );
    await page
      .locator(
        `[data-${purpose === "talent" ? "talent" : "interest"}-action=restart]`,
      )
      .click();
    if (purpose === "talent") {
      await expect(page.locator("#explorer-consent")).toBeVisible();
      await page.locator("#explorer-consent").check();
      await page.locator("[data-action=agree-explorer]").click();
    }
    const fresh = await (await freshResponse).json();
    expect(fresh.id).not.toBe(original.id);
    expect(fresh.answers).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`#${route}/${fresh.id}$`));
    const prefix = purpose === "talent" ? "talent" : "interest";
    await expect(page.locator(`.${prefix}-question`)).toBeVisible();
    const answer = page.locator(
      `[data-${prefix}-action=answer][data-${purpose === "talent" ? "value" : "rating"}='${purpose === "talent" ? "1" : "0"}']`,
    );
    await answer.click();
    await expect(answer).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`#${route}/${fresh.id}$`));
    expect(
      await page
        .locator(
          purpose === "talent" ? ".talent-result-card" : ".interest-result",
        )
        .count(),
    ).toBe(0);
    await page.locator(`[data-${prefix}-action=start]`).click();
    await expect(
      page.locator(
        purpose === "talent"
          ? ".talent-question-top"
          : ".interest-question-meta",
      ),
    ).toContainText(purpose === "talent" ? "第 2 / 24 题" : "第 2 / 9 题");
    await page.goto(`${base}/#${route}/${original.id}`);
    if (purpose === "talent") {
      await expect(page.locator(".talent-result-card")).toHaveCount(8);
      for (const score of await page.locator(".talent-score").all())
        await expect(score).toContainText("15");
    } else {
      await page.locator("[data-action=show-interest-result]").click();
      await expect(page.locator(".interest-profile")).toHaveCount(3);
      for (const profile of await page.locator(".interest-profile").all())
        await expect(profile).toContainText("4.0");
    }
    expect(errors).toEqual([]);
  });
