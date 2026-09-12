/* 活动可视化编辑器：标题、说明、材料、步骤和展示状态，运营不需要写 JSON。 */
(function () {
  const dataNode = document.getElementById("activity-data");
  const listNode = document.getElementById("steps");
  const config = document.getElementById("activity-config");
  if (!dataNode || !listNode || !config) return;

  const state = JSON.parse(dataNode.textContent) || {};
  if (!state.content || typeof state.content !== "object") state.content = {};
  const content = state.content;
  content.steps = Array.isArray(content.steps) ? content.steps : [];
  content.allowed_styles = Array.isArray(content.allowed_styles) ? content.allowed_styles : [];
  const status = config.dataset.status;
  const editable = config.dataset.editable === "1";
  const endpoints = {
    save: config.dataset.saveUrl,
    check: config.dataset.checkUrl,
    publish: config.dataset.publishUrl,
    copy: config.dataset.copyUrl,
    retire: config.dataset.retireUrl,
    list: config.dataset.listUrl,
  };
  const STYLES = [
    ["cognitive", "认知"],
    ["emotional", "情绪"],
    ["creative", "创造"],
    ["exploratory", "探索"],
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, onClick, title) {
    const node = el("button", className || "icon-btn", label);
    node.type = "button";
    if (title) node.title = title;
    node.addEventListener("click", onClick);
    return node;
  }

  function touch() {
    window.Ops.markDirty();
  }

  function stepCard(step, index) {
    const card = el("div", "step-card");
    const head = el("div", "question-head");
    head.appendChild(el("span", "idx", "第 " + (index + 1) + " 步"));
    head.appendChild(el("span", "spacer"));
    if (editable) {
      head.appendChild(button("↑", "icon-btn", function () {
        if (index === 0) return;
        content.steps.splice(index - 1, 0, content.steps.splice(index, 1)[0]);
        touch();
        render();
      }, "上移"));
      head.appendChild(button("↓", "icon-btn", function () {
        if (index === content.steps.length - 1) return;
        content.steps.splice(index + 1, 0, content.steps.splice(index, 1)[0]);
        touch();
        render();
      }, "下移"));
      head.appendChild(button("删除", "btn btn-sm", function () {
        content.steps.splice(index, 1);
        touch();
        render();
      }));
    }
    card.appendChild(head);

    const instructionRow = el("div", "form-row");
    instructionRow.appendChild(el("label", null, "家长指引（这一步要做什么）"));
    const instruction = el("textarea");
    instruction.value = step.instruction || "";
    instruction.placeholder = "例如：和孩子一起在小区里找三种不同的叶子。";
    instruction.disabled = !editable;
    instruction.addEventListener("input", function () {
      step.instruction = instruction.value;
      touch();
    });
    instructionRow.appendChild(instruction);
    card.appendChild(instructionRow);

    const guideRow = el("div", "form-row");
    guideRow.appendChild(el("label", null, "引导语（家长可以这样说）"));
    const guide = el("textarea");
    guide.value = step.guide_text || "";
    guide.placeholder = "例如：你摸一摸，这片叶子和刚才那片有什么不一样？";
    guide.disabled = !editable;
    guide.addEventListener("input", function () {
      step.guide_text = guide.value;
      touch();
    });
    guideRow.appendChild(guide);
    card.appendChild(guideRow);
    return card;
  }

  function render() {
    listNode.innerHTML = "";
    if (!content.steps.length) {
      listNode.appendChild(el("p", "table-empty", "还没有步骤。点击“添加步骤”开始。"));
      return;
    }
    content.steps.forEach(function (step, index) {
      listNode.appendChild(stepCard(step, index));
    });
  }

  function collect() {
    return {
      title: document.getElementById("a-title").value,
      island: document.getElementById("a-island").value,
      mood: document.getElementById("a-mood").value,
      duration_minutes: parseInt(document.getElementById("a-duration").value, 10),
      content: {
        materials: document.getElementById("a-materials").value,
        goal: document.getElementById("a-goal").value,
        alternative: document.getElementById("a-alternative").value,
        allowed_styles: content.allowed_styles.slice(),
        steps: content.steps.map(function (step, index) {
          return { index: index, instruction: step.instruction || "", guide_text: step.guide_text || "" };
        }),
      },
    };
  }

  function showProblems(problems) {
    const box = document.getElementById("problems");
    box.innerHTML = "";
    box.hidden = !problems.length;
    if (!problems.length) return;
    const notice = el("div", "notice notice-warn");
    notice.appendChild(el("strong", null, "还不能发布，请先处理以下问题："));
    const list = el("ul");
    problems.forEach(function (text) {
      list.appendChild(el("li", null, text));
    });
    notice.appendChild(list);
    box.appendChild(notice);
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function save(silent) {
    const button = document.getElementById("save");
    const result = await window.Ops.act({
      url: endpoints.save,
      body: collect(),
      button: button,
      success: silent ? false : "草稿已保存。",
    });
    if (result) {
      window.Ops.markClean();
    }
    return result;
  }

  document.querySelectorAll("[data-style]").forEach(function (input) {
    input.disabled = !editable;
    input.checked = content.allowed_styles.indexOf(input.dataset.style) >= 0;
    input.addEventListener("change", function () {
      const index = content.allowed_styles.indexOf(input.dataset.style);
      if (input.checked && index < 0) content.allowed_styles.push(input.dataset.style);
      if (!input.checked && index >= 0) content.allowed_styles.splice(index, 1);
      touch();
    });
  });

  const addStep = document.getElementById("add-step");
  if (addStep) {
    addStep.addEventListener("click", function () {
      content.steps.push({ instruction: "", guide_text: "" });
      touch();
      render();
    });
  }

  ["a-title", "a-island", "a-mood", "a-duration", "a-materials", "a-goal", "a-alternative"].forEach(
    function (id) {
      const node = document.getElementById(id);
      if (node) node.addEventListener("input", touch);
    }
  );

  const saveButton = document.getElementById("save");
  if (saveButton) {
    saveButton.addEventListener("click", function () {
      save(false);
    });
  }

  const previewButton = document.getElementById("preview");
  if (previewButton) {
    previewButton.addEventListener("click", async function () {
      const result = await save(true);
      if (result) {
        window.open(document.getElementById("preview-url").value, "_blank");
        window.Ops.toast("草稿已保存，已打开预览。", "ok");
      }
    });
  }

  const publishButton = document.getElementById("publish");
  if (publishButton) {
    publishButton.addEventListener("click", async function () {
      const saved = await save(true);
      if (!saved) return;
      const check = await window.Ops.request(endpoints.check, { method: "POST", body: {} });
      showProblems(check.problems || []);
      if ((check.problems || []).length) {
        window.Ops.toast("发布前检查未通过，请按提示修改。", "error");
        return;
      }
      const agreed = await window.Ops.confirm({
        title: "发布活动版本",
        message: "发布后家长端将展示《" + saved.activity.title + "》" + saved.activity.version + "。",
        impacts: [
          "同一活动当前已发布的版本会被自动停用",
          "已经开始或已经完成的活动记录仍然指向原版本，内容不会被改写",
          "发布后该版本不可再编辑",
        ],
        confirmLabel: "确认发布",
      });
      if (!agreed) return;
      await window.Ops.act({
        url: endpoints.publish,
        body: {},
        button: publishButton,
        success: "活动版本已发布。",
        redirect: endpoints.list,
      });
    });
  }

  const copyButton = document.getElementById("copy");
  if (copyButton) {
    copyButton.addEventListener("click", async function () {
      const version = await window.Ops.prompt({
        title: "复制为新版本",
        message: "复制会创建一个可编辑的草稿，内容与当前版本一致。",
        label: "新版本号（留空自动生成）",
        placeholder: "例如 v3",
        confirmLabel: "复制",
      });
      if (version === null) return;
      await window.Ops.act({
        url: endpoints.copy,
        body: { version: version },
        button: copyButton,
        success: "已创建草稿。",
        after: function (data) {
          window.location.href = data.redirect;
        },
      });
    });
  }

  const retireButton = document.getElementById("retire");
  if (retireButton) {
    retireButton.addEventListener("click", async function () {
      const agreed = await window.Ops.confirm({
        title: "停用活动版本",
        message: "停用后该版本不再作为新的活动内容。",
        impacts: [
          status === "published" ? "该活动将没有已发布版本，家长端会暂时看不到对应活动" : "草稿停用后仍保留在列表中",
          "已经开始或已完成的记录不受影响",
        ],
        confirmLabel: "确认停用",
        danger: true,
      });
      if (!agreed) return;
      await window.Ops.act({
        url: endpoints.retire,
        body: {},
        button: retireButton,
        success: "已停用。",
        redirect: endpoints.list,
      });
    });
  }

  render();
})();
