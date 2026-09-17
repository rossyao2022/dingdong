document.addEventListener("DOMContentLoaded", () => {
  const editForm = document.querySelector("#questionnaireversion_form");
  if (editForm)
    editForm.addEventListener("input", (event) => {
      if (event.target.closest(".question-preview")) return;
      const publish = document.querySelector(
        '.ca-action[data-url$="/publish"]',
      );
      if (publish) {
        publish.disabled = true;
        document.getElementById("ca-action-result").textContent =
          "有尚未保存的编辑，请先保存草稿，再发布此版本。";
      }
    });
  document.querySelectorAll(".ca-action").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = document.getElementById("ca-action-result");
      const panel = document.getElementById("ca-action-panel");
      const payload = button.dataset.roles
        ? {
            role_codes: [...panel.querySelectorAll(".ca-role:checked")].map(
              (x) => x.value,
            ),
          }
        : JSON.parse(button.dataset.payload);
      button.disabled = true;
      result.textContent = "正在处理…";
      try {
        const response = await fetch(button.dataset.url, {
          method: button.dataset.method,
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": panel.querySelector("[name=csrfmiddlewaretoken]")
              .value,
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.code);
        window.location.reload();
      } catch (error) {
        result.textContent = error.message || "操作失败，请刷新后重试。";
        button.disabled = false;
      }
    });
  });
});
