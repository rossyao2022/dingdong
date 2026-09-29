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
