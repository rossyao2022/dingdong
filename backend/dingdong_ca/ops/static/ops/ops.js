/* 叮咚运营后台前端交互：确认对话框、动作提交、加载与错误反馈。
   所有数据都来自真实接口，不在前端伪造任何统计或状态。 */
(function () {
  const Ops = {};

  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return input ? input.value : "";
  }

  function toast(message, kind) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.className = "toast show" + (kind ? " " + kind : "");
    window.clearTimeout(node._timer);
    node._timer = window.setTimeout(function () {
      node.className = "toast" + (kind ? " " + kind : "");
    }, kind === "error" ? 6000 : 3200);
  }

  function normalizeError(response, data) {
    if (data && data.ok === false) {
      return {
        code: data.code || "ERROR",
        message: data.message || "操作失败，请稍后重试。",
        fields: data.field_errors || [],
        trace: data.trace_id || "",
      };
    }
    if (data && data.code && !response.ok) {
      return {
        code: data.code,
        message: data.message || "操作失败，请稍后重试。",
        fields: data.field_errors || [],
        trace: data.trace_id || "",
      };
    }
    return {
      code: "HTTP_" + response.status,
      message:
        response.status === 403
          ? "当前账号没有执行该操作的权限。"
          : "服务暂时不可用，请稍后重试。",
      fields: [],
      trace: "",
    };
  }

  async function request(url, options) {
    const opts = options || {};
    const headers = { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" };
    const init = {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: headers,
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["X-CSRFToken"] = csrfToken();
      init.body = JSON.stringify(opts.body);
    } else if (init.method !== "GET") {
      headers["X-CSRFToken"] = csrfToken();
    }
    let response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      throw { code: "NETWORK", message: "网络连接失败，请检查网络后重试。", fields: [] };
    }
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) {
      if (response.redirected || response.status === 403 || response.status === 302) {
        throw {
          code: "AUTH_REQUIRED",
          message: "登录状态已失效，请重新登录。",
          fields: [],
          relogin: true,
        };
      }
      throw { code: "HTTP_" + response.status, message: "服务返回了无法识别的响应。", fields: [] };
    }
    const data = await response.json().catch(function () {
      return null;
    });
    if (!response.ok || (data && data.ok === false)) {
      throw normalizeError(response, data);
    }
    return data || {};
  }

  function dialog() {
    let node = document.getElementById("ops-dialog");
    if (!node) {
      node = document.createElement("dialog");
      node.id = "ops-dialog";
      node.className = "ops-dialog";
      node.innerHTML =
        '<div class="ops-dialog-body"></div><div class="ops-dialog-foot">' +
        '<button type="button" class="btn" data-role="cancel">取消</button>' +
        '<button type="button" class="btn btn-primary" data-role="confirm">确定</button></div>';
      document.body.appendChild(node);
    }
    return node;
  }

  function confirmDialog(options) {
    const opts = options || {};
    const node = dialog();
    const body = node.querySelector(".ops-dialog-body");
    const confirmBtn = node.querySelector('[data-role="confirm"]');
    const cancelBtn = node.querySelector('[data-role="cancel"]');
    const title = document.createElement("h2");
    title.textContent = opts.title || "请确认";
    body.innerHTML = "";
    body.appendChild(title);
    const text = document.createElement("p");
    text.textContent = opts.message || "确定要执行该操作吗？";
    body.appendChild(text);
    if (opts.impacts && opts.impacts.length) {
      const list = document.createElement("ul");
      opts.impacts.forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      body.appendChild(list);
    }
    confirmBtn.textContent = opts.confirmLabel || "确定";
    confirmBtn.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
    return new Promise(function (resolve) {
      function finish(value) {
        node.close();
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        node.removeEventListener("cancel", onCancel);
        resolve(value);
      }
      function onConfirm() {
        finish(true);
      }
      function onCancel(event) {
        if (event) event.preventDefault();
        finish(false);
      }
      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      node.addEventListener("cancel", onCancel);
      node.showModal();
      confirmBtn.focus();
    });
  }

  /* 需要用户输入一个值的对话框；返回字符串，取消返回 null。 */
  function promptDialog(options) {
    const opts = options || {};
    const node = dialog();
    const body = node.querySelector(".ops-dialog-body");
    const confirmBtn = node.querySelector('[data-role="confirm"]');
    const cancelBtn = node.querySelector('[data-role="cancel"]');
    body.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = opts.title || "请填写";
    body.appendChild(title);
    if (opts.message) {
      const text = document.createElement("p");
      text.textContent = opts.message;
      body.appendChild(text);
    }

    const field = document.createElement("div");
    field.className = "form-row";
    const label = document.createElement("label");
    label.textContent = opts.label || "内容";
    label.setAttribute("for", "ops-prompt-input");
    const input = document.createElement("input");
    input.type = "text";
    input.id = "ops-prompt-input";
    input.value = opts.defaultValue || "";
    input.placeholder = opts.placeholder || "";
    field.appendChild(label);
    field.appendChild(input);
    body.appendChild(field);

    confirmBtn.textContent = opts.confirmLabel || "继续";
    confirmBtn.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
    return new Promise(function (resolve) {
      function finish(value) {
        node.close();
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        node.removeEventListener("cancel", onCancel);
        input.removeEventListener("keydown", onKeydown);
        resolve(value);
      }
      function onConfirm() {
        finish(input.value.trim());
      }
      function onCancel(event) {
        if (event) event.preventDefault();
        finish(null);
      }
      function onKeydown(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          onConfirm();
        }
      }
      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      node.addEventListener("cancel", onCancel);
      input.addEventListener("keydown", onKeydown);
      node.showModal();
      input.focus();
      input.select();
    });
  }

  function busy(button, on) {
    if (!button) return;
    if (on) {
      button.setAttribute("aria-busy", "true");
      if (button.dataset.label === undefined) button.dataset.label = button.textContent;
      button.disabled = true;
      button.textContent = button.dataset.busy || "处理中…";
    } else {
      button.removeAttribute("aria-busy");
      button.disabled = false;
      if (button.dataset.label !== undefined) button.textContent = button.dataset.label;
    }
  }

  /* 统一的动作提交：可选确认 -> 提交 -> 成功提示 / 失败提示。 */
  async function act(options) {
    const opts = options || {};
    const button = opts.button || null;
    if (opts.confirm) {
      const agreed = await confirmDialog(opts.confirm);
      if (!agreed) return null;
    }
    busy(button, true);
    try {
      const data = await request(opts.url, { method: opts.method || "POST", body: opts.body || {} });
      if (opts.success !== false) {
        toast(typeof opts.success === "string" ? opts.success : "操作已完成。", "ok");
      }
      /* 跳转或刷新前留出时间让操作人看到成功反馈。 */
      const NAVIGATE_DELAY = 900;
      if (opts.reload) {
        window.setTimeout(function () {
          window.location.reload();
        }, NAVIGATE_DELAY);
      } else if (opts.redirect) {
        window.setTimeout(function () {
          window.location.href = opts.redirect;
        }, NAVIGATE_DELAY);
      } else if (typeof opts.after === "function") {
        window.setTimeout(function () {
          opts.after(data);
        }, NAVIGATE_DELAY);
      }
      return data;
    } catch (error) {
      const message = (error && error.message) || "操作失败，请稍后重试。";
      toast(message, "error");
      if (error && error.relogin) {
        window.setTimeout(function () {
          window.location.href = "/ops/login/?next=" + encodeURIComponent(window.location.pathname);
        }, 1200);
      }
      if (typeof opts.onError === "function") opts.onError(error);
      return null;
    } finally {
      busy(button, false);
    }
  }

  /* 未保存离开提醒 */
  let dirty = false;
  function markDirty() {
    dirty = true;
    document.querySelectorAll("[data-dirty-flag]").forEach(function (node) {
      node.hidden = false;
    });
  }
  function markClean() {
    dirty = false;
    document.querySelectorAll("[data-dirty-flag]").forEach(function (node) {
      node.hidden = true;
    });
  }
  window.addEventListener("beforeunload", function (event) {
    if (!dirty) return undefined;
    event.preventDefault();
    event.returnValue = "有未保存的修改，确定离开吗？";
    return event.returnValue;
  });

  function initActions() {
    document.querySelectorAll("[data-ops-action]").forEach(function (button) {
      button.addEventListener("click", async function () {
        let body = {};
        if (button.dataset.opsBody) {
          try {
            body = JSON.parse(button.dataset.opsBody);
          } catch (error) {
            body = {};
          }
        }
        if (button.dataset.opsNoteFrom) {
          const noteNode = document.querySelector(button.dataset.opsNoteFrom);
          if (noteNode) {
            body = Object.assign({}, body);
            body.note = noteNode.value.trim();
          }
        }
        if (button.dataset.opsPromptLabel) {
          const value = await promptDialog({
            title: button.dataset.opsPromptTitle || "请填写",
            message: button.dataset.opsPromptMessage || "",
            label: button.dataset.opsPromptLabel,
            placeholder: button.dataset.opsPromptPlaceholder || "",
            defaultValue: button.dataset.opsPromptDefault || "",
            confirmLabel: button.dataset.opsPromptConfirm || "继续",
          });
          if (value === null) return;
          body = Object.assign({}, body);
          body[button.dataset.opsPromptField || "version"] = value;
        }
        const impacts = (button.dataset.opsConfirmImpacts || "").split("|").filter(Boolean);
        await act({
          url: button.dataset.opsAction,
          body: body,
          button: button,
          method: button.dataset.opsMethod || "POST",
          success: button.dataset.opsSuccess || "操作已完成。",
          reload: button.dataset.opsReload === "1",
          confirm: button.dataset.opsConfirm
            ? {
                title: button.dataset.opsConfirmTitle || "请确认",
                message: button.dataset.opsConfirm,
                impacts: impacts,
                confirmLabel: button.dataset.opsConfirmLabel || "确定",
                danger: button.dataset.opsConfirmDanger === "1",
              }
            : null,
        });
      });
    });
  }

  function initShell() {
    const toggle = document.querySelector(".ops-menu-toggle");
    const sidebar = document.querySelector(".ops-sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", function () {
        sidebar.classList.toggle("open");
      });
    }
    document.querySelectorAll("[data-ops-confirm]").forEach(function (form) {
      form.addEventListener("submit", async function (event) {
        if (form.dataset.confirmed === "1") return;
        event.preventDefault();
        const agreed = await confirmDialog({
          title: form.dataset.confirmTitle || "请确认",
          message: form.dataset.opsConfirm,
          impacts: (form.dataset.confirmImpacts || "").split("|").filter(Boolean),
          confirmLabel: form.dataset.confirmLabel || "确定",
          danger: form.dataset.confirmDanger === "1",
        });
        if (agreed) {
          form.dataset.confirmed = "1";
          form.submit();
        }
      });
    });
    const progress = document.createElement("div");
    progress.className = "progress-line";
    document.body.appendChild(progress);
    document.querySelectorAll("a[data-nav]").forEach(function (link) {
      link.addEventListener("click", function () {
        progress.classList.add("on");
      });
    });
    initActions();
  }

  /* 先暴露 Ops 并注册初始化，避免个别辅助函数异常导致整个后台脚本失效。 */
  window.Ops = Ops;
  document.addEventListener("DOMContentLoaded", initShell);

  Ops.request = request;
  Ops.act = act;
  Ops.confirm = confirmDialog;
  Ops.prompt = promptDialog;
  Ops.toast = toast;
  Ops.busy = busy;
  Ops.markDirty = markDirty;
  Ops.markClean = markClean;
  Ops.initActions = initActions;
  Ops.isDirty = function () {
    return dirty;
  };
})();
