/* 叮咚运营后台前端交互：确认对话框、动作提交、加载与错误反馈。
   所有数据都来自真实接口，不在前端伪造任何统计或状态。 */
(function () {
  const Ops = {};

  /* 就绪标记：脚本一旦执行就在 <html> 上留痕，页面初始化完成再打第二个标记。
     验收脚本据此等待真实就绪，而不是靠固定睡眠。 */
  document.documentElement.setAttribute("data-ops-script", "1");

  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return input ? input.value : "";
  }

  /* 请求标识：公网后台走 HTTP，不是安全上下文，crypto.randomUUID 不存在。
     这里保留原生实现优先，再退回 getRandomValues，最后还有非加密兜底。 */
  function requestId() {
    const c = window.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.prototype.map
        .call(bytes, function (b) {
          return ("0" + b.toString(16)).slice(-2);
        })
        .join("");
      return (
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-" +
        hex.slice(12, 16) +
        "-" +
        hex.slice(16, 20) +
        "-" +
        hex.slice(20)
      );
    }
    return "ops-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  /* 轻提示。类名用 ops-toast，避免与组件库自带的 .toast 组件互相覆盖。 */
  function toast(message, kind) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.className = "ops-toast show" + (kind ? " " + kind : "");
    window.clearTimeout(node._timer);
    node._timer = window.setTimeout(function () {
      node.className = "ops-toast" + (kind ? " " + kind : "");
    }, kind === "error" ? 6000 : 3200);
  }

  function normalizeError(response, data) {
    if (data && data.ok === false) {
      return {
        code: data.code || "ERROR",
        message: data.message || "操作失败，请稍后重试。",
        fields: data.field_errors || [],
        trace: data.trace_id || "",
        current: data.current || null,
      };
    }
    if (data && data.code && !response.ok) {
      return {
        code: data.code,
        message: data.message || "操作失败，请稍后重试。",
        fields: data.field_errors || [],
        trace: data.trace_id || "",
        current: data.current || null,
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
      current: null,
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
    cancelBtn.hidden = opts.single === true;
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
    field.className = "mb-0";
    const label = document.createElement("label");
    label.className = "form-label";
    label.textContent = opts.label || "内容";
    label.setAttribute("for", "ops-prompt-input");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
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

  /* 可复用的提示块：冲突、权限、校验结果都用同一种结构呈现，
     带标题、说明、要点列表和零到多个操作按钮。
     外观直接用组件库的 alert 组件，不自己再定义一套提示样式。 */
  const NOTICE_KIND = {
    danger: "alert-danger",
    error: "alert-danger",
    warn: "alert-warning",
    warning: "alert-warning",
    ok: "alert-success",
    success: "alert-success",
    info: "alert-info",
  };

  function notice(options) {
    const opts = options || {};
    const box = document.createElement("div");
    box.className = "alert " + (NOTICE_KIND[opts.kind] || "alert-info");
    box.setAttribute("role", "alert");
    if (opts.title) {
      const heading = document.createElement("h4");
      heading.className = "alert-heading";
      heading.textContent = opts.title;
      box.appendChild(heading);
    }
    if (opts.message) {
      const text = document.createElement("p");
      text.className = "mb-0";
      text.textContent = opts.message;
      box.appendChild(text);
    }
    if (opts.impacts && opts.impacts.length) {
      const list = document.createElement("ul");
      list.className = "mb-0";
      opts.impacts.forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      box.appendChild(list);
    }
    if (opts.actions && opts.actions.length) {
      const row = document.createElement("div");
      row.className = "btn-list mt-3";
      opts.actions.forEach(function (action) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-sm" + (action.primary ? " btn-primary" : "");
        button.textContent = action.label;
        button.addEventListener("click", action.onClick);
        row.appendChild(button);
      });
      box.appendChild(row);
    }
    return box;
  }

  /* 只读提示：把要点讲清楚，用户点“知道了”即关闭。 */
  function alertDialog(options) {
    const opts = options || {};
    return confirmDialog({
      title: opts.title || "提示",
      message: opts.message || "",
      impacts: opts.impacts || [],
      confirmLabel: opts.confirmLabel || "知道了",
    });
  }

  /* 按钮忙碌态：保留按钮内部结构（图标 + 文字），不用 textContent 直接覆盖。
     用 WeakMap 记住原始内容，避免第二次进入忙碌态时读到上一次的“处理中…”。 */
  const busyOriginal = new WeakMap();
  function busy(button, on) {
    if (!button) return;
    if (on) {
      if (!busyOriginal.has(button)) busyOriginal.set(button, button.innerHTML);
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      button.innerHTML = button.dataset.busy || "处理中…";
    } else {
      button.removeAttribute("aria-busy");
      button.disabled = false;
      const original = busyOriginal.get(button);
      if (original !== undefined) {
        button.innerHTML = original;
        busyOriginal.delete(button);
      }
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

  /* 侧栏抽屉：窄屏展开 / 关闭。
     - 焦点管理：打开后焦点进入侧栏第一个链接，关闭后回到展开按钮。
     - 关闭方式：关闭按钮、遮罩点击、Esc 三种都有。
     桌面宽度下这些控件由 CSS 隐藏，侧栏常驻，不需要任何脚本。 */
  function initShell() {
    const sidebar = document.getElementById("ops-sidebar");
    const backdrop = document.querySelector(".ops-backdrop");
    const openers = document.querySelectorAll("[data-ops-nav-open]");
    const closers = document.querySelectorAll("[data-ops-nav-close]");

    function setOpen(open) {
      if (!sidebar) return;
      sidebar.classList.toggle("open", open);
      if (backdrop) backdrop.hidden = !open;
      openers.forEach(function (button) {
        button.setAttribute("aria-expanded", open ? "true" : "false");
      });
      if (open) {
        const first = sidebar.querySelector("a, button");
        if (first) first.focus();
      } else {
        const opener = openers[0];
        if (opener) opener.focus();
      }
    }

    openers.forEach(function (button) {
      button.addEventListener("click", function () {
        setOpen(!sidebar || !sidebar.classList.contains("open"));
      });
    });
    closers.forEach(function (button) {
      button.addEventListener("click", function () {
        setOpen(false);
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !sidebar) return;
      if (!sidebar.classList.contains("open")) return;
      setOpen(false);
    });

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
    document.documentElement.setAttribute("data-ops-ready", "1");
  }

  /* 先暴露 Ops 并注册初始化，避免个别辅助函数异常导致整个后台脚本失效。 */
  window.Ops = Ops;
  document.addEventListener("DOMContentLoaded", initShell);

  Ops.request = request;
  Ops.act = act;
  Ops.confirm = confirmDialog;
  Ops.prompt = promptDialog;
  Ops.notice = notice;
  Ops.alert = alertDialog;
  Ops.toast = toast;
  Ops.busy = busy;
  Ops.requestId = requestId;
  Ops.markDirty = markDirty;
  Ops.markClean = markClean;
  Ops.initActions = initActions;
  Ops.isDirty = function () {
    return dirty;
  };
})();
