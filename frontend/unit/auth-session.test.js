import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

let instance = 0;
const moduleForTab = () => import(`../api.js?auth-test-tab=${++instance}`);
const response = (body, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });
const authChanged = (error) => {
  assert.equal(error.status, 0);
  assert.equal(error.code, "AUTH_STATE_CHANGED");
  return true;
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

// This is a transport/coordination unit harness, not browser or backend acceptance.
function install(t, fetch, withLocks = true) {
  const originals = Object.fromEntries(
    ["fetch", "document", "navigator"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const lockNames = [];
  let queue = Promise.resolve();
  const locks = {
    request(name, callback) {
      lockNames.push(name);
      const pending = queue.then(callback);
      queue = pending.catch(() => {});
      return pending;
    },
  };
  for (const [name, value] of Object.entries({
    fetch,
    document: { cookie: "csrftoken=initial-csrf" },
    navigator: withLocks ? { locks } : {},
  })) {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }
  t.after(() => {
    for (const [name, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { locks, lockNames };
}

test("two tabs serialize refresh and reread rotated cookies/CSRF inside the lock", async (t) => {
  const started = deferred();
  const release = deferred();
  let refreshes = 0;
  let cookieVersion = 1;
  const csrfHeaders = [];
  const { lockNames } = install(t, async (url, options) => {
    if (url.endsWith("/probe")) return response(options.headers);
    assert.ok(url.endsWith("/auth/refresh"));
    const observedVersion = cookieVersion;
    csrfHeaders.push(options.headers["X-CSRFToken"]);
    refreshes++;
    if (refreshes === 1) {
      started.resolve();
      await release.promise;
    }
    if (observedVersion !== cookieVersion)
      return response({ code: "LOGIN_REVOKED" }, 401);
    cookieVersion++;
    document.cookie = "csrftoken=rotated-csrf";
    return response({ access_token: `access-${cookieVersion}` });
  });
  const [firstTab, secondTab] = await Promise.all([moduleForTab(), moduleForTab()]);
  const first = firstTab.refresh();
  await started.promise;
  const second = secondTab.refresh();
  await new Promise((done) => setImmediate(done));
  const callsBeforeRelease = refreshes;
  release.resolve();
  await Promise.all([first, second]);
  assert.equal(callsBeforeRelease, 1);
  assert.deepEqual(csrfHeaders, ["initial-csrf", "rotated-csrf"]);
  assert.equal(new Set(lockNames).size, 1);
  assert.equal(lockNames.length, 2);
  assert.equal((await firstTab.request("/probe")).Authorization, "Bearer access-2");
  assert.equal((await secondTab.request("/probe")).Authorization, "Bearer access-3");
});

test("one tab merges simultaneous refresh calls without Web Locks", async (t) => {
  const release = deferred();
  let calls = 0;
  install(t, async () => {
    calls++;
    await release.promise;
    return response({ access_token: "single-access" });
  }, false);
  const tab = await moduleForTab();
  const first = tab.refresh();
  const second = tab.refresh();
  await new Promise((done) => setImmediate(done));
  release.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

for (const withLocks of [true, false]) {
  test(`logout waits for an in-flight refresh and rejects its late access (${withLocks ? "Web Locks" : "fallback"})`, async (t) => {
    const started = deferred();
    const release = deferred();
    const order = [];
    let cookieVersion = 1;
    install(t, async (url, options) => {
      if (url.endsWith("/probe")) return response(options.headers);
      if (url.endsWith("/auth/refresh")) {
        order.push("refresh-start");
        started.resolve();
        await release.promise;
        cookieVersion = 2;
        order.push("refresh-end");
        return response({ access_token: "late-access" });
      }
      assert.ok(url.endsWith("/auth/logout"));
      order.push(`logout-cookie-${cookieVersion}`);
      cookieVersion = 0;
      return response(null, 204);
    }, withLocks);
    const tab = await moduleForTab();
    const refreshing = tab.refresh();
    const refreshRejected = assert.rejects(refreshing, authChanged);
    await started.promise;
    const loggingOut = tab.logout();
    release.resolve();
    await Promise.all([refreshRejected, loggingOut]);
    assert.deepEqual(order, ["refresh-start", "refresh-end", "logout-cookie-2"]);
    assert.equal(cookieVersion, 0);
    assert.equal((await tab.request("/probe", { retry: false })).Authorization, undefined);
  });
}

test("clearAuth cancels queued refresh before it can mutate the cookie", async (t) => {
  const release = deferred();
  let calls = 0;
  const { locks } = install(t, async () => {
    calls++;
    return response({ access_token: "unexpected" });
  });
  const tab = await moduleForTab();
  const holding = locks.request("dingdong-auth-session", () => release.promise);
  const refreshing = tab.refresh();
  const rejected = assert.rejects(refreshing, authChanged);
  tab.clearAuth();
  release.resolve();
  await Promise.all([holding, rejected]);
  assert.equal(calls, 0);
});

test("a new login replaces an older refresh without accepting its late access", async (t) => {
  const started = deferred();
  const release = deferred();
  install(t, async (url, options) => {
    if (url.endsWith("/probe")) return response(options.headers);
    if (url.endsWith("/auth/refresh")) {
      started.resolve();
      await release.promise;
      return response({ access_token: "old-access" });
    }
    assert.ok(url.endsWith("/auth/login"));
    return response({ access_token: "new-access", user: { id: "new-user" } });
  });
  const tab = await moduleForTab();
  const refreshing = tab.refresh();
  const rejected = assert.rejects(refreshing, authChanged);
  await started.promise;
  const login = tab.login("challenge", "code");
  release.resolve();
  await rejected;
  assert.deepEqual(await login, { id: "new-user" });
  assert.equal((await tab.request("/probe")).Authorization, "Bearer new-access");
});

test("clearAuth during login prevents the late login response restoring access", async (t) => {
  const started = deferred();
  const release = deferred();
  install(t, async (url, options) => {
    if (url.endsWith("/probe")) return response(options.headers);
    started.resolve();
    await release.promise;
    return response({ access_token: "late-login", user: { id: "old-user" } });
  });
  const tab = await moduleForTab();
  const loggingIn = tab.login("challenge", "code");
  const rejected = assert.rejects(loggingIn, authChanged);
  await started.promise;
  tab.clearAuth();
  release.resolve();
  await rejected;
  assert.equal((await tab.request("/probe", { retry: false })).Authorization, undefined);
});

test("failed logout reports the uncertain result and can be explicitly retried", async (t) => {
  let attempts = 0;
  install(t, async (url, options) => {
    if (url.endsWith("/probe")) return response(options.headers);
    if (url.endsWith("/auth/login"))
      return response({ access_token: "cached-access", user: { id: "user" } });
    assert.ok(url.endsWith("/auth/logout"));
    if (++attempts === 1) throw new Error("connection interrupted");
    return response(null, 204);
  });
  const tab = await moduleForTab();
  await tab.login("challenge", "code");
  await assert.rejects(tab.logout(), (error) => error.code === "NETWORK_ERROR");
  assert.equal((await tab.request("/probe", { retry: false })).Authorization, undefined);
  assert.equal(document.cookie, "csrftoken=initial-csrf");
  await tab.logout();
  assert.equal(attempts, 2);
});

test("clearAuth during CSRF initialization prevents a subsequent refresh write", async (t) => {
  const started = deferred();
  const release = deferred();
  let calls = 0;
  install(t, async (url) => {
    calls++;
    assert.ok(url.endsWith("/auth/csrf"));
    started.resolve();
    await release.promise;
    document.cookie = "csrftoken=initialized-csrf";
    return response({});
  });
  document.cookie = "";
  const tab = await moduleForTab();
  const refreshing = tab.refresh();
  const rejected = assert.rejects(refreshing, authChanged);
  await started.promise;
  tab.clearAuth();
  release.resolve();
  await rejected;
  assert.equal(calls, 1);
});

test("a late 401 from an old identity never refreshes or retries a write as the new user", async (t) => {
  const started = deferred();
  const release = deferred();
  let logins = 0;
  let writes = 0;
  let refreshes = 0;
  const writeIdentities = [];
  install(t, async (url, options) => {
    if (url.endsWith("/probe")) return response(options.headers);
    if (url.endsWith("/auth/login")) {
      logins++;
      return response({ access_token: `identity-${logins}`, user: { id: String(logins) } });
    }
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      return response({ access_token: "identity-2" });
    }
    assert.ok(url.endsWith("/write"));
    writes++;
    writeIdentities.push(options.headers.Authorization);
    if (writes > 1) return response({});
    started.resolve();
    await release.promise;
    return response({ code: "LOGIN_REVOKED" }, 401);
  });
  const tab = await moduleForTab();
  await tab.login("first-challenge", "code");
  const writing = tab.request("/write", { method: "POST", body: {} });
  const rejected = assert.rejects(writing, authChanged);
  await started.promise;
  await tab.login("second-challenge", "code");
  release.resolve();
  await rejected;
  assert.equal(writes, 1);
  assert.equal(refreshes, 0);
  assert.deepEqual(writeIdentities, ["Bearer identity-1"]);
  assert.equal((await tab.request("/probe")).Authorization, "Bearer identity-2");
});

for (const failure of ["network", 503, 401]) {
  test(`refresh failure ${failure} allows retry and only definitive revocation clears access`, async (t) => {
    let attempt = 0;
    install(t, async (url, options) => {
      if (url.endsWith("/probe")) return response(options.headers);
      if (url.endsWith("/auth/login"))
        return response({ access_token: "cached-access", user: { id: "user" } });
      assert.ok(url.endsWith("/auth/refresh"));
      if (++attempt === 1) {
        if (failure === "network") throw new Error("connection interrupted");
        return response({ code: "LOGIN_REVOKED" }, failure);
      }
      return response({ access_token: "retried-access" });
    });
    const tab = await moduleForTab();
    await tab.login("challenge", "code");
    await assert.rejects(tab.refresh(), (error) => error.status === (failure === "network" ? 0 : failure));
    assert.equal((await tab.request("/probe", { retry: false })).Authorization,
      failure === 401 ? undefined : "Bearer cached-access");
    assert.equal(document.cookie, "csrftoken=initial-csrf");
    await tab.refresh();
    assert.equal((await tab.request("/probe")).Authorization, "Bearer retried-access");
    assert.equal(attempt, 2);
  });
}

// Exercise the real page error boundary without booting the DOM or business APIs.
function pageErrorBoundary() {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const start = app.indexOf("function showError(e) {");
  const end = app.indexOf("function busyButton(", start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const handler = runInNewContext(`${app.slice(start, end)}; showError`, {
    forget: () => calls.push("forget"),
    loginPage: () => calls.push("loginPage"),
    toast: (message) => calls.push(message),
    $: () => { throw new Error("An obsolete operation must not touch the current page"); },
  });
  return { handler, calls };
}

test("obsolete authentication cancellation leaves the current login and page intact", () => {
  const { handler, calls } = pageErrorBoundary();
  handler({ status: 0, code: "AUTH_STATE_CHANGED", message: "登录状态已改变。" });
  assert.deepEqual(calls, []);
});

test("the page still clears login on a genuine server revocation", () => {
  const { handler, calls } = pageErrorBoundary();
  handler({ status: 401, code: "LOGIN_REVOKED" });
  assert.deepEqual(calls, ["forget", "loginPage", "登录已失效，请重新登录。"]);
});
