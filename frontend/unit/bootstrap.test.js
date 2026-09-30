import test from "node:test";
import assert from "node:assert/strict";
import { startApp, showStartupFailure } from "../bootstrap.js";

function clock() {
  let callback,
    cleared = false;
  return {
    setTimer(fn) {
      callback = fn;
      return 1;
    },
    clearTimer(id) {
      assert.equal(id, 1);
      cleared = true;
    },
    fire() {
      if (!cleared) callback();
    },
    get cleared() {
      return cleared;
    },
  };
}

test("module link failure produces one recovery view and never automatically reloads", async () => {
  const timer = clock();
  let failures = 0,
    attempts = 0;
  assert.equal(
    await startApp({
      ...timer,
      load: async () => {
        attempts++;
        throw new SyntaxError("does not export private detail");
      },
      onFailure: () => failures++,
    }),
    false,
  );
  timer.fire();
  assert.equal(attempts, 1);
  assert.equal(failures, 1);
  assert.equal(timer.cleared, true);
});

test("watchdog waits for app first render and is cancelled when app takes over", async () => {
  const timer = clock();
  let finish,
    failures = 0;
  const appReady = new Promise((resolve) => {
    finish = resolve;
  });
  const pending = startApp({
    ...timer,
    load: async () => ({ appReady }),
    onFailure: () => failures++,
  });
  await Promise.resolve();
  assert.equal(timer.cleared, false);
  finish();
  assert.equal(await pending, true);
  timer.fire();
  assert.equal(failures, 0);
  assert.equal(timer.cleared, true);
});

test("a stalled boot shows finite recovery once without another load attempt", async () => {
  const timer = clock();
  let finish,
    failures = 0,
    attempts = 0;
  const appReady = new Promise((resolve) => {
    finish = resolve;
  });
  const pending = startApp({
    ...timer,
    load: async () => {
      attempts++;
      return { appReady };
    },
    onFailure: () => failures++,
  });
  await Promise.resolve();
  timer.fire();
  timer.fire();
  assert.equal(failures, 1);
  assert.equal(attempts, 1);
  finish();
  await pending;
  assert.equal(timer.cleared, true);
});

test("recovery view is plain parent text, clears busy and retries only after explicit click", () => {
  const node = () => ({
    children: [],
    attributes: {},
    append(...children) {
      this.children.push(...children);
    },
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    replaceChildren(...children) {
      this.children = children;
    },
    addEventListener(type, fn) {
      this[type] = fn;
    },
  });
  const main = node();
  const environment = {};
  const doc = {
    getElementById: (id) => (id === "main" ? main : environment),
    createElement: node,
  };
  let reloads = 0;
  showStartupFailure(doc, () => reloads++);
  assert.equal(main.attributes["aria-busy"], "false");
  assert.equal(environment.hidden, true);
  const [title, description, button] = main.children[0].children;
  assert.equal(title.textContent, "页面暂时没有加载成功");
  assert.equal(description.textContent, "请点击下方按钮重新加载。");
  assert.equal(button.textContent, "重新加载页面");
  assert.equal(reloads, 0);
  button.click();
  assert.equal(reloads, 1);
});
