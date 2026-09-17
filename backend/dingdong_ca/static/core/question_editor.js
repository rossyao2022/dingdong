(() => {
  const el = (tag, text) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    return n;
  };
  document.addEventListener("DOMContentLoaded", () =>
    document.querySelectorAll(".question-editor").forEach((root) => {
      const store = root.querySelector("textarea");
      let questions;
      try {
        questions = JSON.parse(store.value);
      } catch {
        questions = [];
      }
      if (!Array.isArray(questions)) questions = [];
      const rows = root.querySelector(".question-rows");
      const save = () => {
        store.value = JSON.stringify(questions);
        store.dispatchEvent(new Event("input", { bubbles: true }));
      };
      function field(parent, label, value, change, type = "text") {
        const wrap = el("label", label);
        const input = el("input");
        input.type = type;
        input.setAttribute("aria-label", label);
        if (type === "checkbox") input.checked = value;
        else input.value = value;
        input.addEventListener("input", () => {
          change(type === "checkbox" ? input.checked : input.value);
          save();
        });
        wrap.append(input);
        parent.append(wrap);
        return input;
      }
      function button(parent, label, action) {
        const b = el("button", label);
        b.type = "button";
        b.addEventListener("click", action);
        parent.append(b);
        return b;
      }
      function render() {
        rows.replaceChildren();
        questions.forEach((q, i) => {
          const card = el("fieldset");
          card.append(el("legend", `第 ${i + 1} 题`));
          field(card, "题干", q.title, (v) => (q.title = v));
          const label = el("label", "题型");
          const select = el("select");
          select.setAttribute("aria-label", "题型");
          [
            ["single_choice", "单选"],
            ["multiple_choice", "多选"],
          ].forEach(([v, t]) => {
            const o = el("option", t);
            o.value = v;
            o.selected = q.type === v;
            select.append(o);
          });
          select.onchange = () => {
            q.type = select.value;
            q.min_choices = 1;
            q.max_choices = q.type === "single_choice" ? 1 : q.options.length;
            save();
            render();
          };
          label.append(select);
          card.append(label);
          field(card, "必填", q.required, (v) => (q.required = v), "checkbox");
          if (q.type === "multiple_choice")
            field(
              card,
              "最多选择",
              q.max_choices,
              (v) => (q.max_choices = Number(v)),
              "number",
            );
          q.options.forEach((o, j) => {
            const row = el("div");
            field(row, `选项 ${j + 1}`, o.label, (v) => (o.label = v));
            button(row, "删除选项", () => {
              q.options.splice(j, 1);
              q.max_choices = Math.min(q.max_choices, q.options.length);
              save();
              render();
            });
            card.append(row);
          });
          button(card, "添加选项", () => {
            q.options.push({
              code: "O" + crypto.randomUUID().replaceAll("-", "").slice(0, 12),
              label: "",
            });
            save();
            render();
          });
          button(card, "上移", () => {
            if (i) {
              [questions[i - 1], questions[i]] = [
                questions[i],
                questions[i - 1],
              ];
              save();
              render();
            }
          }).disabled = i === 0;
          button(card, "下移", () => {
            if (i < questions.length - 1) {
              [questions[i + 1], questions[i]] = [
                questions[i],
                questions[i + 1],
              ];
              save();
              render();
            }
          }).disabled = i === questions.length - 1;
          button(card, "删除题目", () => {
            questions.splice(i, 1);
            save();
            render();
          });
          rows.append(card);
        });
      }
      root.querySelector(".add-question").onclick = () => {
        questions.push({
          code: "Q" + crypto.randomUUID().replaceAll("-", "").slice(0, 12),
          title: "",
          type: "single_choice",
          required: true,
          min_choices: 1,
          max_choices: 1,
          options: [
            { code: "A", label: "" },
            { code: "B", label: "" },
          ],
        });
        save();
        render();
      };
      root.querySelector(".preview-questions").onclick = () => {
        const preview = root.querySelector(".question-preview");
        preview.replaceChildren(el("h2", "家长视角预览 · 未发布草稿"));
        questions.forEach((q, i) => {
          preview.append(
            el("h3", `${i + 1}. ${q.title}（${q.required ? "必填" : "选填"}）`),
          );
          q.options.forEach((o) => {
            const label = el("label", o.label);
            const input = el("input");
            input.type = q.type === "single_choice" ? "radio" : "checkbox";
            input.name = "preview-" + q.code;
            label.prepend(input);
            preview.append(label);
          });
        });
        preview.hidden = false;
        preview.scrollIntoView({ behavior: "smooth" });
      };
      render();
    }),
  );
})();
