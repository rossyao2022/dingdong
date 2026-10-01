/** Shared HTML fragments used by the parent app and its Storybook. */
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function button(action, label, data = "", secondary = false) {
  return `<button type="button" class="button ${secondary ? "secondary" : ""}" data-action="${esc(action)}" ${data}>${label}</button>`;
}

export function actions(...items) {
  return `<div class="actions">${items.join("")}</div>`;
}

export function panel(title, body, className = "") {
  return `<section class="panel${className ? ` ${esc(className)}` : ""}"><h2>${esc(title)}</h2>${body}</section>`;
}

export function pageHead(
  title,
  desc = "",
  action = "",
  childName = "DINGDONG",
) {
  return `<div class="page-head"><div><span class="eyebrow">${esc(childName)} · 成长空间</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${action}</div>`;
}

export function emptyState(title, text, action = "") {
  return `<div class="empty"><img src="assets/dingdong/robot-front.webp" alt=""><h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`;
}

/** The same accessible confirmation content is used by the app and Storybook. */
export function confirmDialogMarkup({
  title = "继续操作？",
  message = "",
  confirmLabel = "继续",
  cancelLabel = "取消",
} = {}) {
  return `<dialog class="component-confirm" role="alertdialog" aria-labelledby="component-confirm-title" aria-describedby="component-confirm-message"><div class="dialog-wrap"><div class="dialog-top"><h2 id="component-confirm-title">${esc(title)}</h2><button type="button" class="button secondary component-confirm-close" data-confirm-choice="cancel" aria-label="关闭确认">关闭</button></div><p id="component-confirm-message">${esc(message)}</p><div class="actions"><button type="button" class="button secondary" data-confirm-choice="cancel" autofocus>${esc(cancelLabel)}</button><button type="button" class="button" data-confirm-choice="accept">${esc(confirmLabel)}</button></div></div></dialog>`;
}

let pendingConfirmation = null;

/** Leaving a page, child or login context always means cancelling, never accepting. */
export function cancelConfirmDialogs() {
  pendingConfirmation?.();
}

/** Local dialog events stay responsive while the caller awaits inside app.act(). */
export function confirmDialog(options = {}) {
  cancelConfirmDialogs();
  const host = document.createElement("div");
  host.innerHTML = confirmDialogMarkup(options);
  const dialog = host.firstElementChild;
  const previousFocus = document.activeElement;
  document.body.append(dialog);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted) => {
      if (settled) return;
      settled = true;
      dialog.removeEventListener("click", click);
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("close", cancel);
      window.removeEventListener("pagehide", cancel);
      if (pendingConfirmation === cancel) pendingConfirmation = null;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected && !previousFocus.disabled)
        previousFocus.focus({ preventScroll: true });
      resolve(accepted);
    };
    const cancel = () => finish(false);
    const click = (event) => {
      const choice = event.target.closest?.("[data-confirm-choice]");
      if (!choice || !dialog.contains(choice)) return;
      event.preventDefault();
      event.stopPropagation();
      finish(choice.dataset.confirmChoice === "accept");
    };
    dialog.addEventListener("click", click);
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("close", cancel);
    window.addEventListener("pagehide", cancel);
    pendingConfirmation = cancel;
    dialog.showModal();
    dialog.querySelector("[autofocus]").focus();
  });
}
