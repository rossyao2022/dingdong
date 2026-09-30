import { test, expect } from "@playwright/test";
import { LEGACY_ROUTES } from "../legacy.js";

test("all seven old page URLs open their current CA page and discard identity, scores and NFC tokens", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL).origin;
  for (const [file, route] of Object.entries(LEGACY_ROUTES)) {
    await page.goto(
      `${origin}/${file}?score=999&child_id=other&nfc_token=legacy-secret&next=https://evil.example/#wrong`,
    );
    await expect(page).toHaveURL(`${origin}/index.html#${route}`);
    await expect(page.locator("#main")).toBeAttached();
    expect(await page.evaluate(() => document.referrer)).not.toContain(
      "legacy-secret",
    );
    expect(new URL(page.url()).search).toBe("");
  }
});
