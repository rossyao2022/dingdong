/* 题库可视化编辑器：运营只操作题干、选项、顺序和必填规则，不接触 JSON。 */
(function () {
  const dataNode = document.getElementById("questionnaire-data");
  const listNode = document.getElementById("questions");
  const config = document.getElementById("questionnaire-config");
  if (!dataNode || !listNode || !config) return;

  const state = JSON.parse(dataNode.textContent) || {};
  if (!Array.isArray(state.questions)) state.questions = [];
  const status = config.dataset.status;
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
    const node = el("button", className || "icon-btn", label);
    node.type = "button";
    if (title) node.title = title;
    node.addEventListener("click", onClick);
    return node;
  }

  function touch() {
    window.Ops.markDirty();
  }

  function questionCard(question, index) {
    const card = el("div", "question-card");
    card.dataset.index = String(index);

    const head = el("div", "question-head");
    head.appendChild(el("span", "idx", "第 " + (index + 1) + " 题"));

    const typeSelect = el("select");
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

    const requiredLabel = el("label");
    requiredLabel.style.display = "flex";
    requiredLabel.style.alignItems = "center";
    requiredLabel.style.gap = "6px";
    const required = el("input");
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

    head.appendChild(el("span", "spacer"));
    if (editable) {
      head.appendChild(button("↑", "icon-btn", function () {
        if (index === 0) return;
        state.questions.splice(index - 1, 0, state.questions.splice(index, 1)[0]);
        touch();
        render();
      }, "上移"));
      head.appendChild(button("↓", "icon-btn", function () {
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
    card.appendChild(head);

    const titleRow = el("div", "form-row");
    const title = el("textarea");
    title.value = question.title || "";
    title.placeholder = "题干，例如：遇到一件从没见过的小玩意儿，你更想先……";
    title.disabled = !editable;
    title.addEventListener("input", function () {
      question.title = title.value;
      touch();
    });
    titleRow.appendChild(title);
    card.appendChild(titleRow);

    const optionsBox = el("div");
    question.options.forEach(function (option, optionIndex) {
      const row = el("div", "option-row");
      row.appendChild(el("span", "idx", String(optionIndex + 1)));
      const input = el("input");
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
    card.appendChild(optionsBox);

    if (editable) {
      const addOption = button("添加选项", "btn btn-sm", function () {
        question.options.push({ code: "O" + (question.options.length + 1), label: "" });
        if (question.type === "multiple_choice") {
          question.max_choices = question.options.length;
        }
        touch();
        render();
      });
      card.appendChild(addOption);
    }

    if (question.type === "multiple_choice") {
      const range = el("div", "filters");
      range.style.marginTop = "10px";
      [
        ["min_choices", "最少选择"],
        ["max_choices", "最多选择"],
      ].forEach(function (pair) {
        const field = el("div", "field");
        field.style.minWidth = "120px";
        field.appendChild(el("label", null, pair[1]));
        const input = el("input");
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
      card.appendChild(range);
    }
    return card;
  }

  function render() {
    listNode.innerHTML = "";
    if (!state.questions.length) {
      const empty = el("p", "table-empty", "还没有题目。点击“添加题目”开始。");
      listNode.appendChild(empty);
      return;
    }
    state.questions.forEach(function (question, index) {
      listNode.appendChild(questionCard(question, index));
    });
  }

  function collect() {
    return {
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

  async function save(silent) {
    const button = document.getElementById("save");
    const result = await window.Ops.act({
      url: endpoints.save,
      body: collect(),
      button: button,
      success: silent ? false : "草稿已保存。",
    });
    if (result && result.questionnaire) {
      state.questions = result.questionnaire.questions;
      window.Ops.markClean();
    }
    return result;
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
      const version = await window.Ops.prompt({
        title: "复制为新版本",
        message: "复制会创建一个可编辑的草稿，题目内容与当前版本一致。",
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
        redirect: null,
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
