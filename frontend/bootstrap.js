// This loader intentionally has no static imports: a stale dependency must not
// prevent it from giving the parent a way to recover. Never alter the NFC URL here.
export function showStartupFailure(
  doc = document,
  reload = () => location.reload(),
) {
  const main = doc.getElementById("main");
  if (!main) return;
  const environment = doc.getElementById("environment");
  if (environment) environment.hidden = true;
  const panel = doc.createElement("section");
  panel.className = "empty-state";
  panel.setAttribute("role", "alert");
  const title = doc.createElement("h1");
  title.textContent = "页面暂时没有加载成功";
  const description = doc.createElement("p");
  description.textContent = "请点击下方按钮重新加载。";
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "button";
  button.textContent = "重新加载页面";
  button.addEventListener("click", reload);
  panel.append(title, description, button);
  main.replaceChildren(panel);
  main.setAttribute("aria-busy", "false");
}

export async function startApp({
  load = () => import("./app.js?v=0.3.25"),
  onFailure = showStartupFailure,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  timeout = 20000,
} = {}) {
  let shown = false;
  const fail = () => {
    if (shown) return;
    shown = true;
    onFailure();
  };
  const timer = setTimer(fail, timeout);
  try {
    const app = await load();
    // Import success alone does not mean the first API read/render has completed.
    await app.appReady;
    return true;
  } catch {
    fail();
    return false;
  } finally {
    clearTimer(timer);
  }
}

if (typeof document !== "undefined") {
  clearTimeout(window.dingdongStartupTimer);
  delete window.dingdongStartupTimer;
  startApp();
}
