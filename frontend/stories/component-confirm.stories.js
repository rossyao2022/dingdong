import { confirmDialog, confirmDialogMarkup } from "../ui-components.js";
const options = {
  title: "调整兴趣组合？",
  message: "调整组合会开始一次新的探索。原来的回答和结果仍会保留。",
  confirmLabel: "调整组合",
  cancelLabel: "保留原组合",
};
export default { title: "家长端/组件确认", tags: ["autodocs"] };
export const Content = {
  name: "兴趣组合确认内容",
  render: () => {
    const container = document.createElement("div");
    container.innerHTML = confirmDialogMarkup(options);
    const dialog = container.firstElementChild;
    dialog.setAttribute("open", "");
    dialog.style.position = "relative";
    return container;
  },
};
export const Interactive = {
  name: "确认、取消与 Esc",
  render: () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<button class="button" type="button">调整兴趣组合</button><p role="status"></p>';
    container.querySelector("button").addEventListener("click", async () => {
      const accepted = await confirmDialog(options);
      container.querySelector('[role="status"]').textContent = accepted
        ? "已确认调整组合"
        : "已保留原组合";
    });
    return container;
  },
};
