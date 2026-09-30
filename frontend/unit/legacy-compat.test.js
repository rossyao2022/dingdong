import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { LEGACY_ROUTES, legacyTarget } from "../legacy.js";

test("seven legacy page names map to fixed CA routes and discard every old parameter", () => {
  assert.deepEqual(LEGACY_ROUTES, {
    "daily.html": "home",
    "test.html": "talents",
    "result.html": "talents",
    "thumb.html": "fingerprint",
    "island.html": "explore",
    "blindbox.html": "explore",
    "report.html": "reports",
  });
  for (const [file, route] of Object.entries(LEGACY_ROUTES)) {
    const url = legacyTarget(
      `https://ca.example/dingdong/${file}?score=999&child_id=OTHER&nfc_token=secret&next=https://evil.example#secret`,
    );
    assert.equal(url, `https://ca.example/dingdong/index.html#${route}`);
    assert.ok(!url.includes("secret"));
  }
  assert.equal(legacyTarget("https://ca.example/unknown.html?next=evil"), null);
  assert.equal(legacyTarget("https://ca.example/__proto__"), null);
  assert.equal(legacyTarget("javascript:report.html"), null);
  assert.equal(
    legacyTarget(
      "https://evil.example/report.html",
      "https://ca.example/dingdong/",
    ),
    null,
  );
  assert.equal(
    legacyTarget(
      "https://ca.example/dingdong/report.html",
      "https://ca.example/dingdong/",
    ),
    "https://ca.example/dingdong/index.html#reports",
  );
});

test("local static server serves all legacy bridges and modules without weakening its allowlist", async () => {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../server.cjs", import.meta.url))],
    {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("static preview startup timed out")),
        5000,
      );
      child.stdout.once("data", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`preview exited ${code}`));
      });
    });
    const base = `http://127.0.0.1:${port}`;
    for (const [file, route] of Object.entries(LEGACY_ROUTES)) {
      const response = await fetch(`${base}/${file}?nfc_token=secret`);
      assert.equal(response.status, 200, file);
      assert.match(response.headers.get("content-type"), /^text\/html/);
      const html = await response.text();
      assert.ok(html.includes('type="module" src="legacy.js"'));
      assert.ok(html.includes(`href="index.html#${route}"`));
      assert.ok(!html.includes("secret"));
      assert.equal(
        (await fetch(`${base}/${file}`, { method: "HEAD" })).status,
        200,
      );
    }
    for (const file of ["legacy.js", "guide-preference.js"])
      assert.equal((await fetch(`${base}/${file}`)).status, 200);
    assert.equal((await fetch(`${base}/task.json`)).status, 404);
    assert.equal(
      (await fetch(`${base}/report.html`, { method: "POST" })).status,
      405,
    );
  } finally {
    child.kill();
    await new Promise((resolve) =>
      child.exitCode !== null ? resolve() : child.once("exit", resolve),
    );
  }
});
