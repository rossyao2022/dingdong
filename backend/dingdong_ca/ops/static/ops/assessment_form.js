/* Copy the validated snapshot; support the console's existing HTTP environment. */
(() => {
  const button = document.querySelector("#assessment-form-copy");
  if (!button) return;
  const textarea = document.querySelector("#assessment-form-text");
  const status = document.querySelector("#assessment-copy-status");
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "正在复制…";
    try {
      const response = await fetch(button.dataset.copyUrl, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/plain")) {
        throw new Error("记录已更新或链接已过期，请重新打开测评表单。");
      }
      const text = await response.text();
      textarea.value = text;
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(text); copied = true; } catch (_) { /* Fall through to manual selection. */ }
      }
      if (!copied) {
        textarea.focus();
        textarea.select();
        copied = document.execCommand("copy");
      }
      status.textContent = copied ? "已复制，可以直接粘贴发送。" : "已选中表单，请长按或使用复制快捷键。";
    } catch (error) {
      status.textContent = error.message || "复制未完成，请重新打开表单。";
    } finally { button.disabled = false; }
  });
})();
