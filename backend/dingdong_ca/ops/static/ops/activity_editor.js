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
  /* 修订号：本页内容基于哪一版。保存时回传，服务端据此判断是否有人先改过。 */
  let revision = parseInt(config.dataset.revision, 10);
  if (isNaN(revision) || revision < 1) revision = 1;
  let copyRequestKey = null;
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
    const node = el("button", className || "btn btn-sm btn-icon", label);
    node.type = "button";
    if (title) node.title = title;
    node.addEventListener("click", onClick);
    return node;
  }

  /* 空状态统一走界面组件体系的 .empty。 */
  function emptyState(title, note) {
    const box = el("div", "empty");
    box.appendChild(el("p", "empty-title", title));
    if (note) box.appendChild(el("p", "empty-subtitle text-secondary", note));
    return box;
  }

  function touch() {
    window.Ops.markDirty();
  }

  function stepCard(step, index) {
    /* 视觉外壳来自组件库的 .card；.step-card 只保留"这是一个步骤"的语义。 */
    const card = el("div", "card step-card");
    const body = el("div", "card-body");
    const head = el("div", "ops-editor-head");
    head.appendChild(el("span", "idx", "第 " + (index + 1) + " 步"));
    head.appendChild(el("span", "ops-editor-spacer"));
    if (editable) {
      head.appendChild(button("↑", "btn btn-sm btn-icon", function () {
        if (index === 0) return;
        content.steps.splice(index - 1, 0, content.steps.splice(index, 1)[0]);
        touch();
        render();
      }, "上移"));
      head.appendChild(button("↓", "btn btn-sm btn-icon", function () {
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
    body.appendChild(head);

    const instructionRow = el("div", "mb-3");
    instructionRow.appendChild(el("label", "form-label", "家长指引（这一步要做什么）"));
    const instruction = el("textarea", "form-control");
    instruction.value = step.instruction || "";
    instruction.placeholder = "例如：和孩子一起在小区里找三种不同的叶子。";
    instruction.disabled = !editable;
    instruction.addEventListener("input", function () {
      step.instruction = instruction.value;
      touch();
    });
    instructionRow.appendChild(instruction);
    body.appendChild(instructionRow);

    const guideRow = el("div", "mb-0");
    guideRow.appendChild(el("label", "form-label", "引导语（家长可以这样说）"));
    const guide = el("textarea", "form-control");
    guide.value = step.guide_text || "";
    guide.placeholder = "例如：你摸一摸，这片叶子和刚才那片有什么不一样？";
    guide.disabled = !editable;
    guide.addEventListener("input", function () {
      step.guide_text = guide.value;
      touch();
    });
    guideRow.appendChild(guide);
    body.appendChild(guideRow);

    card.appendChild(body);
    return card;
  }

  function render() {
    listNode.innerHTML = "";
    if (!content.steps.length) {
      listNode.appendChild(emptyState("还没有步骤", "点击“添加步骤”开始。"));
      return;
    }
    content.steps.forEach(function (step, index) {
      listNode.appendChild(stepCard(step, index));
    });
  }

  function collect() {
    return {
      revision: revision,
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
    const notice = el("div", "alert alert-warning");
    notice.setAttribute("role", "alert");
    notice.appendChild(el("strong", null, "还不能发布，请先处理以下问题："));
    const list = el("ul", "mb-0");
    problems.forEach(function (text) {
      list.appendChild(el("li", null, text));
    });
    notice.appendChild(list);
    box.appendChild(notice);
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ---------------------------------------------------------------- 保存冲突 */

  const conflictBox = document.getElementById("conflict");

  function diffAgainst(current) {
    const local = collect();
    const remote = current.content || {};
    const rows = [];
    if ((local.title || "") !== (current.title || "")) {
      rows.push(
        "活动标题：你填写的是「" +
          (local.title || "（空）") +
          "」，服务端最新是「" +
          (current.title || "（空）") +
          "」"
      );
    }
    if ((local.island || "") !== (current.island || "")) rows.push("所属岛屿与服务端最新版本不同");
    if ((local.mood || "") !== (current.mood || "")) rows.push("情绪标签与服务端最新版本不同");
    if (local.duration_minutes !== current.duration_minutes) {
      rows.push(
        "时长：你填写 " + local.duration_minutes + " 分钟，服务端最新 " + current.duration_minutes + " 分钟"
      );
    }
    if ((local.content.goal || "") !== (remote.goal || "")) rows.push("活动目标与服务端最新版本不同");
    if ((local.content.materials || "") !== (remote.materials || "")) rows.push("材料说明与服务端最新版本不同");
    if (
      (local.content.alternative || "") !== (remote.alternative || "")
    ) {
      rows.push("备选方案与服务端最新版本不同");
    }
    const localSteps = local.content.steps.length;
    const remoteSteps = (remote.steps || []).length;
    if (localSteps !== remoteSteps) {
      rows.push("步骤数量：你这边 " + localSteps + " 步，服务端最新 " + remoteSteps + " 步");
    } else if (localSteps) {
      let changed = 0;
      local.content.steps.forEach(function (step, index) {
        if ((step.instruction || "") !== ((remote.steps[index] || {}).instruction || "")) changed += 1;
      });
      if (changed) rows.push("有 " + changed + " 个步骤的家长指引与服务端最新版本不同");
    }
    return rows;
  }

  function applyLatest(current) {
    document.getElementById("a-title").value = current.title || "";
    document.getElementById("a-island").value = current.island || "";
    document.getElementById("a-mood").value = current.mood || "";
    document.getElementById("a-duration").value = current.duration_minutes || 1;
    const remote = current.content || {};
    document.getElementById("a-goal").value = remote.goal || "";
    document.getElementById("a-materials").value = remote.materials || "";
    document.getElementById("a-alternative").value = remote.alternative || "";
    content.allowed_styles = (remote.allowed_styles || []).slice();
    content.steps = JSON.parse(JSON.stringify(remote.steps || []));
    document.querySelectorAll("[data-style]").forEach(function (input) {
      input.checked = content.allowed_styles.indexOf(input.dataset.style) >= 0;
    });
    revision = current.revision;
    conflictBox.hidden = true;
    conflictBox.innerHTML = "";
    window.Ops.markClean();
    render();
  }

  async function overwriteWithLocal(current) {
    revision = current.revision;
    const result = await window.Ops.act({
      url: endpoints.save,
      body: collect(),
      button: document.getElementById("save"),
      success: "已按你的内容保存，服务端最新版本被覆盖。",
    });
    if (result && result.activity) {
      revision = result.activity.revision;
      conflictBox.hidden = true;
      conflictBox.innerHTML = "";
      window.Ops.markClean();
    }
    return result;
  }

  function showConflict(current) {
    if (!conflictBox) return;
    conflictBox.innerHTML = "";
    conflictBox.hidden = false;
    conflictBox.appendChild(
      window.Ops.notice({
        kind: "danger",
        title: "保存冲突：这个活动在你编辑期间已被其他人保存",
        message:
          "为避免覆盖对方的修改，本次没有保存。你页面上的内容仍然保留，可以对比差异后再决定下一步。",
        actions: [
          {
            label: "查看差异",
            onClick: function () {
              const rows = diffAgainst(current);
              window.Ops.alert({
                title: "你的修改与服务端最新版本的差异",
                message: "下面是主要差异。完整内容可以用「加载最新版本」查看。",
                impacts: rows.length ? rows : ["没有明显差异：对方可能修改了步骤顺序或引导语。"],
              });
            },
          },
          {
            label: "加载最新版本（放弃我的修改）",
            onClick: function () {
              window.Ops.confirm({
                title: "加载服务端最新版本",
                message: "加载后你会丢失当前页面上尚未保存的内容，确定继续吗？",
                confirmLabel: "加载最新版本",
              }).then(function (agreed) {
                if (agreed) applyLatest(current);
              });
            },
          },
          {
            label: "用我的内容覆盖最新版本",
            primary: true,
            onClick: function () {
              window.Ops.confirm({
                title: "用我的内容覆盖",
                message: "这会用你页面上的内容覆盖服务端最新版本，对方的修改会丢失。确定继续吗？",
                impacts: ["仅在你确认自己的版本应该取代对方时才这样做"],
                confirmLabel: "确认覆盖",
                danger: true,
              }).then(function (agreed) {
                if (agreed) overwriteWithLocal(current);
              });
            },
          },
        ],
      })
    );
    conflictBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function save(silent) {
    const button = document.getElementById("save");
    const result = await window.Ops.act({
      url: endpoints.save,
      body: collect(),
      button: button,
      success: silent ? false : "草稿已保存。",
      onError: function (error) {
        if (error && error.code === "EDIT_CONFLICT") showConflict(error.current || {});
      },
    });
    if (result && result.activity) {
      if (typeof result.activity.revision === "number") revision = result.activity.revision;
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
      /* 版本号由系统递增，运营不需要手工管理技术编号。 */
      const agreed = await window.Ops.confirm({
        title: "复制为新版本",
        message: "复制会创建一个可编辑的草稿，内容与当前版本一致，版本号由系统自动递增。",
        impacts: [
          "当前版本保持原样，已经开始或完成的活动记录仍绑定它",
          "发布新版本时，该活动原有的已发布版本会自动停用",
        ],
        confirmLabel: "复制",
      });
      if (!agreed) return;
      if (!copyRequestKey) copyRequestKey = window.Ops.requestId();
      const result = await window.Ops.act({
        url: endpoints.copy,
        body: { request_key: copyRequestKey },
        button: copyButton,
        success: false,
      });
      if (result && result.redirect) {
        copyRequestKey = null;
        window.Ops.toast("已创建草稿 " + (result.version || "") + "。", "ok");
        window.setTimeout(function () {
          window.location.href = result.redirect;
        }, 700);
      }
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
