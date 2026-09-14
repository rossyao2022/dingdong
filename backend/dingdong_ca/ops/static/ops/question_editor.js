/* 题库可视化编辑器：运营只操作题干、选项、顺序和必填规则，不接触 JSON。 */
(function () {
  const dataNode = document.getElementById("questionnaire-data");
  const listNode = document.getElementById("questions");
  const config = document.getElementById("questionnaire-config");
  if (!dataNode || !listNode || !config) return;

  const state = JSON.parse(dataNode.textContent) || {};
  if (!Array.isArray(state.questions)) state.questions = [];
  const status = config.dataset.status;
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
  const editable = config.dataset.editable === "1";

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

  /* 空状态统一走界面组件体系的 .empty，不再自己拼一行灰字。 */
  function emptyState(title, note) {
    const box = el("div", "empty");
    box.appendChild(el("p", "empty-title", title));
    if (note) box.appendChild(el("p", "empty-subtitle text-secondary", note));
    return box;
  }

  function touch() {
    window.Ops.markDirty();
  }

  function questionCard(question, index) {
    /* 视觉外壳来自组件库的 .card；.question-card 只负责"这是一道题"的语义与左侧色条。 */
    const card = el("div", "card question-card");
    card.dataset.index = String(index);
    const body = el("div", "card-body");

    const head = el("div", "ops-editor-head");
    head.appendChild(el("span", "idx", "第 " + (index + 1) + " 题"));

    const typeSelect = el("select", "form-select form-select-sm w-auto");
    typeSelect.setAttribute("aria-label", "题型");
    [
      ["single_choice", "单选"],
      ["multiple_choice", "多选"],
    ].forEach(function (pair) {
      const option = el("option", null, pair[1]);
      option.value = pair[0];
      if (question.type === pair[0]) option.selected = true;
      typeSelect.appendChild(option);
    });
    typeSelect.disabled = !editable;
    typeSelect.addEventListener("change", function () {
      question.type = typeSelect.value;
      if (question.type === "single_choice") {
        question.min_choices = 1;
        question.max_choices = 1;
      } else {
        question.min_choices = Math.min(question.min_choices || 1, question.options.length);
        question.max_choices = Math.max(question.min_choices, question.options.length);
      }
      touch();
      render();
    });
    head.appendChild(typeSelect);

    const requiredLabel = el("label", "form-check m-0");
    requiredLabel.style.display = "flex";
    requiredLabel.style.alignItems = "center";
    requiredLabel.style.gap = "6px";
    const required = el("input", "form-check-input");
    required.type = "checkbox";
    required.checked = !!question.required;
    required.disabled = !editable;
    required.addEventListener("change", function () {
      question.required = required.checked;
      touch();
    });
    requiredLabel.appendChild(required);
    requiredLabel.appendChild(document.createTextNode("必填"));
    head.appendChild(requiredLabel);

    head.appendChild(el("span", "ops-editor-spacer"));
    if (editable) {
      head.appendChild(button("↑", "btn btn-sm btn-icon", function () {
        if (index === 0) return;
        state.questions.splice(index - 1, 0, state.questions.splice(index, 1)[0]);
        touch();
        render();
      }, "上移"));
      head.appendChild(button("↓", "btn btn-sm btn-icon", function () {
        if (index === state.questions.length - 1) return;
        state.questions.splice(index + 1, 0, state.questions.splice(index, 1)[0]);
        touch();
        render();
      }, "下移"));
      head.appendChild(button("删除", "btn btn-sm", function () {
        window.Ops.confirm({
          title: "删除第 " + (index + 1) + " 题",
          message: "删除后需要重新填写该题。",
          confirmLabel: "删除",
          danger: true,
        }).then(function (agreed) {
          if (!agreed) return;
          state.questions.splice(index, 1);
          touch();
          render();
        });
      }, "删除题目"));
    }
    body.appendChild(head);

    const titleRow = el("div", "mb-3");
    const title = el("textarea", "form-control");
    title.value = question.title || "";
    title.placeholder = "题干，例如：遇到一件从没见过的小玩意儿，你更想先……";
    title.disabled = !editable;
    title.addEventListener("input", function () {
      question.title = title.value;
      touch();
    });
    titleRow.appendChild(title);
    body.appendChild(titleRow);

    const optionsBox = el("div");
    question.options.forEach(function (option, optionIndex) {
      const row = el("div", "option-row");
      row.appendChild(el("span", "idx", String(optionIndex + 1)));
      const input = el("input", "form-control");
      input.type = "text";
      input.value = option.label || "";
      input.placeholder = "选项文字";
      input.disabled = !editable;
      input.addEventListener("input", function () {
        option.label = input.value;
        touch();
      });
      row.appendChild(input);
      if (editable && question.options.length > 1) {
        row.appendChild(button("删除", "btn btn-sm", function () {
          question.options.splice(optionIndex, 1);
          if (question.max_choices > question.options.length) {
            question.max_choices = question.options.length;
          }
          if (question.min_choices > question.max_choices) {
            question.min_choices = question.max_choices;
          }
          touch();
          render();
        }));
      }
      optionsBox.appendChild(row);
    });
    body.appendChild(optionsBox);

    if (editable) {
      const addOption = button("添加选项", "btn btn-sm", function () {
        question.options.push({ code: "O" + (question.options.length + 1), label: "" });
        if (question.type === "multiple_choice") {
          question.max_choices = question.options.length;
        }
        touch();
        render();
      });
      body.appendChild(addOption);
    }

    if (question.type === "multiple_choice") {
      const range = el("div", "row g-2 align-items-end mt-3");
      [
        ["min_choices", "最少选择"],
        ["max_choices", "最多选择"],
      ].forEach(function (pair) {
        const field = el("div", "col-auto");
        field.appendChild(el("label", "form-label", pair[1]));
        const input = el("input", "form-control form-control-sm");
        input.type = "number";
        input.min = "1";
        input.value = question[pair[0]] || 1;
        input.disabled = !editable;
        input.addEventListener("change", function () {
          const value = parseInt(input.value, 10);
          question[pair[0]] = isNaN(value) ? 1 : value;
          touch();
          render();
        });
        field.appendChild(input);
        range.appendChild(field);
      });
      body.appendChild(range);
    }
    card.appendChild(body);
    return card;
  }

  function render() {
    listNode.innerHTML = "";
    if (!state.questions.length) {
      listNode.appendChild(emptyState("还没有题目", "点击“添加题目”开始。"));
      return;
    }
    state.questions.forEach(function (question, index) {
      listNode.appendChild(questionCard(question, index));
    });
  }

  function collect() {
    return {
      revision: revision,
      title: document.getElementById("q-title").value,
      description: document.getElementById("q-description").value,
      questions: state.questions.map(function (question) {
        return {
          code: question.code,
          type: question.type,
          title: question.title,
          required: !!question.required,
          min_choices: question.min_choices,
          max_choices: question.max_choices,
          options: question.options.map(function (option, index) {
            return { code: option.code || "O" + (index + 1), label: option.label };
          }),
        };
      }),
    };
  }

  /* ---------------------------------------------------------------- 保存冲突 */

  const conflictBox = document.getElementById("conflict");

  function diffAgainst(current) {
    const local = collect();
    const rows = [];
    if ((local.title || "") !== (current.title || "")) {
      rows.push(
        "题库名称：你填写的是「" +
          (local.title || "（空）") +
          "」，服务端最新是「" +
          (current.title || "（空）") +
          "」"
      );
    }
    if ((local.description || "") !== (current.description || "")) {
      rows.push("用途说明：你填写的内容与服务端最新版本不一致");
    }
    const localCount = local.questions.length;
    const remote = current.questions || [];
    if (localCount !== remote.length) {
      rows.push("题目数量：你这边 " + localCount + " 题，服务端最新 " + remote.length + " 题");
    } else {
      let changed = 0;
      local.questions.forEach(function (question, index) {
        if ((question.title || "") !== ((remote[index] || {}).title || "")) changed += 1;
      });
      if (changed) rows.push("有 " + changed + " 道题的题干与服务端最新版本不同");
    }
    return rows;
  }

  function applyLatest(current) {
    document.getElementById("q-title").value = current.title || "";
    document.getElementById("q-description").value = current.description || "";
    state.questions = JSON.parse(JSON.stringify(current.questions || []));
    revision = current.revision;
    conflictBox.hidden = true;
    conflictBox.innerHTML = "";
    window.Ops.markClean();
    render();
  }

  async function overwriteWithLocal(current) {
    const button = document.getElementById("save");
    /* 用户已经看过差异并明确选择用自己的内容覆盖：这不是自动重试。 */
    revision = current.revision;
    const result = await window.Ops.act({
      url: endpoints.save,
      body: collect(),
      button: button,
      success: "已按你的内容保存，服务端最新版本被覆盖。",
    });
    if (result && result.questionnaire) {
      state.questions = result.questionnaire.questions;
      revision = result.questionnaire.revision;
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
        title: "保存冲突：这份题库在你编辑期间已被其他人保存",
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
                impacts: rows.length ? rows : ["没有明显差异：对方可能修改了选项文字或顺序。"],
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
    if (result && result.questionnaire) {
      state.questions = result.questionnaire.questions;
      if (typeof result.questionnaire.revision === "number") {
        revision = result.questionnaire.revision;
      }
      window.Ops.markClean();
    }
    return result;
  }

  function showProblems(problems) {
    const box = document.getElementById("problems");
    box.innerHTML = "";
    box.hidden = !problems.length;
    if (!problems.length) return;
    /* 提示块沿用界面组件体系的 alert，标题与要点都保持可读的中文语义。 */
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

  const addQuestion = document.getElementById("add-question");
  if (addQuestion) {
    addQuestion.addEventListener("click", function () {
      state.questions.push({
        code: "Q" + (state.questions.length + 1),
        type: "single_choice",
        title: "",
        required: true,
        min_choices: 1,
        max_choices: 1,
        options: [
          { code: "O1", label: "" },
          { code: "O2", label: "" },
        ],
      });
      touch();
      render();
    });
  }

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
        title: "发布题库版本",
        message: "发布后家长端的新答卷将使用《" + saved.questionnaire.title + "》" + saved.questionnaire.version + "。",
        impacts: [
          "同一题库当前已发布的版本会被自动停用",
          "历史答卷仍绑定各自创建时的版本，不会被改写",
          "发布后该版本不可再编辑",
        ],
        confirmLabel: "确认发布",
      });
      if (!agreed) return;
      await window.Ops.act({
        url: endpoints.publish,
        body: {},
        button: publishButton,
        success: "题库版本已发布。",
        redirect: endpoints.list,
      });
    });
  }

  const copyButton = document.getElementById("copy");
  if (copyButton) {
    copyButton.addEventListener("click", async function () {
      /* 版本号由系统递增，运营不需要手工管理技术编号；
         同一次点击重复提交也只会产生一个新版本。 */
      const agreed = await window.Ops.confirm({
        title: "复制为新版本",
        message: "复制会创建一个可编辑的草稿，题目内容与当前版本一致，版本号由系统自动递增。",
        impacts: [
          "当前版本保持原样，历史答卷仍绑定它，不会被改写",
          "发布新版本时，该题库原有的已发布版本会自动停用",
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
        title: "停用题库版本",
        message: "停用后该版本不再作为新答卷的题库。",
        impacts: [
          status === "published" ? "该题库将没有已发布版本，家长端会暂时看不到对应问卷" : "草稿停用后仍保留在列表中",
          "历史答卷与已生成报告不受影响",
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

  ["q-title", "q-description"].forEach(function (id) {
    const node = document.getElementById(id);
    if (node) {
      node.addEventListener("input", touch);
    }
  });

  render();
})();
