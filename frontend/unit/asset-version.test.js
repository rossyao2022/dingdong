import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const version = source("../../VERSION").trim();

test("each HTML executable and stylesheet and its entire production import graph uses the release version", () => {
  const seen = new Set();
  const visit = (reference) => {
    const url = new URL(reference, "https://ca.example/");
    assert.equal(url.search, `?v=${version}`, reference);
    const file = url.pathname.slice(1);
    if (!file.endsWith(".js") || seen.has(file)) return;
    seen.add(file);
    const js = source(`../${file}`);
    for (const match of js.matchAll(
      /(?:from\s*|import\s*\(\s*)["'](\.\/[^"']+)["']/g,
    ))
      visit(match[1]);
  };
  for (const file of [
    "index",
    "daily",
    "test",
    "result",
    "thumb",
    "island",
    "blindbox",
    "report",
  ]) {
    const html = source(`../${file}.html`);
    for (const match of html.matchAll(
      /(?:src|href)="([^"\s]+\.(?:js|css)(?:\?[^"\s]*)?)"/g,
    ))
      visit(match[1]);
  }
  assert.ok(seen.has("bootstrap.js"));
  assert.ok(seen.has("app.js"));
  assert.ok(seen.has("ca-link.js"));
  assert.ok(seen.has("ui-components.js"));
  assert.equal(JSON.parse(source("../package.json")).version, version);
});

test("all supported web images ship bootstrap and mutable production assets cannot be heuristically cached", () => {
  for (const docker of [
    "Dockerfile.web",
    "Dockerfile.web.from-v0319",
    "Dockerfile.web.from-v0320",
  ]) {
    assert.match(
      source(`../../deploy/${docker}`),
      /COPY frontend[^\n]*frontend\/bootstrap\.js/,
    );
  }
  const nginx = source("../../deploy/nginx.conf.template");
  assert.match(nginx, /Cache-Control[^\n]*no-store/);
  const server = source("../server.cjs");
  assert.ok(server.includes('"bootstrap.js"'));
  assert.match(source("../package.json"), /node --check bootstrap\.js/);
});
