/** Actual browser HTTP-cache regression. Only old static resources are fixtures;
 * application files and API responses are streamed from the real local server. */
import { test, expect } from "@playwright/test";
import { createServer, request } from "node:http";
import { createServer as reserveServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const version = readFileSync(
  new URL("../../VERSION", import.meta.url),
  "utf8",
).trim();
const evidence = fileURLToPath(
  new URL(`../../deploy/evidence/v${version}/`, import.meta.url),
);
let local,
  fixture,
  base,
  localPort,
  mode = "healthy",
  counts;
function staticResponse(res, type, body, cache = "no-store") {
  res.writeHead(200, {
    "Content-Type": `${type}; charset=utf-8`,
    "Cache-Control": cache,
  });
  res.end(body);
}
test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  const reserved = reserveServer();
  await new Promise((resolve) => reserved.listen(0, "127.0.0.1", resolve));
  localPort = reserved.address().port;
  await new Promise((resolve) => reserved.close(resolve));
  local = spawn(
    process.execPath,
    [fileURLToPath(new URL("../server.cjs", import.meta.url))],
    {
      env: {
        ...process.env,
        PORT: String(localPort),
        BACKEND_PORT: process.env.CACHE_BACKEND_PORT || "8017",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise((resolve, reject) => {
    local.stdout.once("data", resolve);
    local.once("error", reject);
    local.once("exit", (code) =>
      reject(new Error(`static server exited ${code}`)),
    );
  });
  fixture = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost");
    counts[path.pathname + path.search] =
      (counts[path.pathname + path.search] || 0) + 1;
    if (
      path.pathname === "/ca-link.js" &&
      (!path.search || mode === "broken-dependency")
    ) {
      staticResponse(
        res,
        "text/javascript",
        "export const activeAccount = () => null;",
        path.search ? "no-store" : "public, max-age=3600, immutable",
      );
      return;
    }
    if (path.pathname === "/prime.html") {
      staticResponse(
        res,
        "text/html",
        '<script type="module">import { activeAccount } from "./ca-link.js"; document.body.dataset.primed=String(activeAccount()===null);</script>',
      );
      return;
    }
    if (path.pathname === "/legacy-consumer.js") {
      staticResponse(
        res,
        "text/javascript",
        'import { conflictNeedsRefresh } from "./ca-link.js"; document.getElementById("main").textContent="ready";',
      );
      return;
    }
    if (path.pathname === "/old.html") {
      staticResponse(
        res,
        "text/html",
        '<main id="main">正在连接成长空间…</main><script type="module" src="legacy-consumer.js"></script>',
      );
      return;
    }
    if (path.pathname === "/bootstrap.js" && mode === "stalled-entry") return;
    if (path.pathname === "/bootstrap.js" && mode === "broken-entry") {
      res.writeHead(404, { "Cache-Control": "no-store" });
      res.end();
      return;
    }
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: localPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${localPort}` },
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${fixture.address().port}`;
});
test.beforeEach(() => {
  counts = {};
  mode = "healthy";
});
test.afterAll(async () => {
  if (fixture) await new Promise((resolve) => fixture.close(resolve));
  if (local) {
    local.kill();
    await new Promise((resolve) =>
      local.exitCode !== null ? resolve() : local.once("exit", resolve),
    );
  }
});
async function ready(page) {
  await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#main")).not.toContainText("正在连接成长空间");
  await expect(page.getByRole("button", { name: "获取验证码" })).toBeVisible();
  await expect(page.locator("#environment")).toBeHidden();
}

test("populated old immutable module cache reproduces the old error; versioned current app then boots and ordinary reload works", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/prime.html`);
  await expect(page.locator("body")).toHaveAttribute("data-primed", "true");
  expect(counts["/ca-link.js"]).toBe(1);
  await page.goto(`${base}/old.html?nfc_token=cache-fixture`);
  await expect
    .poll(() => errors.join("\n"))
    .toContain("does not provide an export named");
  expect(errors.join("\n")).toContain("conflictNeedsRefresh");
  await expect(page.locator("#main")).toContainText("正在连接成长空间");
  expect(counts["/ca-link.js"]).toBe(1); // Cache supplied the obsolete file; no fresh HTTP request.
  const oldErrors = [...errors];
  errors.length = 0;
  await page.goto(`${base}/index.html?nfc_token=cache-fixture#settings`);
  await ready(page);
  expect(page.url()).not.toContain("nfc_token");
  expect(counts[`/ca-link.js?v=${version}`]).toBe(1);
  await page.reload();
  await ready(page);
  expect(counts[`/ca-link.js?v=${version}`]).toBe(2);
  expect(errors).toEqual([]);
  // Let the finite first-render fade finish before recording visual evidence.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) =>
          Number.isFinite(animation.effect.getTiming().iterations),
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  await page.screenshot({
    path: `${evidence}cache-upgrade-populated.png`,
    fullPage: true,
  });
  writeFileSync(
    `${evidence}cache-upgrade-populated.json`,
    JSON.stringify(
      {
        oldErrors,
        currentErrors: errors,
        counts,
        oldCachedFetches: counts["/ca-link.js"],
        upgradedModuleFetches: counts[`/ca-link.js?v=${version}`],
        ordinaryReload: "passed",
        api: "real anonymous local backend; no route mock or SMS",
      },
      null,
      2,
    ),
  );
});

test("fresh cache boots the full real app", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/index.html#explore`);
  await ready(page);
  expect(errors).toEqual([]);
  expect(counts["/ca-link.js"]).toBeUndefined();
  expect(counts[`/ca-link.js?v=${version}`]).toBe(1);
  writeFileSync(
    `${evidence}cache-upgrade-fresh.json`,
    JSON.stringify({ errors, counts, result: "real app login ready" }, null, 2),
  );
});

for (const failure of ["broken-dependency", "broken-entry"]) {
  test(`${failure} offers manual recovery, keeps NFC until healthy app boot and never loops`, async ({
    page,
  }) => {
    mode = failure;
    await page.goto(
      `${base}/index.html?nfc_token=cache-fixture&robot_ref=fixture#settings`,
    );
    await expect(
      page.getByRole("heading", { name: "页面暂时没有加载成功" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重新加载页面" }),
    ).toBeVisible();
    await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#environment")).toBeHidden();
    expect(page.url()).toContain("nfc_token=cache-fixture");
    expect(page.url()).toContain("robot_ref=fixture");
    await page.waitForTimeout(400);
    expect(
      counts["/index.html?nfc_token=cache-fixture&robot_ref=fixture"],
    ).toBe(1);
    const failedCounts = { ...counts };
    await page.screenshot({
      path: `${evidence}${failure}.png`,
      fullPage: true,
    });
    mode = "healthy";
    await page.getByRole("button", { name: "重新加载页面" }).click();
    await ready(page);
    expect(page.url()).not.toContain("nfc_token");
    expect(page.url()).not.toContain("robot_ref");
    writeFileSync(
      `${evidence}${failure}.json`,
      JSON.stringify(
        {
          failedCounts,
          recoveredCounts: counts,
          nfcPreservedBeforeRetry: true,
          nfcRemovedByRealAppAfterRetry: true,
          automaticRetryCount: 0,
        },
        null,
        2,
      ),
    );
  });
}

// A lost entry response must also stop showing a spinner, even without an error event.
test("entry fetch stalls: independent HTML watchdog shows recovery once and healthy retry cancels timers", async ({
  page,
}) => {
  mode = "stalled-entry";
  await page.goto(`${base}/index.html?nfc_token=cache-fixture#settings`, {
    waitUntil: "commit",
  });
  await expect(
    page.getByRole("heading", { name: "页面暂时没有加载成功" }),
  ).toBeVisible({ timeout: 24000 });
  await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");
  expect(page.url()).toContain("nfc_token=cache-fixture");
  expect(counts["/index.html?nfc_token=cache-fixture"]).toBe(1);
  mode = "healthy";
  await page.getByRole("button", { name: "重新加载页面" }).click();
  await ready(page);
  expect(page.url()).not.toContain("nfc_token");
  expect(
    await page.evaluate(() => window.dingdongStartupTimer),
  ).toBeUndefined();
  writeFileSync(
    `${evidence}stalled-entry.json`,
    JSON.stringify(
      {
        counts,
        watchdog: "actual 20s timeout, no automatic reload",
        recovery: "real app login",
        htmlTimerRemovedAfterLoaderTakeover: true,
      },
      null,
      2,
    ),
  );
});
