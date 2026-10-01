import * as API from "./api.js?v=0.3.25";
import {
  ACCOUNT_STATUS,
  BIND_STATE,
  activeAccount,
  boundAccount,
  safeChatUrl,
  robotConflictMessage,
  conflictNeedsRefresh,
  isPrototypeDemo,
  readNfcToken,
  readParam,
  replaceFlowNeeded,
  retiredAccounts,
  stripBindingParams,
} from "./ca-link.js?v=0.3.25";
import {
  HEALTH_FOOTER,
  STALE_NOTICE,
  healthSection,
  personaSection,
} from "./companion.js?v=0.3.25";
import {
  DIMENSION_MISSING,
  PERIODS,
  PROXY_NOTE,
  growthCycleSection,
} from "./growth-cycle.js?v=0.3.25";
import {
  WRITE_FAILED_TEXT,
  reassessmentSection,
} from "./reassessment.js?v=0.3.25";
import {
  actions,
  button,
  emptyState,
  esc,
  pageHead,
  panel,
} from "./ui-components.js?v=0.3.25";
import {
  explorerState,
  continuedExplorerHash,
  sameSelection,
  resumableSession,
} from "./exploration-session.js?v=0.3.25";
import {
  GUIDE_MODES,
  greeting,
  guideText,
  renderGuidanceSummary,
} from "./guide-preference.js?v=0.3.25";
import {
  renderDingDongReport,
  renderRobotEntry,
} from "./dingdong-report.js?v=0.3.25";
import {
  nextExperience,
  experienceRecords,
  renderExperienceTask,
  renderExperienceRecords,
} from "./experience-flow.js?v=0.3.25";
const $ = (s) => document.querySelector(s);
let robotReadEpoch = 0;
const state = {
  user: null,
  children: [],
  child: null,
  runtime: null,
  challenge: null,
  mood: "",
  island: "",
  style: "cognitive", // Existing activity API enum; original guide preference is separate.
  companionPreference: null,
  journeyStatus: "",
  session: null,
  question: 0,
  record: null,
  consents: [],
  window: { from: "2026-09-01T00:00:00Z", to: "2026-09-08T00:00:00Z" },
  // 「成长周期报告」的两个固定 Tab；任意区间归「成长观察」，两处不共用状态。
  growthPeriod: "15d",
  dingdongWeeklyTurns: 7,
  // 复测面：`reassessment` 是读到的建议，`write`/`result` 是两条回写的响应，
  // 只有 `result`（`complete` 的响应）带得出新角色名与匹配度差。
  reassessment: null,
  reassessmentWrite: null,
  reassessmentResult: null,
  reassessmentExpanded: false,
  // 这次「开始复测」承接的是哪一次测评：回写只认它，避免把别的测评 id 回写过去。
  reassessmentSession: null,
  reassessmentStart: false,
  reassessmentWriteError: "",
  // 回写「重新测评 / 先不测」失败时的落点：`{ message, accepted }`，重试要按同一个
  // 答案再 POST 一次（同一个 `request_id`，幂等重放）。
  reassessmentRespondError: null,
};
let explorationEpoch = 0;
let viewEpoch = 0,
  busy = false,
  pollTimer,
  smsCooldownTimer,
  // 对话框打开期间不排轮询（重渲染会打断家长正在读的内容），但这一轮该排的那次要
  // 记住：对话框关掉后由 close 事件补上，否则观察状态再也不刷新了。
  pollPending = false,
  currentActivity,
  nextCursor,
  childDraft = null,
  // 当前正在进行的儿童档案编辑会话。冲突恢复要靠它记住"这次编辑以哪一版为准"，
  // 而不是靠重新渲染表单去猜。
  childEdit = null;
const downloadUrls = new Set();
const keys = new Map();
const requestKey = (k) => {
  if (!keys.has(k)) keys.set(k, API.createRequestId());
  return keys.get(k);
};
const formData = (form) => Object.fromEntries(new FormData(form));
const hints = {};
const channel =
  "BroadcastChannel" in window ? new BroadcastChannel("dingdong-auth") : null;
/**
 * 离开当前上下文：关对话框、结束编辑会话。只有换路由/换儿童/退出登录才算离开，
 * 重渲染不算——`render()` 每次进来都关对话框会让打开中的对话框被轮询渲染关掉
 * （T-040 的 P-16：复测「开始复测」的同意对话框只闪现约 1.7 秒）。
 */
function leaveContext({ disposePage = true } = {}) {
  if (disposePage) {
    explorationEpoch++;
    window.FingerprintLab?.cleanup();
  }
  if ($("#dialog").open) $("#dialog").close();
  // 对话框一关，编辑会话就结束：不允许残留的基准修订号在下次打开时复用。
  childEdit = null;
}
/** 对话框流程走完：关掉它并结束编辑会话，供「提交成功后重渲染」的流程调用。 */
function closeDialog() {
  leaveContext({ disposePage: false });
  window.speechSynthesis?.cancel();
}
function stopWork() {
  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadUrls.clear();
  clearTimeout(pollTimer);
  clearTimeout(smsCooldownTimer);
  leaveContext();
  window.speechSynthesis?.cancel();
}
/** 观察未就绪时按固定间隔重渲染一次；对话框打开期间挂起，关闭后恢复。 */
function schedulePoll(tick, delay) {
  if ($("#dialog").open) {
    pollPending = true;
    return;
  }
  pollTimer = setTimeout(() => {
    if (tick === viewEpoch) render();
  }, delay);
}
function forget() {
  viewEpoch++;
  stopWork();
  window.IslandExplorer?.reset();
  window.TalentExplorer?.reset();
  state.user = null;
  state.child = null;
  state.children = [];
  state.session = null;
  state.record = null;
  state.consents = [];
  state.challenge = null;
  state.question = 0;
  state.companionPreference = null;
  state.journeyStatus = "";
  state.dingdongWeeklyTurns = 7;
  state.style = "cognitive";
  nextCursor = null;
  state.reassessment = null;
  state.reassessmentWrite = null;
  state.reassessmentResult = null;
  state.reassessmentExpanded = false;
  state.reassessmentSession = null;
  state.reassessmentStart = false;
  state.reassessmentWriteError = "";
  state.reassessmentRespondError = null;
  childDraft = null;
  currentActivity = null;
  for (const k of Object.keys(hints)) delete hints[k];
  keys.clear();
  API.clearAuth();
}
function saveHints() {
  try {
    sessionStorage.setItem(
      "ca.navigation",
      JSON.stringify({ user: state.user?.id, child: state.child?.id }),
    );
  } catch {}
}
// 时间展示统一走这里：本地时区、零填充到分钟（与成长观察窗口输入框的口径一致，
// 同页不出现「2026/9/1 00:00:00」和「2026/09/01 08:00」两种写法）。
const DATE_TIME = {
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};
function date(v) {
  return v ? new Date(v).toLocaleString("zh-CN", DATE_TIME) : "尚无记录";
}
/** 只到日的时间展示。纯日期字符串直接改写，避免按 UTC 解析后跨时区差一天。 */
function dateOnly(v) {
  if (!v) return "尚无记录";
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (plain) return `${plain[1]}/${plain[2]}/${plain[3]}`;
  return new Date(v).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
function head(title, desc = "", action = "") {
  return pageHead(title, desc, action, state.child?.name || "DINGDONG");
}
function empty(title, text, action = "") {
  return emptyState(title, text, action);
}
function testTag() {
  // 家长端不再显示测试标注（2026-09-20 拍板）：保留空实现，调用点与 CSS 纪律见 README。
  return "";
}
function showDialog(title, html) {
  $("#dialog-content").innerHTML =
    `<div class="dialog-wrap"><div class="dialog-top"><h2 id="dialog-title">${esc(title)}</h2><button class="text-button" data-action="close" aria-label="关闭对话框">关闭</button></div>${html}<div class="form-error" role="alert"></div></div>`;
  if (!$("#dialog").open) $("#dialog").showModal();
}
function showError(e) {
  if (e.status === 401) {
    forget();
    loginPage();
    toast("登录已失效，请重新登录。");
    return;
  }
  const target = $("#dialog").open
    ? $("#dialog .form-error")
    : $("#main .form-error");
  if (target)
    target.innerHTML =
      esc(errorMessage(e)) +
      (conflictNeedsRefresh(e)
        ? `<p>可刷新读取已保存的最新记录，再继续操作。</p>${button("refresh", "读取最新记录", "", true)}`
        : "");
  else toast(errorMessage(e));
}
/** 提交期间给按钮一个可见的进行中态：换文案 + `aria-busy`，返回恢复函数。 */
function busyButton(el, label) {
  if (!el) return () => {};
  const idle = el.textContent;
  el.disabled = true;
  el.setAttribute("aria-busy", "true");
  el.textContent = label;
  return () => {
    if (!el.isConnected) return;
    el.disabled = false;
    el.removeAttribute("aria-busy");
    el.textContent = idle;
  };
}
async function act(fn, el) {
  if (busy) return;
  busy = true;
  if (el) el.disabled = true;
  $("#child-select").disabled = true;
  try {
    await fn();
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
    $("#child-select").disabled = false;
    if (el?.isConnected) el.disabled = false;
  }
}
function to(route) {
  leaveContext();
  if (location.hash === "#" + route) render();
  else location.hash = route;
}

const nav = [
  ["explore", "✧", "天赋探索"],
  ["home", "⌂", "今日陪伴"],
  ["journey", "◷", "成长旅程"],
  ["reports", "▥", "测评与报告"],
  ["companion", "♧", "我的 DingDong"],
  ["settings", "⚙", "账户与关联"],
  ["services", "♡", "家长支持"],
];
function errorMessage(e) {
  return (
    (robotConflictMessage(e) || e.message) +
    (e.fields?.length ? " " + e.fields.map((f) => f.message).join("；") : "")
  );
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function header() {
  const route = location.hash.slice(1).split("/")[0] || "explore";
  const page = ["talents", "fingerprint", "interest"].includes(route)
    ? "explore"
    : route;
  $("#logout-shortcut").hidden = !state.user;
  $("#page-label").textContent =
    nav.find((n) => n[0] === page)?.[2] || "成长空间";
  for (const id of ["main-nav", "mobile-nav"])
    $("#" + id).innerHTML = state.user
      ? nav
          .filter(
            (n) =>
              id !== "mobile-nav" ||
              ["explore", "home", "journey", "reports", "settings"].includes(
                n[0],
              ),
          )
          .map(
            (n) =>
              `<a href="#${n[0]}" class="${page === n[0] ? "active" : ""}"><span class="nav-symbol" aria-hidden="true">${n[1]}</span><span>${n[2]}</span></a>`,
          )
          .join("")
      : "";
  $(".child-switch").hidden = !state.children.length;
  $("#child-select").innerHTML = state.children
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === state.child?.id ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
}
function page(html) {
  $("#main").innerHTML = `<div class="page">${html}</div>`;
  $("#main").setAttribute("aria-busy", "false");
  header();
}
// 只保存截止时间和待连接标记；手机号、验证码和 NFC 凭据不落浏览器存储。
function storedValue(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function markNfcPending(pending) {
  try {
    if (pending) sessionStorage.setItem("ca.nfc-pending", "1");
    else sessionStorage.removeItem("ca.nfc-pending");
  } catch {}
  hints.nfcNeedsRetap = pending && !hints.nfcToken;
}
function nfcRecoveryNotice() {
  return hints.nfcNeedsRetap
    ? '<p class="notice">请再碰一次机器人标签，继续连接。</p>'
    : "";
}
function startSmsCooldown(seconds) {
  const deadline =
    Date.now() + Math.min(Math.max(Number(seconds) || 60, 1), 3600) * 1000;
  try {
    sessionStorage.setItem("ca.sms-cooldown", String(deadline));
  } catch {}
  hints.smsDeadline = deadline;
}
function updateSmsCooldown() {
  clearTimeout(smsCooldownTimer);
  const button = $("#send-code");
  if (!button) return;
  const deadline =
    Number(storedValue("ca.sms-cooldown")) || hints.smsDeadline || 0;
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  button.disabled = seconds > 0;
  button.textContent = seconds > 0 ? `${seconds} 秒后重试` : "获取验证码";
  if (seconds > 0) smsCooldownTimer = setTimeout(updateSmsCooldown, 1000);
}
function loginPage() {
  page(
    `<div class="login-layout"><section class="login-scene"><span class="eyebrow">CA × DINGDONG</span><h1>陪孩子探索，<br>把每个发现留下来。</h1><p>从今天的小行动开始，慢慢看见成长。</p><img src="assets/dingdong/robot-front.webp" alt="DingDong 成长伙伴"></section><form id="login-form" class="login-form"><span class="eyebrow">欢迎回到成长空间</span><h2>家长登录</h2>${nfcRecoveryNotice()}<p class="muted">登录后，查看孩子的档案与陪伴记录。</p><label class="field">手机号<input name="phone" type="tel" autocomplete="tel" required placeholder="请输入手机号"></label><div class="inline"><label class="field">验证码<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="5" required placeholder="5 位验证码"></label><button type="button" class="button secondary" id="send-code">获取验证码</button></div><div class="form-error" role="alert"></div><button class="button primary" type="submit" disabled>登录</button></form></div>`,
  );
  updateSmsCooldown();
  $("#login-form").phone.oninput = () => {
    state.challenge = null;
    $("#login-form button[type=submit]").disabled = true;
  };
  $("#send-code").onclick = async (e) => {
    const b = e.currentTarget;
    const form = $("#login-form");
    const requestedPhone = form.phone.value.trim();
    if (!requestedPhone) {
      $(".form-error").textContent = "请先填写手机号，再获取验证码。";
      form.phone.focus();
      return;
    }
    b.disabled = true;
    try {
      await API.request("/auth/csrf", { auth: false });
      const r = await API.request("/auth/sms", {
        method: "POST",
        auth: false,
        body: { phone: requestedPhone },
      });
      startSmsCooldown(r.retry_after);
      if (form.phone.value.trim() !== requestedPhone) return;
      state.challenge = r.challenge_id;
      $("#login-form button[type=submit]").disabled = false;
      $(".form-error").textContent = "";
      toast("验证码已发送，请查看手机。");
    } catch (err) {
      if (err.status === 429) startSmsCooldown(err.retryAfter || 60);
      if (form.isConnected)
        form.querySelector(".form-error").textContent = errorMessage(err);
    } finally {
      updateSmsCooldown();
    }
  };
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    // 慢网下登录要几秒，按钮只变灰会让家长以为点空了、反复点。
    const restore = busyButton(e.submitter, "登录中…");
    try {
      if (!state.challenge) throw new Error("请先获取验证码。");
      state.user = await API.login(state.challenge, e.target.code.value);
      channel?.postMessage({ user: state.user.id });
      await loadChildren();
      render();
    } catch (err) {
      $(".form-error").textContent = errorMessage(err);
    } finally {
      restore();
    }
  };
}
async function loadChildren() {
  state.children = await API.all("/children");
  let remembered;
  try {
    const h = JSON.parse(sessionStorage.getItem("ca.navigation"));
    if (h?.user === state.user.id) remembered = h.child;
  } catch {}
  state.child =
    state.children.find((c) => c.id === (state.child?.id || remembered)) ||
    state.children[0] ||
    null;
  saveHints();
}
async function loadCompanionPreference(child, refresh = false) {
  if (!refresh && state.companionPreference?.child_id === child)
    return state.companionPreference;
  const token = explorationToken();
  const pref = await API.request(`/children/${child}/companion-preference`);
  if (!explorerCurrent(token) || pref.child_id !== child) return null;
  state.companionPreference = pref;
  return pref;
}
const exportButton = () => button("export-child", "导出成长记录", "", true);
function journeyPath(child, cursor = "") {
  return (
    `/children/${child}/activity-records?page_size=20` +
    (state.journeyStatus
      ? `&status=${encodeURIComponent(state.journeyStatus)}`
      : "") +
    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "")
  );
}
async function exportChild() {
  const token = explorationToken(),
    child = state.child?.id;
  if (!child) throw new Error("请先选择儿童档案。");
  const data = await API.request(`/children/${child}/export`);
  if (!explorerCurrent(token) || data.child?.id !== child) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  downloadUrls.add(url);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dingdong-records-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    downloadUrls.delete(url);
  }, 1000);
}
function clearRobotContext() {
  delete hints.accounts;
  delete hints.replaceAccount;
  delete hints.replaceChild;
  delete hints.newAccountId;
}
function childForm() {
  page(
    `<div class="page-head"><div><span class="eyebrow">开始前，先认识一下</span><h1>建立儿童档案</h1><p>姓名或称呼必填，其他信息可以稍后补充。</p></div></div><form id="child-form" class="panel" style="max-width:680px"><label class="field">姓名或称呼<input name="name" maxlength="80" required autocomplete="off"></label><label class="field">性别<select name="gender"><option value="unknown">暂不填写</option><option value="male">男</option><option value="female">女</option></select></label><label class="field">出生日期（选填）<input name="birth_date" type="date" max="${new Date().toISOString().slice(0, 10)}"></label><div class="form-error" role="alert"></div><button class="button" type="submit">保存档案</button></form>`,
  );
  const key = requestKey("child-create");
  $("#child-form").onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      state.child = await API.request("/children", {
        method: "POST",
        body: {
          request_id: key,
          ...formData(e.target),
          birth_date: formData(e.target).birth_date || null,
        },
      });
      clearRobotContext();
      state.companionPreference = null;
      state.journeyStatus = "";
      state.dingdongWeeklyTurns = 7;
      state.record = null;
      state.session = null;
      state.question = 0;
      nextCursor = null;
      await loadChildren();
      keys.delete("child-create");
      childDraft = null;
      to("explore");
    } catch (err) {
      $(".form-error").textContent = errorMessage(err);
    } finally {
      e.submitter.disabled = false;
    }
  };
}
const islands = {
  science: "科学发现",
  story: "故事表达",
  nature: "自然观察",
  imagination: "创意想象",
};
const moods = {
  energy: "能量满满",
  focus: "正在专注",
  inspire: "需要启发",
  calm: "平静如水",
};
const statusNames = {
  draft: "问卷填写中",
  ready: "问卷已完成",
  processing: "正在处理",
  needs_recapture: "处理失败，可重新提交",
  result_unknown: "处理结果待确认",
  completed: "处理已完成",
  cancelled: "已取消",
  expired: "会话已过期",
};
function filters() {
  return `<div class="filters" aria-label="心情筛选"><button class="chip ${!state.mood ? "active" : ""}" data-action="mood" data-value="">全部心情</button>${Object.entries(
    moods,
  )
    .map(
      ([k, v]) =>
        `<button class="chip ${state.mood === k ? "active" : ""}" data-action="mood" data-value="${k}">${v}</button>`,
    )
    .join("")}</div>`;
}
function activityCards(rows) {
  return rows.length
    ? `<div class="grid">${rows.map((a) => `<article class="card activity-card"><img src="assets/islands/${Object.hasOwn(islands, a.island) ? a.island : "science"}.webp" alt=""><span class="note">${esc(islands[a.island] || a.island)} · ${a.duration_minutes} 分钟</span><h3>${esc(a.title)}</h3><p>${esc(a.goal)}</p><div class="actions">${button("activity", "查看活动", `data-id="${a.id}"`)}${testTag()}</div></article>`).join("")}</div>`
    : empty("暂时没有这类活动", "可以换个心情或去其他小岛看看。");
}
function stepView(record) {
  const step = record.activity.steps[record.step_index];
  return (
    head(record.activity.title, "按自己的节奏，一步一步试试看。") +
    `<div class="grid"><section class="panel"><span class="tag">第 ${record.step_index + 1} / ${record.activity.steps.length} 步</span><h2 class="step-title">${esc(step.instruction)}</h2><p class="activity-guidance">${esc(guideText(record))}</p>${button("speak", "朗读引导", "", true)}<div class="form-error" role="alert"></div>${record.step_index === record.activity.steps.length - 1 ? `<label class="field">活动感受<select id="feedback"><option value="">暂不填写</option><option value="interesting">很有意思</option><option value="try_again">还想再试试</option><option value="challenging">有一点挑战</option></select></label><label class="field">一句话记录<textarea id="activity-note" maxlength="160" placeholder="记录一个小发现（选填）"></textarea></label>` : ""}<div class="actions">${record.step_index ? button("previous-step", "上一步", "", true) : ""}${button(record.step_index === record.activity.steps.length - 1 ? "finish" : "next-step", record.step_index === record.activity.steps.length - 1 ? "完成活动" : "下一步")}${button("skip", "跳过这次活动", "", true)}</div></section><aside class="panel"><img class="figure-robot" src="assets/dingdong/robot-wave.webp" alt="DingDong 陪你探索"><h2>慢慢来，也很好。</h2><p>不必追求标准答案，和孩子一起观察、尝试就好。</p><p class="note">进度已保存，可以稍后继续。</p></aside></div>`
  );
}
function sessionView(s) {
  if (["draft", "ready"].includes(s.status)) {
    const q = s.questions[state.question];
    const answers =
      s.answers.find((a) => a.question_code === q.code)?.option_codes || [];
    return (
      head(s.title || "测评问卷", s.description || "可以按自己的节奏完成。") +
      `<section class="panel question">${testTag()}<p class="note">第 ${state.question + 1} / ${s.questions.length} 题 · ${s.missing_question_codes.length ? "还有 " + s.missing_question_codes.length + " 题未完成" : "已全部作答"}</p><progress value="${state.question + 1}" max="${s.questions.length}" aria-label="问卷进度"></progress><form id="answer-form"><fieldset><legend>${esc(q.title)}</legend><p class="note">${q.required ? "必填" : "选填，可跳过"} · ${q.type === "single_choice" ? "单选" : "最多选 " + q.max_choices + " 项"}</p>${q.options.map((o) => `<label class="answer-option"><input type="${q.type === "single_choice" ? "radio" : "checkbox"}" name="answer" value="${esc(o.code)}" ${answers.includes(o.code) ? "checked" : ""}>${esc(o.label)}</label>`).join("")}</fieldset><div class="form-error" role="alert"></div><div class="actions">${state.question ? button("previous-question", "上一题", "", true) : ""}<button type="submit" class="button">${state.question === s.questions.length - 1 ? "保存并完成" : "保存并下一题"}</button>${button("cancel-assessment", "取消本次测评", "", true)}</div></form></section>`
    );
  }
  return submissionView(s);
}
function submissionView(s) {
  if (s.purpose === "assessment" && s.status === "completed")
    return (
      head(s.title || "问卷体验", "回看这次留下的回答。") +
      `<section class="panel question">${testTag()}${s.completed_at ? `<p class="note">完成于 ${date(s.completed_at)}</p>` : ""}${(s.choice_summary || []).map((row) => `<div class="report-section"><h3>${esc(row.question)}</h3><p>${row.choices.length ? row.choices.map(esc).join("、") : "本题未选择"}</p></div>`).join("")}<div class="actions"><a class="button" href="#home">选一个小活动</a><a class="button secondary" href="#reports">返回体验记录</a></div></section>`
    );
  if (s.purpose === "exploration")
    return (
      head(s.title, s.description) +
      `<section class="panel question">${testTag()}${s.status === "completed" ? `<h2>这次，你这样选择</h2>${renderGuidanceSummary(s.guidance_summary)}<p>这些选择只描述此刻的想法，不代表固定类型、天赋或能力。</p>${s.choice_summary.map((row) => `<div class="report-section"><h3>${esc(row.question)}</h3><p>${row.choices.length ? row.choices.map(esc).join("、") : "本题未选择"}</p></div>`).join("")}` : s.status === "ready" ? `<h2>准备好留下这次选择了吗？</h2><p>提交后会保留本次答案。你也可以先返回修改。</p><div class="actions">${button("complete-exploration", "完成探索体验")}${button("review-answers", "返回修改", "", true)}</div>` : `<h2>${esc(statusNames[s.status] || s.status)}</h2>`}<div class="form-error" role="alert"></div><div class="actions"><a class="button secondary" href="#reports">返回测评与报告</a><a class="text-button" href="#companion">选择伙伴引导</a>${s.status === "completed" ? button("redo-exploration", "再做一次探索体验", "", true) : ""}${exportButton()}</div></section>`
    );
  return (
    head("本次测评", statusNames[s.status] || s.status) +
    `<section class="panel question">${testTag()}${["ready", "needs_recapture"].includes(s.status) ? `<h2>确认这次回答</h2><p>完成后可以在体验记录中回看，也可以先返回修改。</p><div class="actions">${button("submit-samples", "完成并保存")}${button("review-answers", "查看问卷", "", true)}</div>` : s.status === "completed" ? `<h2>本次测评已处理完成</h2><p>${s.report_status === "ready" ? "报告已经生成，可以查看。" : s.report_status === "failed" ? "报告生成失败，请提交服务事项，由工作人员处理。" : "报告正在生成，页面会自动更新。"}</p>${s.report_id ? button("report", "回看这次记录", `data-id="${s.report_id}"`) : button("refresh", "刷新处理状态", "", true)}` : s.status === "result_unknown" ? `<h2>处理结果待确认</h2><p>本次请求未取得确定结果。请先查询最新状态，或取消本次测评后重新开始。</p>${button("refresh", "查询最新状态")}` : ["cancelled", "expired"].includes(s.status) ? `<h2>${esc(statusNames[s.status])}</h2>${button("begin-assessment", "重新开始测评")}` : `<h2>正在处理本次测评</h2><p>请稍候，页面会自动查询处理状态。</p>${button("refresh", "查询最新状态", "", true)}`}<div class="form-error" role="alert"></div><div class="actions">${!["completed", "cancelled", "expired"].includes(s.status) ? button("cancel-assessment", "取消本次测评", "", true) : ""}<a class="text-button" href="#reports">返回测评与报告</a></div></section>`
  );
}
function metrics(rows) {
  return rows.length
    ? `<ul class="metric-list">${rows.map((m) => `<li><span>${esc(m.label)}</span><strong>${m.value === null ? "暂无数据" : esc(m.value) + " " + esc(m.unit)}</strong></li>`).join("")}</ul>`
    : '<p class="muted">暂时没有记录。</p>';
}
function observationBlock(obs) {
  const titles = {
    unbound: "还没有连接机器人记录",
    no_consent: "需要同意查看机器人记录",
    not_synced: "正在等待机器人记录",
    no_data: "这段时间还没有机器人记录",
    stale: "上次的机器人记录",
    error: "暂时无法更新机器人记录",
    ready: "机器人互动记录",
  };
  return `<section class="panel"><div class="card-heading"><h2>${titles[obs.availability] || "机器人记录"}</h2>${testTag()}</div>${["stale", "error"].includes(obs.availability) ? '<div class="notice error">暂时没有新记录，以下是上次的内容。</div>' : ""}${obs.metrics.length ? metrics(obs.metrics) : ""}${obs.availability === "unbound" || obs.availability === "no_consent" ? '<a class="button secondary" href="#settings">管理机器人</a>' : ""}</section>`;
}
/** 面一 + 面三的空态/错误态正文：一句状态 + 可选的去向。 */
function faceEmpty(view) {
  return `<p class="companion-state"><b>${esc(view.title)}</b></p>${view.note ? `<p>${esc(view.note)}</p>` : ""}${view.settings ? '<a class="button secondary" href="#settings">管理机器人</a>' : ""}`;
}
function staleNotice(view) {
  return view.stale ? `<div class="notice">${esc(STALE_NOTICE)}</div>` : "";
}
/** 面一：人设卡。后端已给中文 `type_label` 与 `learning_style_labels`，前端不维护映射表。 */
function personaBlock(view) {
  if (!view.showData)
    return `<div class="companion-persona">${faceEmpty(view)}</div>`;
  const p = view.persona;
  // 学习风格：正文只给中文对照，对方原始 code 只进 title（对方 code 表尚未确认）。
  const labels = p.learning_style_labels || [];
  const tags = (p.learning_style_tags || [])
    .map((code, index) => {
      const label = labels[index] || "未识别取值";
      return `<span title="${esc(code)}">${esc(label)}</span>`;
    })
    .join("、");
  return `<div class="companion-persona"><div class="companion-head"><h3>${esc(p.persona_name)}</h3>${p.type_label ? `<span class="tag">${esc(p.type_label)}</span>` : ""}</div>${p.public_description ? `<p>${esc(p.public_description)}</p>` : ""}${view.matchScore === null ? "" : metrics([{ label: "匹配度", value: view.matchScore, unit: "/ 100" }])}<p class="note">匹配度仅供参考，不是对孩子能力的评价。</p>${tags ? `<p class="note">学习风格：${tags}</p>` : ""}${staleNotice(view)}</div>`;
}
/** 面三：互动健康度四态。分数只在 `normal` 出现，且必须与观察天数一起给。 */
function healthBlock(view, reassessment = { show: false }) {
  const state = `<p class="companion-state"><b>${esc(view.label)}</b></p>${view.note ? `<p>${esc(view.note)}</p>` : ""}`;
  const facts = view.showScore
    ? metrics([
        { label: "健康度分数", value: view.score, unit: "/ 100" },
        { label: "观察天数", value: view.observationDays, unit: "天" },
      ])
    : view.observationDays === null
      ? ""
      : `<p class="note">已观察 ${view.observationDays} 天。</p>`;
  return `<div class="companion-health"><h3>互动情况</h3>${view.showData ? state + (view.triggerLabel ? `<p class="note">${esc(view.triggerLabel)}</p>` : "") + facts + staleNotice(view) : faceEmpty(view)}${reassessmentBlock(reassessment)}</div>`;
}
/**
 * 「陪学伙伴」面板：人设卡在上、互动健康度在下，复测 CTA 落在健康度这一段内。
 *
 * 复测是产品里唯一的入口（设计 §1.4），面板级徽标只挂一次，
 * 三个面共用同一个 `testTag()`（当前为空实现，见函数注释）。
 */
function companionPanel(persona, health, reassessment) {
  const p = personaSection(persona);
  const h = healthSection(health);
  const r = reassessmentSection(reassessment, {
    expanded: state.reassessmentExpanded,
    sync: state.reassessmentWrite,
    completion: state.reassessmentResult,
    error: state.reassessmentRespondError?.message,
  });
  const badge = p.synthetic || h.synthetic || r.synthetic ? testTag() : "";
  return `<section class="panel companion-panel"><div class="card-heading"><h2>陪学伙伴</h2>${badge}</div>${personaBlock(p)}${healthBlock(h, r)}<p class="note">${esc(HEALTH_FOOTER)}</p></section>`;
}
/** 面四：复测建议与回写。没有待处理建议时整块不出现（设计 §3.2）。 */
function reassessmentBlock(view) {
  if (!view.show) return "";
  const when = view.recommendedAt
    ? `<p class="note">建议时间 ${date(view.recommendedAt)}${view.triggerLabel ? ` · 这次建议的原因：${esc(view.triggerLabel)}` : ""}</p>`
    : "";
  const sync = view.syncNote ? `<p class="note">${esc(view.syncNote)}</p>` : "";
  // 回写失败的落点就在这一块里：不借道 `showError()`，否则会写进页面上第一个
  // `.form-error`（`#reports` 里那是「成长观察」的窗口表单）。
  const failure = view.error
    ? `<div class="notice error"><b>${esc(WRITE_FAILED_TEXT)}</b><p>${esc(view.error)}</p><div class="actions">${button("reassessment-retry", "重试", "", true)}</div></div>`
    : "";
  const actions = view.actions.length
    ? `<div class="actions">${view.actions
        .map((a) =>
          a === "accept"
            ? button("reassessment-accept", "重新测评")
            : a === "decline"
              ? button("reassessment-decline", "先不测", "", true)
              : button("start-reassessment", "开始复测"),
        )
        .join("")}</div>`
    : "";
  if (view.phase === "declined")
    return `<div class="reassessment"><p class="companion-state">${esc(view.title)}</p>${view.expanded ? when + `<p class="note">${esc(view.expandedNote)}</p>` : ""}<div class="actions">${button("reassessment-expand", view.expanded ? "收起" : "查看当时的建议", "", true)}</div>${failure}${sync}</div>`;
  if (view.phase === "done")
    return `<div class="reassessment"><p class="companion-state"><b>${esc(view.title)}</b></p>${view.completion ? completionBlock(view.completion) : `<p>${esc(view.note)}</p>`}${when}${failure}${sync}</div>`;
  return `<div class="reassessment"><p class="reassessment-suggest">${esc(view.title)}</p>${view.note ? `<p>${esc(view.note)}</p>` : ""}${when}${actions}${failure}${sync}</div>`;
}
/** `complete` 响应里的新角色建议：假分支不展示新角色名（设计 §1.4 第 4 步）。 */
function completionBlock(card) {
  const name = card.newPersonaName
    ? `<p>新角色 <b>${esc(card.newPersonaName)}</b>${card.matchScore === null ? "" : ` · 匹配度 ${card.matchScore} / 100`}</p>`
    : "";
  const rows = [];
  if (card.currentScore !== null)
    rows.push({
      label: "当前角色匹配度",
      value: card.currentScore,
      unit: "/ 100",
    });
  if (card.delta !== null)
    rows.push({ label: "匹配度变化", value: card.delta, unit: "" });
  return `<p class="companion-state"><b>${esc(card.title)}</b></p>${name}${rows.length ? metrics(rows) : ""}<p class="note">${esc(card.note)}</p>`;
}
/** 复测承接的这次测评跑完后，把结果回写；失败如实说，不静默。 */
function reassessmentWriteBackBlock() {
  if (state.reassessmentResult)
    return `<div class="notice"><b>本次复测已完成。</b><p>可以在「陪学伙伴」查看新的建议。</p></div>`;
  if (state.reassessmentWriteError)
    return `<div class="notice error"><b>暂时无法更新复测建议。</b><p>${esc(state.reassessmentWriteError)}</p><div class="actions">${button("refresh", "重试", "", true)}</div></div>`;
  return "";
}
/** 面二的两个固定 Tab；任意区间由既有「成长观察」承担，不是同一份数据。 */
function growthTabs() {
  return `<div class="growth-tabs" role="group" aria-label="周期长度">${PERIODS.map(
    ([value, label]) =>
      `<button type="button" class="chip ${state.growthPeriod === value ? "active" : ""}" data-action="growth-period" data-value="${value}" aria-pressed="${state.growthPeriod === value}">${label}</button>`,
  ).join("")}</div>`;
}
/** 八维条形。缺失维度只给一句说明：不出条形、不出 0、不插值。 */
function dimensionBars(rows) {
  return `<ul class="growth-dimensions">${rows
    .map((d) =>
      d.value === null
        ? `<li class="missing"><span class="dim-label">${esc(d.label.replace(/成长代理$/, ""))}</span><span class="dim-note">${esc(DIMENSION_MISSING)}</span></li>`
        : `<li><span class="dim-label">${esc(d.label.replace(/成长代理$/, ""))}</span><progress value="${d.value}" max="100" aria-label="${esc(d.label.replace(/成长代理$/, ""))}"></progress><strong>${d.value}</strong></li>`,
    )
    .join("")}</ul>`;
}
/**
 * 「成长周期报告」面板（设计 §1.2）：对方的 `growth_period`，固定 15/30 天。
 * 与「成长观察」（我方观察记录 + 任意窗口）是两份数据、两个来源，不合并。
 */
function growthCyclePanel(data) {
  const v = growthCycleSection(data);
  const head = `<div class="card-heading"><h2>成长周期报告</h2>${v.synthetic ? testTag() : ""}</div>${growthTabs()}`;
  if (!v.showData)
    return `<section class="panel growth-panel">${head}${faceEmpty(v)}</section>`;
  const companion =
    v.companionDelta === null
      ? ""
      : metrics([{ label: "陪伴值增长", value: v.companionDelta, unit: "" }]);
  const range =
    v.companionStart === null || v.companionEnd === null
      ? ""
      : `<p class="note">陪伴值 ${v.companionStart} → ${v.companionEnd}</p>`;
  const stage = v.stageNote
    ? `<p class="note">${esc(v.stageNote)}</p>`
    : `<p class="growth-stage">陪学成长阶段：<b>${esc(v.stageLabel)}</b>${v.stageProgress === null ? "" : ` · 阶段进度 ${v.stageProgress}%`}</p>`;
  return `<section class="panel growth-panel">${head}<p class="note">${esc(dateOnly(v.period.start))} — ${esc(dateOnly(v.period.end))}${v.personaName ? ` · 陪学伙伴 ${esc(v.personaName)}` : ""}</p>${companion}${range}${stage}<h3>成长的八个方面</h3>${dimensionBars(v.dimensions)}<p class="note">${esc(PROXY_NOTE)}</p>${staleNotice(v)}</section>`;
}
function localValue(v) {
  const d = new Date(v);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function windowForm() {
  return `<form id="window-form" class="window-form"><label class="field">开始时间<input type="datetime-local" name="from" required value="${localValue(state.window.from)}"></label><label class="field">结束时间<input type="datetime-local" name="to" required value="${localValue(state.window.to)}"></label><div class="form-error" role="alert"></div><button class="button secondary" type="submit">查看记录</button></form>`;
}
function queryWindow() {
  return "?" + new URLSearchParams(state.window);
}
function sectionFailure(error) {
  if (error.status === 401) throw error;
  return { error };
}
function sectionError(title) {
  return panel(
    title,
    `<p>请稍后再试，其他内容仍可查看。</p>${button("refresh", "重新读取", "", true)}`,
  );
}
function exhibitionEntry() {
  return panel(
    "展会体验",
    '<p>看看演示报告，和 DingDong 聊聊。</p><a class="button secondary" href="#exhibition">进入展会体验</a>',
  );
}
async function recordExhibitionVisit(event, tick, child) {
  if (tick !== viewEpoch || state.child?.id !== child || !state.user) return;
  const key = `exhibition:${state.user.id}:${tick}:${event}`;
  try {
    await API.request("/exhibition/visits", {
      method: "POST",
      body: { event, request_id: requestKey(key) },
    });
    keys.delete(key);
  } catch {
    /* Tracking must never interrupt the family's experience. */
  }
}
async function render() {
  clearTimeout(smsCooldownTimer);
  const tick = ++viewEpoch;
  // 重渲染只取消待执行的轮询与还在读的语音，不关对话框、不动编辑会话
  // （T-041 的 P-16）。朗读不跟着重渲染停会盖住新一题/下一步的内容。
  clearTimeout(pollTimer);
  pollPending = false;
  window.speechSynthesis?.cancel();
  header();
  if (!state.user) return loginPage();
  if (!state.child) {
    if (location.hash === "#settings") {
      try {
        const receipts = await API.all("/data-requests");
        if (tick !== viewEpoch) return;
        return page(
          head("账户与关联") +
            `<section class="panel"><h2>家长账户</h2><p>${esc(state.user.phone_masked)}</p><div class="actions">${button("add-child", "添加儿童档案")}${button("logout", "退出登录", "", true)}</div>${receiptList(receipts.reverse())}</section>`,
        );
      } catch (e) {
        showError(e);
        return;
      }
    }
    return childForm();
  }
  const child = state.child.id;
  let [route, id] = location.hash.slice(1).split("/");
  route = route || "explore";
  $("#main").setAttribute("aria-busy", "true");
  let html = "";
  try {
    if (
      !["reports", "settings", "exhibition", "companion", "services"].includes(
        route,
      )
    )
      await loadCompanionPreference(child);
    if (tick !== viewEpoch || state.child?.id !== child) return;
    if (["explore", "talents", "interest"].includes(route)) {
      await loadExplorers(child, route, id);
      if (tick !== viewEpoch || state.child?.id !== child) return;
    }
    if (route === "talents") {
      html = window.TalentExplorer.render();
    } else if (route === "fingerprint") {
      html = window.FingerprintLab.render();
    } else if (route === "interest" && id) {
      html =
        window.IslandExplorer.render() +
        `<div class="actions">${button("show-interest-result", "查看这次兴趣组合")}</div>`;
    } else if (route === "explore") {
      const [sessions, records] = await Promise.all([
        API.all(`/children/${child}/assessments`).catch(sectionFailure),
        API.all(`/children/${child}/activity-records`).catch(sectionFailure),
      ]);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      const task =
        sessions.error || records.error
          ? sectionError("上次进度暂时读不到")
          : renderExperienceTask(nextExperience(sessions, records, child));
      html =
        `<div id="experience-task-slot">${task}</div>` +
        window.PlayWorld.render() +
        `<div class="grid extra-links"><section class="card"><h2>从一个小行动开始</h2><p>选一个适合此刻心情的活动，和孩子一起试试看。</p><a class="button" href="#home">今日陪伴</a></section><section class="card"><h2>把观察慢慢积累下来</h2><p>回看每次探索和活动留下的记录。</p><a class="button secondary" href="#reports">测评与报告</a></section></div>`;
    } else if (route === "home") {
      const [activities, records] = await Promise.all([
        API.all("/activities"),
        API.all(`/children/${child}/activity-records?status=active`),
      ]);
      const active = records[0];
      const filtered = activities.filter(
        (a) =>
          (!state.mood || a.mood === state.mood) &&
          (!state.island || a.island === state.island),
      );
      hints.activities = activities;
      html =
        head("今日陪伴", "跟着此刻的心情，开始一个小小的行动。") +
        `<div class="hero-panel"><div><span class="eyebrow">HELLO, LITTLE EXPLORER</span><h2>${esc(state.child.name)}，<br>今天想发现什么？</h2><p>一点好奇，一点尝试。每一步，都有自己的意义。</p></div><img src="assets/dingdong/robot-wave.webp" alt="DingDong 成长伙伴"></div>` +
        (active
          ? `<div class="notice"><b>有一个活动等你继续：${esc(active.activity.title)}</b><div class="actions">${button("resume-activity", "继续活动", `data-id="${active.id}"`)}</div></div>`
          : "") +
        filters() +
        (state.island
          ? `<p>${esc(islands[state.island])}小岛 ${button("clear-island", "查看全部小岛", "", true)}</p>`
          : "") +
        activityCards(filtered) +
        `<div class="actions">${button("surprise", "换一个灵感活动", "", true)}</div>`;
    } else if (route === "activity" && id) {
      const record = await API.request("/activity-records/" + id);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      if (record.child_id !== child)
        throw new Error("请先切换到对应的儿童档案。");
      state.record = record;
      html =
        record.status === "active"
          ? stepView(record)
          : head("活动记录") +
            `<section class="panel"><h2>${esc(record.activity.title)}</h2><p>${record.status === "completed" ? "已完成" : "已跳过"} · ${date(record.finished_at)}</p><p>${esc(record.note)}</p><a href="#journey" class="button">查看成长旅程</a></section>`;
    } else if (route === "journey") {
      const [result, sessions, records] = await Promise.all([
        API.request(journeyPath(child)),
        API.all(`/children/${child}/assessments`).catch(sectionFailure),
        API.all(`/children/${child}/activity-records`).catch(sectionFailure),
      ]);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      nextCursor = result.next_cursor;
      html =
        head("成长旅程", "把每次的小发现，慢慢积累起来。", exportButton()) +
        `<div id="experience-task-slot">${sessions.error || records.error ? '<section class="panel"><h2>下一次，想一起做什么？</h2><a class="button" href="#home">选一个小活动</a></section>' : renderExperienceTask(nextExperience(sessions, records, child))}</div>` +
        `<div class="actions" role="group" aria-label="活动记录筛选">${[
          ["", "全部"],
          ["completed", "已完成"],
          ["skipped", "已跳过"],
        ]
          .map(
            ([value, label]) =>
              `<button class="chip ${state.journeyStatus === value ? "active" : ""}" data-action="journey-filter" data-value="${value}" aria-pressed="${state.journeyStatus === value}">${label}</button>`,
          )
          .join(
            "",
          )}</div><div class="stats"><div><b>${result.summary.completed_count}</b><span>完成活动</span></div><div><b>${result.summary.active_days}</b><span>留下记录的日子</span></div></div><div id="timeline" class="timeline">${timeline(result.items)}</div>${result.next_cursor ? button("more-records", "加载更多", "", true) : ""}`;
    } else if (route === "assessment" && id) {
      const s = await API.request("/assessments/" + id);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      if (s.child_id !== child) throw new Error("请先切换到对应的儿童档案。");
      if (state.session?.id !== s.id) {
        const firstMissing = s.questions.findIndex((q) =>
          s.missing_question_codes.includes(q.code),
        );
        state.question = firstMissing < 0 ? 0 : firstMissing;
      }
      state.session = s;
      state.question = Math.min(state.question, s.questions.length - 1);
      await writeBackReassessment(child, s);
      html =
        (hints.showSubmission !== false && s.status === "ready"
          ? submissionView(s)
          : sessionView(s)) +
        (s.purpose === "assessment" && s.status === "completed"
          ? reassessmentWriteBackBlock()
          : "");
      if (
        ["processing", "result_unknown"].includes(s.status) ||
        (s.status === "completed" && s.report_status === "processing")
      )
        schedulePoll(tick, 2500);
    } else if (route === "report" && id) {
      const [r, sessions] = await Promise.all([
        API.request("/reports/" + id),
        API.all(`/children/${child}/assessments`),
      ]);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      if (r.child_id !== child) throw new Error("请先切换到对应的儿童档案。");
      const session = sessions.find((row) => row.report_id === r.id);
      if (session && r.kind === "initial") html = submissionView(session);
      else
        html =
          head(
            "历史体验记录",
            "回看已保存的记录。",
            '<a href="#reports" class="button secondary">返回体验记录</a>',
          ) +
          `<article class="panel">${testTag()}<p class="note">保存于 ${date(r.generated_at)}</p>${r.sections.map((section) => `<section class="report-section"><h2>${esc(section.title)}</h2>${section.paragraphs.map((text) => `<p>${esc(text)}</p>`).join("")}</section>`).join("")}</article>`;
    } else if (route === "reports") {
      const [reports, sessions, catalog, accounts, activities] =
        await Promise.all([
          API.all(`/children/${child}/reports`).catch(sectionFailure),
          API.all(`/children/${child}/assessments`).catch(sectionFailure),
          API.request("/assessment-config").catch(sectionFailure),
          API.all(`/children/${child}/ca-accounts`).catch(sectionFailure),
          API.all(`/children/${child}/activity-records`).catch(sectionFailure),
        ]);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      const bound = accounts.error ? null : boundAccount(accounts, child);
      const reportTicket = ++robotReadEpoch;
      const reportRead =
        bound && isPrototypeDemo(bound)
          ? API.request(
              `/children/${child}/prototype-demo?cached=1&weekly_turns=${state.dingdongWeeklyTurns}`,
            ).catch(sectionFailure)
          : null;
      hints.accounts = accounts.error ? [] : accounts;
      const chat = safeChatUrl(bound?.chat_url);
      const chatAction = chat
        ? `<div class="actions"><a class="button" href="${esc(chat)}" target="_blank" rel="noopener noreferrer">和 DingDong 对话 ↗</a></div>`
        : "";
      const robotReport = bound
        ? chatAction +
          dingdongReportPanel(
            reportRead ? { loading: true } : null,
            isPrototypeDemo(bound),
          )
        : "";
      const assessmentRows = sessions.error ? [] : sessions;
      const banks = catalog.error
        ? []
        : catalog.questionnaires.filter((q) =>
            ["exploration", "assessment"].includes(q.purpose),
          );
      const unfinished = assessmentRows.filter(
        (s) =>
          ["exploration", "assessment"].includes(s.purpose) &&
          !["completed", "cancelled", "expired"].includes(s.status),
      );
      const questionnaireCards = banks
        .map((q) => {
          const resume = [...unfinished]
            .reverse()
            .find((s) => s.questionnaire_code === q.code);
          return `<article class="card"><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><p class="note">${esc(q.question_count)} 题</p>${resume ? button("continue-assessment", "继续这份问卷", `data-id="${esc(resume.id)}"`) : button("begin-bank", "开始这份问卷", `data-id="${esc(q.id)}" data-purpose="${esc(q.purpose)}"`)}</article>`;
        })
        .join("");
      const active = [...unfinished]
        .reverse()
        .find((s) => s.questionnaire_code === "initial-assessment");
      state.session = active || null;
      const resumes = unfinished.length
        ? panel(
            "继续测评",
            `<div class="actions">${unfinished.map((s) => button("continue-assessment", `${esc(s.title)} · 继续`, `data-id="${esc(s.id)}"`, true)).join("")}</div>`,
          )
        : "";
      const history = renderExperienceRecords(
        experienceRecords(
          assessmentRows,
          reports.error ? [] : reports,
          activities.error ? [] : activities,
          child,
        ),
      );
      const exhibition =
        !bound && state.runtime?.exhibition_enabled ? exhibitionEntry() : "";
      const quickLinks = bound
        ? `<nav class="actions report-jumps" aria-label="报告页内导航">${button("report-jump", "机器人报告", 'data-target="dingdong-growth-report"', true)}${button("report-jump", "体验记录", 'data-target="personal-assessments"', true)}</nav>`
        : "";
      html =
        head("测评与报告", "回看孩子的探索与测评结果。", exportButton()) +
        `<div class="report-flow">${quickLinks}${robotReport}<section id="personal-assessments" class="report-flow"><h2 class="report-section-title">体验记录</h2>${sessions.error ? sectionError("探索记录暂时读不到") : ""}${activities.error ? sectionError("活动记录暂时读不到") : ""}${history}${resumes}<details class="panel assessment-start"><summary>开始测评</summary><div class="grid">${catalog.error ? sectionError("测评列表暂时读不到") : questionnaireCards || "<p>暂时没有可开始的问卷，请稍后再来看看。</p>"}</div></details></section>${exhibition}</div>`;
      if (reportRead) {
        // CA results are already usable while the independent robot request is pending.
        page(html);
        bindForms();
        if (hints.nfcToken && !hints.nfcPrompted) {
          hints.nfcPrompted = true;
          bindRobotDialog(hints.nfcToken);
        }
        // The first page has taken over startup. A slow supplier must not hold appReady.
        reportRead
          .then((result) => {
            if (
              tick !== viewEpoch ||
              state.child?.id !== child ||
              reportTicket !== robotReadEpoch
            )
              return;
            const slot = document.getElementById("dingdong-growth-report");
            if (slot)
              slot.outerHTML = dingdongReportPanel(
                result,
                isPrototypeDemo(bound),
              );
          })
          .catch((error) => {
            if (
              tick !== viewEpoch ||
              state.child?.id !== child ||
              reportTicket !== robotReadEpoch
            )
              return;
            if (error.status === 401) {
              forget();
              loginPage();
            } else {
              const slot = document.getElementById("dingdong-growth-report");
              if (slot)
                slot.outerHTML = dingdongReportPanel(
                  { error },
                  isPrototypeDemo(bound),
                );
            }
          });
        return;
      }
    } else if (route === "exhibition") {
      if (!state.runtime?.exhibition_enabled) {
        html = empty(
          "展会体验已结束",
          "可以继续探索，或查看孩子的测评结果。",
          '<a class="button" href="#explore">继续探索</a>',
        );
      } else {
        const result = await API.request(
          `/exhibition/report?cached=1&weekly_turns=${state.dingdongWeeklyTurns}`,
        ).catch(sectionFailure);
        if (tick !== viewEpoch || state.child?.id !== child) return;
        hints.exhibitionRendered =
          !result.error && ["ready", "stale"].includes(result.availability);
        const chat = safeChatUrl(state.runtime.exhibition_chat_url);
        html =
          head(
            "展会体验",
            "这里使用演示内容，供你和孩子一起体验。",
            '<a class="button secondary" href="#companion">返回我的 DingDong</a>',
          ) +
          `<div class="report-flow"><section class="panel"><p>演示报告不代表孩子的测评结果。以后绑定自己的机器人，就能查看专属陪伴记录。</p><div class="actions">${chat ? `<a class="button" href="${esc(chat)}" target="_blank" rel="noopener noreferrer">和 DingDong 对话 ↗</a>` : ""}${button("bind-robot", "绑定自己的机器人", "", true)}</div><p class="note">多人共享这次演示，伙伴和内容可能随体验变化。</p></section>${dingdongReportPanel(result, true)}</div>`;
      }
    } else if (route === "settings") {
      const [consents, associations, receipts, accounts] = await Promise.all([
        API.all(`/children/${child}/consents`),
        API.all(`/children/${child}/associations`),
        API.all("/data-requests"),
        API.all(`/children/${child}/ca-accounts`),
      ]);
      if (tick !== viewEpoch || state.child?.id !== child) return;
      state.consents = consents;
      hints.accounts = accounts;
      html =
        head(
          "账户与关联",
          "管理孩子的资料和机器人。",
          '<div class="actions"><a href="#companion" class="button secondary">我的 DingDong</a><a href="#services" class="text-button">家长支持</a></div>',
        ) +
        `<div class="grid"><section class="panel"><h2>儿童档案</h2><p><b>${esc(state.child.name)}</b></p><p>${{ unknown: "性别未填写", male: "男", female: "女" }[state.child.gender]} · ${state.child.birth_date ? "出生于 " + esc(state.child.birth_date) : "出生日期未填写"}</p><div class="actions">${button("edit-child", "编辑档案", "", true)}${button("add-child", "添加儿童档案", "", true)}</div></section><section class="panel"><h2>家长账户</h2><p>${esc(state.user.phone_masked)}</p>${button("logout", "退出登录", "", true)}</section><section class="panel"><h2>用途授权</h2>${[
          "assessment_processing",
          "dingdong_sync",
        ]
          .map((p) => {
            const c = consents.find((c) => c.purpose === p && !c.revoked_at);
            return `<div class="key-value"><span>${p === "assessment_processing" ? "测评记录" : "机器人记录"}</span><div>${c ? `<b>已同意</b> ${button("revoke-consent", "撤回授权", `data-id="${c.id}"`, true)}` : "尚未授权"}</div></div>`;
          })
          .join(
            "",
          )}<p class="note">撤回会阻止后续处理；如果需要清除已有数据，请提交删除事项。</p></section>${robotPanel(accounts)}${
          associations.some((a) => a.status === "verified")
            ? `<section class="panel"><h2>其他机器人记录</h2>${
                associations.some((a) => a.status === "verified")
                  ? associations
                      .filter((a) => a.status === "verified")
                      .map(
                        (a) =>
                          `<span class="tag">${!consents.some((c) => c.purpose === "dingdong_sync" && !c.revoked_at) ? "记录已暂停" : a.sync_status === "enabled" ? "记录已连接" : a.sync_status === "paused" ? "记录已暂停" : "记录已停止"}</span>${button("revoke-association", "停止查看记录", `data-id="${a.id}"`, true)}`,
                      )
                      .join("")
                  : ""
              }</section>`
            : ""
        }</div><section class="panel receipts"><h2>帮助与资料</h2><p>需要帮助，或想申请修改、删除孩子的资料，可以从这里提交。</p><div class="actions">${button("data-request", "需要帮助", 'data-kind="support"', true)}${button("data-request", "申请修改资料", 'data-kind="correction"', true)}${button("data-request", "申请删除儿童数据", 'data-kind="deletion"', true)}</div>${receiptList(receipts.reverse())}</section>`;
    } else if (route === "companion") {
      const [pref, accounts] = await Promise.all([
        loadCompanionPreference(child, true).catch(sectionFailure),
        API.all(`/children/${child}/ca-accounts`).catch(sectionFailure),
      ]);
      if (!pref || tick !== viewEpoch || state.child?.id !== child) return;
      hints.accounts = accounts.error ? [] : accounts;
      const guidance = pref.error
        ? sectionError("亲子引导暂时读不到")
        : `<div class="grid"><section class="panel"><img class="figure-robot" src="assets/dingdong/robot-front.webp" alt="DingDong 伙伴"><h2>你好呀，我在这里。</h2><p>${esc(greeting(pref.guide_mode))}</p>${button("greeting", "听伙伴打个招呼", "", true)}</section><section class="panel"><h2>你喜欢怎样一起探索？</h2><p>选一种舒服的方式，开始今天的小行动。</p><div class="stack">${button("companion-exploration", "用 4 个小情境了解引导偏好")}<div class="stack">${Object.entries(
            GUIDE_MODES,
          )
            .map(
              ([k, v]) =>
                `<button class="chip ${pref.guide_mode === k ? "active" : ""}" data-action="style" data-value="${k}" aria-pressed="${pref.guide_mode === k}"><strong>${esc(v.label)}</strong><span> · ${esc(v.description)}</span></button>`,
            )
            .join(
              "",
            )}</div></div><div class="actions"><a href="#home" class="button">去做一个小行动</a></div><div class="form-error" role="alert"></div></section></div>`;
      html =
        head("我的 DingDong", "你带着好奇来，我陪你一步一步试。") +
        (accounts.error
          ? sectionError("机器人连接暂时读不到")
          : renderRobotEntry(accounts, child, state.runtime)) +
        guidance;
    } else if (route === "services") {
      html =
        head("家长支持", "先陪孩子多看一眼、多试一次。") +
        `<div class="grid"><article class="panel"><h2>陪伴时，可以这样做</h2><p>把指令换成邀请：“要不要一起试试看？”</p><p>先听孩子的发现，再说自己的观察。</p><p>允许休息、跳过与重新尝试。</p>${button("parent-reflection", "一起回想今天的小发现")}</article><article class="panel"><h2>看见孩子的变化</h2><p>回顾真实的小事，给下一次探索留一点期待。</p><div class="actions"><a class="button" href="#reports">查看成长记录</a><a class="button secondary" href="https://happykua.com/CareerAcademy.html" target="_blank" rel="noopener noreferrer">了解 Career Academy ↗</a></div></article></div>`;
    } else {
      html = empty(
        "没有找到这个页面",
        "可以回到探索页继续。",
        '<a class="button" href="#explore">返回探索</a>',
      );
    }
    if (tick !== viewEpoch || state.child?.id !== child) return;
    if (route === "settings")
      html += `<section class="panel"><h2>留下探索的小发现</h2><p>下载当前孩子的探索回答、结果与亲子活动记录。</p><div class="actions">${exportButton()}</div></section>`;
    if (route === "interest" && id)
      html += `<div class="actions">${exportButton()}</div>`;
    page(html);
    if (route === "exhibition" && state.runtime?.exhibition_enabled) {
      const viewed = hints.exhibitionRendered === true;
      recordExhibitionVisit("entered", tick, child);
      if (viewed) recordExhibitionVisit("report_viewed", tick, child);
    }
    // 「刚生成」只强调一次：账户页渲染出来之后这个号就不再冒充新号。
    if (route === "settings") hints.newAccountId = "";
    bindForms();
    if (route === "fingerprint") window.FingerprintLab.mount();
    // 凭据是在登录之前就取到的：等页面真的渲染出来再弹绑定，
    // 家长不必自己找入口。只在有凭据时弹一次。
    if (hints.nfcToken && !hints.nfcPrompted) {
      hints.nfcPrompted = true;
      bindRobotDialog(hints.nfcToken);
    }
  } catch (e) {
    if (tick !== viewEpoch) return;
    if (e.status === 401) {
      forget();
      loginPage();
      return;
    }
    page(empty("暂时无法读取这一页", e.message, button("refresh", "重新读取")));
  }
}
function timeline(rows) {
  return rows.length
    ? rows
        .map(
          (r) =>
            `<article><time>${date(r.finished_at || r.started_at)}</time><h3>${esc(r.activity.title)}</h3><p>${r.status === "completed" ? "已完成" : r.status === "skipped" ? "已跳过" : "进行中"}</p>${r.note ? `<p>${esc(r.note)}</p>` : ""}${r.status === "active" ? button("resume-activity", "继续活动", `data-id="${r.id}"`, true) : ""}</article>`,
        )
        .join("")
    : empty(
        state.journeyStatus
          ? "还没有" +
              (state.journeyStatus === "completed" ? "已完成" : "已跳过") +
              "的活动"
          : "第一份记录，等你来留下",
        state.journeyStatus
          ? "可以查看全部记录，或开始一个新活动。"
          : "选一个活动，和孩子一起开始。",
        '<a class="button" href="#home">查看活动</a>',
      );
}
function receiptList(rows) {
  return `<h3 style="margin-top:28px">申请进度</h3>${rows.length ? rows.map((r) => `<article class="notice"><b>${{ support: "帮助事项", correction: "资料修正", deletion: "儿童数据删除" }[r.kind]} · ${{ open: "待处理", processing: "处理中", completed: "已完成", cancelled: "已取消" }[r.status]}</b><p class="note">提交于 ${date(r.created_at)}${r.completed_at ? " · 完成于 " + date(r.completed_at) : ""}</p></article>`).join("") : "<p>还没有申请记录。</p>"}`;
}
/**
 * 机器人账户（CA 账户）。
 *
 * 两个状态维度必须分开说，不许合并成一句「已绑定」：
 *   status     —— 我方这边这个号还用不用（使用中 / 已归档）
 *   bind_state —— 对方有没有确认接通（待接通 / 已绑定）
 * 新号建出来时 bind_state 就是「待接通」，这是正常状态，不是出错，也不能
 * 为了让界面好看而提前改成「已绑定」。
 */
const ROBOT_JOIN_NOTE =
  "已记录这台机器人，正在等待连接。请重新连接；刷新页面后，请再碰一次原标签。";
const ROBOT_REPLACEMENT_IMPACT =
  "换机后，新机器人的成长记录会重新积累；以前的报告仍可查看。";

function accountRow(a) {
  const active = a.status === "active";
  const bound = a.bind_state === "bound";
  // 这次会话里刚生成的号高亮一次：家长绑定完第一眼要看到的就是它。
  const fresh = a.ca_account_id === hints.newAccountId;
  // 归档的号不显示接通状态：对方侧那边怎么处置还没定（D20），我们只能保证本地这一半。
  const tags = active
    ? `<span class="tag">${esc(ACCOUNT_STATUS.active)}</span><span class="tag${bound ? "" : " warn"}">${esc(BIND_STATE[a.bind_state] || a.bind_state)}</span>`
    : `<span class="tag muted">${esc(ACCOUNT_STATUS.retired)}</span>`;
  return `<div class="account-row${fresh ? " is-new" : ""}"><span class="account-role">${active ? "当前机器人" : "上一台机器人"}</span><div class="account-body">${fresh ? '<span class="tag fresh">刚添加</span>' : ""}${tags}<p class="note">${active ? "添加于" : "停用于"} ${date(active ? a.created_at : a.unbound_at)}</p><details><summary>查看设备信息</summary><code class="inline-code">${esc(a.ca_account_id)}</code><p class="note">识别码 ${esc(a.nfc_token_fingerprint)}${a.robot_ref ? " · " + esc(a.robot_ref) : ""}</p></details></div></div>`;
}
function robotPanel(rows, companion = null) {
  const active = activeAccount(rows);
  const retired = retiredAccounts(rows);
  // 只读人设行：人设由机器人服务下发，家长端不提供修改入口，取不到就不显示这一行。
  const persona = personaSection(companion);
  const companionLine = persona.showData
    ? `<p class="note">当前陪学伙伴：<b>${esc(persona.persona.persona_name)}</b>${persona.persona.type_label ? " · " + esc(persona.persona.type_label) : ""}</p>`
    : "";
  const detected = hints.nfcToken
    ? `<div class="notice"><b>发现一台待绑定的机器人</b><div class="actions">${button("bind-robot", "绑定这台机器人")}${button("drop-nfc", "这次不绑", "", true)}</div></div>`
    : "";
  const reconnect =
    active?.bind_state === "unbound" && hints.nfcToken
      ? button("bind-robot", "重新连接")
      : "";
  const current = active
    ? accountRow(active) +
      (active.bind_state === "bound"
        ? `<div class="actions"><a class="button" href="#reports">查看机器人报告</a>${safeChatUrl(active.chat_url) ? `<a class="button secondary" href="${esc(safeChatUrl(active.chat_url))}" target="_blank" rel="noopener noreferrer">和 DingDong 对话 ↗</a>` : ""}</div>`
        : `<p class="notice">${esc(ROBOT_JOIN_NOTE)}</p>`) +
      `<div class="actions">${reconnect}${button("replace-robot", "换一台机器人", `data-id="${esc(active.ca_account_id)}"`)}${button("retire-account", "解绑机器人", `data-id="${esc(active.ca_account_id)}"`, true)}</div>`
    : `<p>还没有为 <b>${esc(state.child.name)}</b> 绑定机器人。</p>${button("bind-robot", "绑定机器人")}`;
  const history = retired.length
    ? `<h3 style="margin-top:26px">以前的机器人</h3>${retired.map(accountRow).join("")}`
    : "";
  return `<section class="panel"><div class="card-heading"><h2>我的机器人</h2>${testTag()}</div>${nfcRecoveryNotice()}${detected}${current}${companionLine}${history}</section>`;
}
function dingdongReportPanel(result, demonstration = false) {
  if (result?.error?.code === "STATE_CONFLICT")
    return `<section class="panel" id="dingdong-growth-report"><h2>DingDong 陪伴成长报告</h2><p>机器人绑定已改变，请重新查看当前连接。</p><a href="#settings" class="button secondary">查看机器人连接</a></section>`;
  if (result?.error?.status === 403)
    return `<section class="panel" id="dingdong-growth-report"><h2>DingDong 陪伴成长报告</h2><p>同意查看机器人记录后，就能查看伙伴的成长变化。</p>${button("prototype-consent", "同意并查看")}</section>`;
  if (result?.error?.code === "DINGDONG_BIND_PENDING")
    return `<section class="panel" id="dingdong-growth-report"><h2>DingDong 陪伴成长报告</h2><p>机器人正在等待连接。请到“账户与关联”重新碰原标签连接。</p><a href="#settings" class="button secondary">查看机器人连接</a></section>`;
  return `<section class="panel" id="dingdong-growth-report">${result?.error ? renderDingDongReport(null, { status: "error", demonstration }) : renderDingDongReport(result?.loading ? null : result, { status: result?.loading ? "loading" : undefined, demonstration })}</section>`;
}
async function refreshRobotReport({ cached = false } = {}) {
  const tick = viewEpoch,
    child = state.child?.id,
    route = location.hash.slice(1).split("/")[0];
  if (!["reports", "exhibition"].includes(route) || !child) return;
  const exhibition = route === "exhibition";
  const bound = exhibition ? null : boundAccount(hints.accounts || [], child);
  if (!exhibition && (!bound || !isPrototypeDemo(bound))) return;
  const ticket = ++robotReadEpoch;
  const slot = document.getElementById("dingdong-growth-report");
  if (!slot) return;
  slot.querySelector(".robot-refresh-status")?.remove();
  slot.insertAdjacentHTML(
    "afterbegin",
    '<p class="note robot-refresh-status" role="status">正在更新陪伴记录，其他内容可以继续查看。</p>',
  );
  const path = exhibition
    ? "/exhibition/report"
    : `/children/${child}/prototype-demo`;
  try {
    const result = await API.request(
      `${path}?weekly_turns=${state.dingdongWeeklyTurns}${cached ? "&cached=1" : ""}`,
    );
    if (
      tick !== viewEpoch ||
      state.child?.id !== child ||
      ticket !== robotReadEpoch
    )
      return;
    slot.outerHTML = dingdongReportPanel(
      result,
      exhibition || isPrototypeDemo(bound),
    );
    if (exhibition && ["ready", "stale"].includes(result.availability))
      void recordExhibitionVisit("report_viewed", tick, child);
  } catch (error) {
    if (
      tick !== viewEpoch ||
      state.child?.id !== child ||
      ticket !== robotReadEpoch
    )
      return;
    if (error.status === 401) {
      forget();
      loginPage();
      return;
    }
    if (
      slot.querySelector(".dd-report-summary") &&
      ![403, 404, 409].includes(error.status)
    ) {
      slot.querySelector(".robot-refresh-status").textContent =
        "暂时没能更新，先看看已保存的记录。";
    } else
      slot.outerHTML = dingdongReportPanel(
        { error },
        exhibition || isPrototypeDemo(bound),
      );
  }
}
async function prototypeConsent() {
  const policy = await API.request("/policies/current?purpose=dingdong_sync", {
    auth: false,
  });
  showDialog(
    "查看陪学伙伴",
    `<p>同意后，可以查看孩子与伙伴的互动记录。</p><div class="policy-body">${esc(policy.body)}</div><form id="prototype-consent-form"><label class="checkline"><input type="checkbox" name="agree">我已阅读并同意查看机器人记录</label><button class="button" type="submit">同意并查看</button></form>`,
  );
  $("#prototype-consent-form").onsubmit = (e) => {
    e.preventDefault();
    act(async () => {
      if (!e.target.elements.agree.checked)
        throw new Error("请先阅读并同意查看机器人记录。");
      await consent("dingdong_sync", policy);
      closeDialog();
      await render();
    }, e.submitter);
  };
}
function bindRobotDialog(token = "") {
  showDialog(
    "绑定机器人",
    `<p>用手机碰一下机器人上的标签，信息会自动填入；也可以手动输入。一台机器人只能绑定一个孩子。</p><form id="bind-robot-form" novalidate><label class="field">这台机器人服务的孩子<select name="child_id">${state.children.map((c) => `<option value="${c.id}" ${c.id === state.child?.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label class="field">机器人凭据<input name="nfc_token" value="${esc(token)}" required maxlength="2048" autocomplete="off" spellcheck="false" placeholder="从机器人标签上取得"></label><button class="button" type="submit">确认绑定</button></form>`,
  );
  $("#bind-robot-form").onsubmit = (e) => {
    e.preventDefault();
    if (!e.target.elements.nfc_token.value.trim()) {
      $("#dialog .form-error").textContent =
        "请先填写机器人凭据，或让手机碰一下机器人上的标签自动带进来。";
      return;
    }
    act(() => submitRobotBinding(e.target), e.submitter);
  };
}
async function submitRobotBinding(form) {
  const data = formData(form);
  const token = data.nfc_token;
  const child = data.child_id;
  try {
    const account = await API.request(`/children/${child}/ca-accounts`, {
      method: "POST",
      body: {
        request_id: requestKey("ca-issue:" + child + ":" + token),
        nfc_token: token,
        ...(hints.nfcRobotRef ? { robot_ref: hints.nfcRobotRef } : {}),
      },
    });
    keys.delete("ca-issue:" + child + ":" + token);
    hints.nfcToken = account.bind_state === "bound" ? "" : token;
    hints.nfcPrompted = true;
    markNfcPending(account.bind_state !== "bound");
    // 标签是裸链接时地址里没有任何路由，停在默认的探索页等于把刚生成的号藏起来：
    // 绑定成功一律落到「账户与关联」，并把这个号高亮一次。
    hints.newAccountId = account.ca_account_id;
    toast(
      account.bind_state === "bound"
        ? "机器人已连接。"
        : "机器人已添加，正在等待连接。",
    );
    to("settings");
  } catch (e) {
    if (!replaceFlowNeeded(e)) throw e;
    // 这个孩子已经有另一台机器人的活跃账户：换机是对外可见的两步，
    // 先让家长看清代价，再归档旧号、发新号。
    await openReplacement(child, token);
  }
}
async function openReplacement(child, token) {
  const context = explorationToken();
  const rows = await API.all(`/children/${child}/ca-accounts`);
  if (!explorerCurrent(context)) return;
  const account = activeAccount(rows.filter((row) => row.child_id === child));
  if (!account)
    throw new Error(
      "这个孩子已经绑定机器人，但页面暂时没能读到信息。请刷新后重试。",
    );
  if (child === state.child?.id) hints.accounts = rows;
  hints.replaceChild = child;
  replaceRobotDialog(account, token);
}
function replaceRobotDialog(account, token = "") {
  hints.replaceAccount = account;
  showDialog(
    "换一台机器人",
    `<p>换机后，当前机器人将停止使用。</p><div class="notice error"><b>请先了解换机影响</b><p>${esc(ROBOT_REPLACEMENT_IMPACT)}</p></div><form id="replace-robot-form"><label class="field">新机器人的凭据<input name="nfc_token" value="${esc(token)}" required maxlength="2048" autocomplete="off" spellcheck="false" placeholder="从机器人标签上取得"></label><button class="button danger" type="submit">确认换机</button></form>`,
  );
  $("#replace-robot-form").onsubmit = (e) => {
    e.preventDefault();
    act(() => submitRobotReplacement(e.target), e.submitter);
  };
}
async function submitRobotReplacement(form) {
  const token = formData(form).nfc_token;
  const child = hints.replaceChild || state.child.id;
  const account = hints.replaceAccount;
  if (!account || account.child_id !== child || account.status !== "active")
    throw new Error("机器人信息已变化，请重新打开绑定页面。");
  const key = "ca-replace:" + child + ":" + token;
  // 第一步不可回退：先归档旧号。归档成功之后即使发号失败，也要如实说清
  // "旧号已归档"，并让家长能用同一凭据补发，而不是含糊地整段重来。
  await API.request(
    `/ca-accounts/${encodeURIComponent(account.ca_account_id)}/retire`,
    { method: "POST", body: {} },
  );
  try {
    const created = await API.request(`/children/${child}/ca-accounts`, {
      method: "POST",
      body: {
        request_id: requestKey(key),
        nfc_token: token,
        ...(hints.nfcRobotRef ? { robot_ref: hints.nfcRobotRef } : {}),
      },
    });
    keys.delete(key);
    hints.nfcToken = "";
    hints.nfcPrompted = true;
    hints.newAccountId = created.ca_account_id;
    toast(
      created.bind_state === "bound"
        ? "已换到新机器人。"
        : "已换到新机器人，正在等待接通。",
    );
    to("settings");
  } catch (e) {
    throw new Error(
      "旧机器人已停用，新机器人尚未连接成功：" +
        errorMessage(e) +
        " 请用同一个凭据再试一次。",
    );
  }
}
function retireAccountDialog(account) {
  showDialog(
    "解绑机器人",
    `<p>解绑后，这个孩子将停止查看机器人记录。孩子在这里的探索、活动和测评报告会保留。</p><div class="actions">${button("confirm-retire", "确认解绑", `data-id="${esc(account.ca_account_id)}"`)}${button("close", "暂不操作", "", true)}</div>`,
  );
}
async function activityDetail(id) {
  const token = explorationToken();
  await loadCompanionPreference(state.child.id);
  if (!explorerCurrent(token)) return;
  const foundActivity =
    hints.activities?.find((a) => a.id === id) ||
    (await API.all("/activities")).find((a) => a.id === id);
  if (!explorerCurrent(token)) return;
  currentActivity = foundActivity;
  if (!currentActivity) throw new Error("这个活动已不可用，请刷新活动列表。");
  const a = currentActivity;
  showDialog(
    a.title,
    `<p>${esc(a.goal)}</p><div class="notice"><b>准备材料</b><p>${esc(a.materials)}</p></div><p>${esc(a.alternative)}</p><label class="field">活动方式<select id="activity-mode"><option value="guide">跟着引导</option><option value="web">自主探索</option></select></label><label class="field">陪伴方式<select id="activity-guide-mode">${Object.entries(
      GUIDE_MODES,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${k === state.companionPreference?.guide_mode ? "selected" : ""}>${esc(v.label)}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="actions">${button("start-activity", "开始活动")}</div>`,
  );
}
async function beginAssessment(purpose = "assessment", versionId = "") {
  const token = explorationToken(),
    child = state.child.id;
  const [config, consents] = await Promise.all([
    API.request(
      "/assessment-config?purpose=" +
        purpose +
        (versionId
          ? "&questionnaire_version_id=" + encodeURIComponent(versionId)
          : ""),
    ),
    API.all(`/children/${child}/consents`),
  ]);
  if (!explorerCurrent(token)) return;
  if (!config.available) throw new Error("暂时无法开始测评，请稍后再试。");
  hints.config = config;
  hints.grant = consents.find(
    (c) => c.purpose === "assessment_processing" && !c.revoked_at,
  );
  if (hints.grant) return createAssessment(hints.grant.id);
  const policy = await API.request(
    "/policies/current?purpose=assessment_processing",
    { auth: false },
  );
  if (!explorerCurrent(token)) return;
  hints.policy = policy;
  showDialog(
    "本次测评用途",
    `<div class="policy-body">${esc(policy.body)}</div><div class="notice"><b>处理目的</b><p>根据孩子的回答生成报告，供你查看。</p><b>数据范围</b><p>本次回答及完成时间。</p><b>数据去向</b><p>本次回答和记录保存在你的账户中。</p><b>保留与撤回</b><p>可在「账户与关联」撤回授权；已保存的报告不会自动删除，需要删除时可提交申请。</p></div><label class="checkline"><input id="consent-check" type="checkbox">我已阅读并同意本次测评用途</label><div class="actions">${button("agree-assessment", "同意并开始")}</div>`,
  );
}
async function createAssessment(grant) {
  const token = explorationToken(),
    child = state.child.id;
  const result = await API.request(`/children/${state.child.id}/assessments`, {
    method: "POST",
    body: {
      request_id: requestKey("assessment-create:" + state.child.id),
      questionnaire_version_id: hints.config.questionnaire_version_id,
      consent_grant_id: grant,
    },
  });
  if (!explorerCurrent(token) || result.child_id !== child) return;
  keys.delete("assessment-create:" + child);
  state.session = result;
  state.question = 0;
  hints.showSubmission = false;
  // 这次测评如果是「开始复测」承接来的，记下它的 id：完成后只回写它。
  if (state.reassessmentStart) {
    state.reassessmentSession = result.id;
    state.reassessmentStart = false;
  }
  to("assessment/" + result.id);
}
/**
 * 复测回写（设计 §1.4 第 2 步）：本地状态先落库，出站没确认就如实说一句。
 *
 * 同一个 `event_id` + 同一个 `accepted` 重放返回首次结果，所以重试安全；
 * 换个答案会被后端按 422 拒绝，前端因此不给第二个「重新测评」按钮。
 */
async function respondReassessment(accepted) {
  const view = reassessmentSection(state.reassessment);
  if (!view.eventId) throw new Error("这条复测建议已经失效，请刷新页面。");
  try {
    state.reassessmentWrite = await API.request(
      `/children/${state.child.id}/reassessment/${encodeURIComponent(view.eventId)}/response`,
      {
        method: "POST",
        body: {
          request_id: requestKey(
            `reassessment-response:${view.eventId}:${accepted}`,
          ),
          accepted,
        },
      },
    );
    state.reassessmentRespondError = null;
  } catch (e) {
    // 失败留在复测区块内并给重试入口：抛给 `act()` 会被 `showError()` 写到页面上
    // 第一个 `.form-error`，家长在「成长观察」看到一句跟复测无关的报错。
    state.reassessmentRespondError = { message: errorMessage(e), accepted };
  }
  state.reassessmentExpanded = false;
  await render();
}
/**
 * 复测承接（设计 §1.4 第 3 步）：这次测评跑完后，把它的 id 作为
 * `new_assessment_id` 回写 `POST .../complete`，结果供结果卡展示。
 *
 * 只回写「开始复测」承接的那一次测评（`state.reassessmentSession`），
 * 刷新过页面就认不出来，宁可不回写也不把别的测评 id 写过去。
 */
async function writeBackReassessment(child, session) {
  const view = reassessmentSection(state.reassessment);
  if (
    session.purpose !== "assessment" ||
    session.status !== "completed" ||
    view.phase !== "accepted" ||
    state.reassessmentSession !== session.id
  )
    return;
  try {
    state.reassessmentResult = await API.request(
      `/children/${child}/reassessment/${encodeURIComponent(view.eventId)}/complete`,
      {
        method: "POST",
        body: {
          request_id: requestKey("reassessment-complete:" + view.eventId),
          assessment_id: session.id,
        },
      },
    );
    state.reassessmentWriteError = "";
    // 回写成功后不再重复 POST；失败则保留标记，重试走同一个 `request_id`。
    state.reassessmentSession = null;
  } catch (e) {
    state.reassessmentWriteError = errorMessage(e);
  }
}
async function consent(purpose, policy) {
  const result = await API.request(`/children/${state.child.id}/consents`, {
    method: "POST",
    body: {
      request_id: requestKey("consent:" + state.child.id + ":" + purpose),
      policy_version_id: policy.id,
    },
  });
  keys.delete("consent:" + state.child.id + ":" + purpose);
  return result;
}
async function linkRobot() {
  const [policy, consents] = await Promise.all([
    API.request("/policies/current?purpose=dingdong_sync", { auth: false }),
    API.all(`/children/${state.child.id}/consents`),
  ]);
  hints.linkPolicy = policy;
  hints.linkGrant = consents.find(
    (c) => c.purpose === "dingdong_sync" && !c.revoked_at,
  );
  showDialog(
    "连接机器人记录",
    `<p>连接后，你可以查看孩子与机器人的互动记录。</p><div class="policy-body">${esc(policy.body)}</div>${!hints.linkGrant ? '<label class="checkline"><input type="checkbox" id="sync-check">我已阅读并同意获取机器人记录</label>' : '<p class="saved">你已同意此用途。</p>'}<form id="link-form"><label class="field">核验凭据<input name="entry_proof" required maxlength="2048" autocomplete="off" placeholder="输入机器人提供的凭据"></label><button class="button" type="submit">确认连接</button></form>`,
  );
  $("#link-form").onsubmit = (e) => {
    e.preventDefault();
    act(async () => {
      if (!hints.linkGrant) {
        if (!$("#sync-check").checked)
          throw new Error("请先阅读并同意获取机器人记录。");
        hints.linkGrant = await consent("dingdong_sync", hints.linkPolicy);
      }
      const proof = e.target.elements.entry_proof.value;
      await API.request(`/children/${state.child.id}/associations/verify`, {
        method: "POST",
        body: {
          request_id: requestKey("link:" + state.child.id + ":" + proof),
          consent_grant_id: hints.linkGrant.id,
          entry_proof: proof,
        },
      });
      e.target.reset();
      keys.clear();
      closeDialog();
      toast("已连接机器人记录，正在等待更新。");
      await render();
    }, e.submitter);
  };
}
const GENDER_TEXT = { unknown: "暂不填写", male: "男", female: "女" };
function editChild() {
  const c = state.child;
  childEdit = {
    id: c.id,
    revision: c.revision,
    conflict: false,
    retried: false,
    prompt: null,
    latest: null,
    showLatest: false,
    error: "",
  };
  showDialog(
    "编辑儿童档案",
    `<form id="edit-child-form">${childEditFields(c)}<button class="button" type="submit">保存修改</button></form><div id="child-conflict" class="conflict" role="status" hidden></div>`,
  );
  $("#edit-child-form").onsubmit = (e) => {
    e.preventDefault();
    act(() => saveChildEdit(), e.submitter);
  };
}
function childEditFields(c) {
  return `<label class="field">姓名或称呼<input name="name" value="${esc(c.name)}" required maxlength="80"></label><label class="field">性别<select name="gender">${Object.entries(
    GENDER_TEXT,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}" ${k === c.gender ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="field">出生日期（选填）<input type="date" name="birth_date" value="${esc(c.birth_date || "")}" max="${new Date().toISOString().slice(0, 10)}"></label>`;
}
function childEditDraft() {
  const d = formData($("#edit-child-form"));
  return { name: d.name, gender: d.gender, birth_date: d.birth_date || null };
}
/** 只用服务端最新内容改写输入框，且只在家长明确确认"载入最新资料"时调用。 */
function childEditFill(c) {
  const form = $("#edit-child-form");
  if (!form) return;
  form.elements.name.value = c.name || "";
  form.elements.gender.value = c.gender || "unknown";
  form.elements.birth_date.value = c.birth_date || "";
}
function conflictReadMessage(err) {
  if (err.status === 0)
    return "现在连不上服务，没能读到最新资料。你填写的内容还在这里，网络恢复后可以再试。";
  if (err.status === 401 || err.status === 403)
    return "登录状态已失效，请重新登录后再继续。你填写的内容还在这里。";
  if (err.status === 404)
    return "这份档案已经不存在或已被归档，请联系工作人员。你填写的内容还在这里。";
  return "暂时读不到最新资料，请稍后再试。你填写的内容还在这里。";
}
function conflictButton(action, label, kind = "") {
  return `<button type="button" class="button${kind ? " " + kind : ""}" data-action="${action}">${label}</button>`;
}
function conflictDiff(draft, latest) {
  const rows = [
    ["姓名或称呼", draft.name || "（空）", latest.name || "（空）"],
    [
      "性别",
      GENDER_TEXT[draft.gender] || "暂不填写",
      GENDER_TEXT[latest.gender] || "暂不填写",
    ],
    ["出生日期", draft.birth_date || "未填写", latest.birth_date || "未填写"],
  ];
  return `<table class="conflict-diff"><thead><tr><th>项目</th><th>我的填写（还没保存）</th><th>最新资料</th></tr></thead><tbody>${rows
    .map(
      ([label, mine, theirs]) =>
        `<tr${mine === theirs ? "" : ' class="diff"'}><td>${label}</td><td>${esc(mine)}</td><td>${esc(theirs)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
/** 冲突面板：只改提示区，绝不渲染表单，家长填的三个字段原样留在输入框里。 */
function renderChildConflict() {
  const box = $("#child-conflict");
  if (!box || !childEdit) return;
  const c = childEdit;
  const ask = {
    load: [
      "载入最新资料会把你正在填写的称呼、性别和出生日期换成对方保存的内容，你刚才的填写无法找回。",
      conflictButton("child-conflict-load-confirm", "确认载入并替换", "danger"),
    ],
    apply: [
      "确认后会以你刚刚看到的最新资料为准，用你填写的内容更新这份档案。如果这期间又有人改过，系统会再次提示，不会覆盖。",
      conflictButton("child-conflict-apply-confirm", "确认用我的修改保存"),
    ],
    close: [
      "你还有没有保存的修改，关闭后这些填写会丢失。",
      conflictButton("child-conflict-close-confirm", "仍然关闭", "danger"),
    ],
  };
  const actions = c.prompt
    ? `<p class="conflict-ask">${ask[c.prompt][0]}</p><div class="actions">${ask[c.prompt][1]}${conflictButton("child-conflict-cancel", "取消", "secondary")}</div>`
    : `<div class="actions">${conflictButton("child-conflict-view", c.showLatest ? "收起最新资料" : "查看最新资料", "secondary")}${conflictButton("child-conflict-load", "载入最新资料", "secondary")}${conflictButton("child-conflict-apply", "用我的修改保存")}</div>`;
  box.hidden = false;
  box.innerHTML =
    `<b>${c.retried ? "资料又被更新了一次，本次修改仍未保存" : "资料已被更新，本次修改没有保存"}</b>` +
    `<p>这份档案在你打开编辑后被其他页面更新过。为避免覆盖对方保存的内容，系统没有保存这次修改；你填写的称呼、性别和出生日期仍留在上面的表单里，可以继续改动，或选择下面的处理方式。</p>` +
    (c.error ? `<p class="conflict-error">${esc(c.error)}</p>` : "") +
    (c.showLatest && c.latest ? conflictDiff(childEditDraft(), c.latest) : "") +
    actions;
}
async function saveChildEdit() {
  if (!childEdit || !$("#edit-child-form")) return;
  let draft;
  try {
    draft = childEditDraft();
    // 带上本次编辑开始时读到的修订号：期间若有人（工作人员或其他页面）更正过，
    // 服务端会拒绝这次保存，而不是把对方的修改覆盖掉。
    state.child = await API.request("/children/" + childEdit.id, {
      method: "PATCH",
      body: { ...draft, revision: childEdit.revision },
    });
  } catch (err) {
    if (err.status === 409) {
      // 关键：不重建表单。家长填写的称呼、性别和生日原样留在输入框里，
      // 由家长自己决定是载入最新资料，还是把这份修改保存到最新修订之上。
      childEdit.retried = childEdit.conflict;
      childEdit.conflict = true;
      childEdit.prompt = null;
      childEdit.showLatest = false;
      childEdit.latest = null;
      childEdit.error = "";
      renderChildConflict();
      return;
    }
    throw err;
  }
  childEdit = null;
  await loadChildren();
  closeDialog();
  await render();
  toast("档案已更新。");
}
/** 只读对比：读最新资料放进面板，不动表单里的草稿。 */
async function childConflictView() {
  if (childEdit.showLatest) {
    childEdit.showLatest = false;
    childEdit.prompt = null;
    renderChildConflict();
    return;
  }
  try {
    childEdit.latest = await API.request("/children/" + childEdit.id);
    childEdit.error = "";
    childEdit.showLatest = true;
  } catch (err) {
    childEdit.showLatest = false;
    childEdit.error = conflictReadMessage(err);
  }
  childEdit.prompt = null;
  renderChildConflict();
}
/** 家长确认后，用最新资料替换表单，并把基准修订号推进到最新。 */
async function childConflictLoadLatest() {
  try {
    const latest = await API.request("/children/" + childEdit.id);
    childEditFill(latest);
    childEdit.latest = latest;
    childEdit.revision = latest.revision;
    childEdit.conflict = false;
    childEdit.retried = false;
    childEdit.prompt = null;
    childEdit.showLatest = false;
    childEdit.error = "";
    state.child = latest;
    const box = $("#child-conflict");
    if (box) {
      box.hidden = true;
      box.innerHTML = "";
    }
    toast("已载入最新资料，你刚才的填写已被替换。");
  } catch (err) {
    childEdit.prompt = null;
    childEdit.error = conflictReadMessage(err);
    renderChildConflict();
  }
}
/**
 * 家长要确认"把自己的修改应用到最新资料"：先把最新资料摆出来（只读），
 * 再让家长在看过之后确认。还没读过就先读一次，读失败只提示、不动草稿。
 */
async function childConflictAskApply() {
  if (!childEdit.latest) {
    try {
      childEdit.latest = await API.request("/children/" + childEdit.id);
    } catch (err) {
      childEdit.prompt = null;
      childEdit.error = conflictReadMessage(err);
      renderChildConflict();
      return;
    }
    childEdit.showLatest = true;
  }
  childEdit.prompt = "apply";
  childEdit.error = "";
  renderChildConflict();
}
/** 家长确认后，在"家长已经看到的那一版"之上保存本地草稿；期间再被改过仍会再次冲突。 */
async function childConflictApplyMine() {
  if (!childEdit.latest) {
    childConflictAskApply();
    return;
  }
  // 基准就是家长看到的那一版：不偷偷换成刚读到的新版本，
  // 否则等于把对方在此期间做的修改静默覆盖掉。
  childEdit.revision = childEdit.latest.revision;
  childEdit.prompt = null;
  childEdit.error = "";
  await saveChildEdit();
}
function dataRequestDialog(kind) {
  const name = {
    support: "帮助事项",
    correction: "资料修正",
    deletion: "儿童数据删除",
  }[kind];
  showDialog(
    "申请" + name,
    `<p>当前儿童：<b>${esc(state.child.name)}</b></p><p>${kind === "deletion" ? "提交后，工作人员会处理删除申请；孩子的数据不会立即删除。你可以在账户页查看进度。" : "提交后可以在账户页查看进度。"}</p><div class="actions">${button("confirm-request", "确认提交申请", `data-kind="${kind}"`)}${button("close", "暂不提交", "", true)}</div>`,
  );
}
function bindForms() {
  if ($("#answer-form"))
    $("#answer-form").onsubmit = (e) => {
      e.preventDefault();
      act(async () => {
        const s = state.session,
          q = s.questions[state.question];
        const choices = new FormData(e.target).getAll("answer");
        if (q.required && choices.length < q.min_choices)
          throw new Error("请先选择答案。");
        if (choices.length > q.max_choices)
          throw new Error("选择数量超过此题限制。");
        state.session = await API.request("/assessments/" + s.id + "/answers", {
          method: "PATCH",
          body: {
            revision: s.revision,
            answers: [{ question_code: q.code, option_codes: choices }],
          },
        });
        if (state.question === s.questions.length - 1) {
          if (state.session.missing_question_codes.length) {
            state.question = s.questions.findIndex(
              (q) => q.code === state.session.missing_question_codes[0],
            );
            toast("请补充尚未完成的题目。");
          } else hints.showSubmission = true;
        } else state.question++;
        await render();
      }, e.submitter);
    };
  if ($("#window-form")) {
    const form = $("#window-form");
    const windowRangeError = (show) => {
      form.querySelector(".form-error").textContent = show
        ? "结束时间要晚于开始时间"
        : "";
      for (const name of ["from", "to"]) {
        const input = form.querySelector(`input[name="${name}"]`);
        if (show) {
          input.setAttribute("aria-invalid", "true");
          input.classList.add("is-invalid");
        } else {
          input.removeAttribute("aria-invalid");
          input.classList.remove("is-invalid");
        }
      }
    };
    for (const name of ["from", "to"])
      form.querySelector(`input[name="${name}"]`).oninput = () =>
        windowRangeError(false);
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = formData(e.target),
        from = new Date(d.from),
        toDate = new Date(d.to);
      if (!(from < toDate)) return windowRangeError(true);
      windowRangeError(false);
      state.window = { from: from.toISOString(), to: toDate.toISOString() };
      render();
    };
  }
}
async function handleAction(action, el) {
  const id = el.dataset.id;
  switch (action) {
    case "close":
      // 冲突还没处理完就关闭，等于把家长未保存的填写丢掉：先问一句。
      if (childEdit?.conflict) {
        childEdit.prompt = "close";
        renderChildConflict();
        break;
      }
      closeDialog();
      break;
    case "child-conflict-view":
      await childConflictView();
      break;
    case "child-conflict-load":
      childEdit.prompt = "load";
      childEdit.error = "";
      renderChildConflict();
      break;
    case "child-conflict-apply":
      await childConflictAskApply();
      break;
    case "child-conflict-cancel":
      childEdit.prompt = null;
      childEdit.error = "";
      renderChildConflict();
      break;
    case "child-conflict-load-confirm":
      await childConflictLoadLatest();
      break;
    case "child-conflict-apply-confirm":
      await childConflictApplyMine();
      break;
    case "child-conflict-close-confirm":
      closeDialog();
      break;
    case "refresh":
      state.companionPreference = null;
      await render();
      break;
    case "report-jump":
      if (
        ["dingdong-growth-report", "personal-assessments"].includes(
          el.dataset.target,
        )
      )
        document
          .getElementById(el.dataset.target)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      break;
    case "journey-interest":
      if (location.hash !== "#explore") {
        leaveContext();
        history.replaceState(history.state, "", "#explore");
        await render();
      }
      window.IslandExplorer.goToIslands();
      break;
    case "journey-resume": {
      const token = explorationToken(),
        child = state.child.id;
      const session = await API.request(
        "/assessments/" + encodeURIComponent(id),
      );
      if (!explorerCurrent(token)) return;
      if (session.child_id !== child || session.purpose !== el.dataset.purpose)
        throw new Error("请重新打开当前孩子的探索记录。");
      if (!["interest", "talent"].includes(session.purpose)) {
        state.session = null;
        hints.showSubmission = undefined;
        to("assessment/" + session.id);
        break;
      }
      const target = `#${session.purpose === "interest" ? "interest" : "talents"}/${session.id}`;
      leaveContext();
      hints.explorerSessions ||= {};
      hints.explorerSessions[session.purpose] = session;
      hints.explorerRecord = session.id;
      explorerModule(session.purpose).setState(explorerState(session));
      history.replaceState(history.state, "", target);
      await render();
      if (
        state.child?.id === child &&
        location.hash === target &&
        ["draft", "ready"].includes(session.status)
      )
        await explorerModule(session.purpose).start();
      break;
    }
    case "dingdong-weekly-turns":
      if (![3, 7, 14, 21].includes(Number(el.dataset.value))) return;
      state.dingdongWeeklyTurns = Number(el.dataset.value);
      await refreshRobotReport({ cached: true });
      break;
    case "dingdong-report-refresh":
      await refreshRobotReport();
      break;
    case "prototype-consent":
      await prototypeConsent();
      break;
    case "mood":
      state.mood = el.dataset.value;
      await render();
      break;
    case "clear-island":
      state.island = "";
      await render();
      break;
    case "activity":
      await activityDetail(id);
      break;
    case "surprise": {
      const rows = (hints.activities || []).filter(
        (a) => !state.mood || a.mood === state.mood,
      );
      if (!rows.length) throw new Error("暂时没有可选的活动。");
      await activityDetail(rows[Math.floor(Math.random() * rows.length)].id);
      break;
    }
    case "start-activity": {
      const token = explorationToken();
      const a = currentActivity;
      const style = a.allowed_styles.includes(state.style)
          ? state.style
          : a.allowed_styles[0],
        mode = $("#activity-mode").value,
        guide_mode = $("#activity-guide-mode").value;
      const r = await API.request(
        `/children/${state.child.id}/activity-records`,
        {
          method: "POST",
          body: {
            request_id: requestKey(
              "activity:" +
                state.child.id +
                ":" +
                a.id +
                ":" +
                mode +
                ":" +
                style +
                ":" +
                guide_mode,
            ),
            activity_version_id: a.id,
            mode,
            style,
            guide_mode,
          },
        },
      );
      if (!explorerCurrent(token)) return;
      state.record = r;
      keys.clear();
      to("activity/" + r.id);
      break;
    }
    case "resume-activity":
      to("activity/" + id);
      break;
    case "previous-step":
    case "next-step": {
      const token = explorationToken();
      const r = state.record;
      const saved = await API.request("/activity-records/" + r.id, {
        method: "PATCH",
        body: {
          revision: r.revision,
          step_index: r.step_index + (action === "previous-step" ? -1 : 1),
        },
      });
      if (!explorerCurrent(token)) return;
      state.record = saved;
      await render();
      break;
    }
    case "finish":
    case "skip": {
      const token = explorationToken();
      const r = state.record;
      const body =
        action === "skip"
          ? { status: "skipped" }
          : {
              status: "completed",
              feedback: $("#feedback").value || null,
              note: $("#activity-note").value,
            };
      await API.request("/activity-records/" + r.id + "/finish", {
        method: "POST",
        body,
      });
      if (!explorerCurrent(token)) return;
      toast(
        action === "skip"
          ? "已记录跳过，可以换个活动再试试。"
          : "这次小发现，已经记下来了。",
      );
      to("journey");
      break;
    }
    case "speak": {
      speak(guideText(state.record));
      break;
    }
    case "greeting":
      speak(greeting(state.companionPreference?.guide_mode));
      break;
    case "style": {
      const token = explorationToken(),
        child = state.child.id;
      const pref = await loadCompanionPreference(child);
      if (!pref || !explorerCurrent(token)) return;
      const saved = await API.request(
        `/children/${child}/companion-preference`,
        {
          method: "PATCH",
          body: { guide_mode: el.dataset.value, revision: pref.revision },
        },
      );
      if (!explorerCurrent(token) || saved.child_id !== child) return;
      state.companionPreference = saved;
      await render();
      break;
    }
    case "export-child":
      await exportChild();
      break;
    case "journey-filter":
      state.journeyStatus = ["completed", "skipped"].includes(el.dataset.value)
        ? el.dataset.value
        : "";
      nextCursor = null;
      await render();
      break;
    case "companion-exploration": {
      const token = explorationToken(),
        child = state.child.id;
      const rows = await API.all(
        `/children/${child}/assessments?purpose=exploration`,
      );
      if (!explorerCurrent(token)) return;
      const draft = [...rows]
        .reverse()
        .find(
          (s) =>
            s.questionnaire_code === "exploration" &&
            ["draft", "ready"].includes(s.status) &&
            (!s.expires_at || Date.parse(s.expires_at) > Date.now()),
        );
      if (draft) {
        state.session = null;
        hints.showSubmission = undefined;
        to("assessment/" + draft.id);
      } else {
        const completed = [...rows]
          .reverse()
          .find(
            (s) =>
              s.questionnaire_code === "exploration" &&
              s.status === "completed",
          );
        if (completed) {
          state.session = null;
          hints.showSubmission = undefined;
          to("assessment/" + completed.id);
        } else await beginAssessment("exploration");
      }
      break;
    }
    case "redo-exploration":
      await beginAssessment(
        "exploration",
        state.session?.questionnaire_version_id || "",
      );
      break;
    case "parent-reflection":
      showDialog(
        "一起回想三个小发现",
        `<p>不用急着评价，听听孩子怎么说。</p><ol><li>刚才哪一小步，你最喜欢？</li><li>有没有什么和你想的不一样？</li><li>下次你还想试点什么？</li></ol><p>孩子还不想说时，可以告诉他：“等你想分享的时候，我都在。”</p><div class="actions">${button("close", "记下了")}</div>`,
      );
      break;
    case "growth-period":
      // 两个固定 Tab；换 Tab 重新取该周期的报告，「成长观察」的窗口不受影响。
      state.growthPeriod = el.dataset.value;
      await render();
      break;
    case "reassessment-accept":
      await respondReassessment(true);
      break;
    case "reassessment-decline":
      await respondReassessment(false);
      break;
    case "reassessment-expand":
      state.reassessmentExpanded = !state.reassessmentExpanded;
      await render();
      break;
    case "reassessment-retry": {
      const failed = state.reassessmentRespondError;
      if (!failed) throw new Error("当前无法重试，请刷新页面。");
      await respondReassessment(failed.accepted);
      break;
    }
    case "start-reassessment":
      // 承接既有测评流程，不新建第二套测评入口。
      state.reassessmentStart = true;
      state.reassessmentWriteError = "";
      await beginAssessment();
      break;
    case "more-records": {
      const token = explorationToken();
      const r = await API.request(journeyPath(state.child.id, nextCursor));
      if (!explorerCurrent(token)) return;
      $("#timeline").insertAdjacentHTML("beforeend", timeline(r.items));
      nextCursor = r.next_cursor;
      if (!nextCursor) el.remove();
      break;
    }
    case "agree-explorer": {
      if (!$("#explorer-consent").checked)
        throw new Error("请先阅读并同意保存本次回答。");
      const pending = hints.pendingExplorer;
      if (!pending || pending.child !== state.child.id)
        throw new Error("请重新开始探索。");
      const token = explorationToken();
      await consent("assessment_processing", pending.policy);
      if (!explorerCurrent(token)) break;
      delete hints.pendingExplorer;
      closeDialog();
      if (pending.fresh) await explorerModule(pending.purpose).restart();
      else await explorerModule(pending.purpose).start();
      break;
    }
    case "show-interest-result":
      await window.IslandExplorer.start();
      break;
    case "exploration-guide-task":
      await explorationBridge.task(el.dataset.code);
      break;
    case "blindbox":
      hints.activities = await API.all("/activities");
      if (!hints.activities.length) throw new Error("暂时没有可选的活动。");
      await activityDetail(
        hints.activities[Math.floor(Math.random() * hints.activities.length)]
          .id,
      );
      break;
    case "begin-bank":
      await beginAssessment(el.dataset.purpose, id);
      break;
    case "begin-exploration":
      await beginAssessment("exploration");
      break;
    case "begin-assessment":
      await beginAssessment();
      break;
    case "agree-assessment":
      if (!$("#consent-check").checked)
        throw new Error("请先阅读并同意本次测评用途。");
      await createAssessment(
        (await consent("assessment_processing", hints.policy)).id,
      );
      break;
    case "continue-assessment":
      state.session = null;
      hints.showSubmission = undefined;
      to("assessment/" + id);
      break;
    case "previous-question": {
      const s = state.session,
        q = s.questions[state.question];
      const choices = new FormData($("#answer-form")).getAll("answer");
      state.session = await API.request("/assessments/" + s.id + "/answers", {
        method: "PATCH",
        body: {
          revision: s.revision,
          answers: [{ question_code: q.code, option_codes: choices }],
        },
      });
      state.question = Math.max(0, state.question - 1);
      await render();
      break;
    }
    case "review-answers":
      state.question = 0;
      hints.showSubmission = false;
      await render();
      break;
    case "complete-exploration":
      await API.request(
        "/assessments/" + state.session.id + "/complete-exploration",
        { method: "POST", body: { revision: state.session.revision } },
      );
      await render();
      break;
    case "submit-samples": {
      const s = state.session;
      const config = await API.request("/assessment-config");
      if (config.input_requirements.collection_mode !== "synthetic_only")
        throw new Error("当前采集方式尚未接入，请稍后再试。");
      const form = new FormData();
      const k = "submit:" + s.id;
      form.set("request_id", requestKey(k));
      form.set("revision", String(s.revision));
      for (let i = 1; i <= 5; i++) {
        const r = await fetch(`assets/sample-${i}.png`);
        if (!r.ok) throw new Error("观察样例暂不可用，请稍后再试。");
        form.set(`slot_${i}`, await r.blob(), `sample-${i}.png`);
      }
      try {
        await API.request("/assessments/" + s.id + "/submit", {
          method: "POST",
          body: form,
        });
        await render();
      } catch (e) {
        if (e.status !== 0) keys.delete(k);
        await render();
        showError(e);
      } finally {
        for (let i = 1; i <= 5; i++) form.delete(`slot_${i}`);
      }
      break;
    }
    case "cancel-assessment":
      await API.request("/assessments/" + state.session.id + "/cancel", {
        method: "POST",
        body: {},
      });
      state.session = null;
      to("reports");
      break;
    case "report":
      to("report/" + id);
      break;
    case "edit-child":
      editChild();
      break;
    case "add-child":
      childDraft = state.child;
      state.child = null;
      childForm();
      break;
    case "link-robot":
      await linkRobot();
      break;
    case "bind-robot":
      bindRobotDialog(hints.nfcToken || "");
      break;
    case "drop-nfc":
      hints.nfcToken = "";
      markNfcPending(false);
      hints.nfcPrompted = true;
      toast("已取消绑定。");
      await render();
      break;
    case "replace-robot": {
      const target = (hints.accounts || []).find((a) => a.ca_account_id === id);
      if (!target) throw new Error("找不到这台机器人，请刷新后重试。");
      hints.replaceChild = state.child.id;
      replaceRobotDialog(target);
      break;
    }
    case "retire-account": {
      const target = (hints.accounts || []).find((a) => a.ca_account_id === id);
      if (!target) throw new Error("找不到这台机器人，请刷新后重试。");
      retireAccountDialog(target);
      break;
    }
    case "confirm-retire":
      await API.request(`/ca-accounts/${encodeURIComponent(id)}/retire`, {
        method: "POST",
        body: {},
      });
      closeDialog();
      toast("机器人关联已解除。");
      await render();
      break;
    case "revoke-consent":
      await API.request("/consents/" + id + "/revoke", {
        method: "POST",
        body: {},
      });
      toast("授权已撤回。");
      await render();
      break;
    case "revoke-association":
      await API.request("/associations/" + id + "/revoke", {
        method: "POST",
        body: {},
      });
      toast("已停止获取机器人记录。");
      await render();
      break;
    case "data-request":
      dataRequestDialog(el.dataset.kind);
      break;
    case "confirm-request": {
      const kind = el.dataset.kind;
      await API.request(`/children/${state.child.id}/data-requests`, {
        method: "POST",
        body: {
          request_id: requestKey("request:" + state.child.id + ":" + kind),
          kind,
          reason_code: {
            support: "support_needed",
            correction: "correct_profile",
            deletion: "delete_child_data",
          }[kind],
        },
      });
      keys.clear();
      closeDialog();
      await render();
      toast("申请已提交，可以在账户页查看进度。");
      break;
    }
    case "logout":
      await API.logout();
      channel?.postMessage({ logout: true });
      forget();
      markNfcPending(false);
      try {
        sessionStorage.removeItem("ca.navigation");
      } catch {}
      loginPage();
      break;
  }
}
function speak(text) {
  if (!("speechSynthesis" in window))
    return toast("当前浏览器无法朗读，可以继续阅读文字。");
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  u.onerror = () => toast("暂时无法朗读，可以继续阅读文字。");
  window.speechSynthesis.speak(u);
}
document.addEventListener("click", (e) => {
  if (e.target.closest(".skip-link")) {
    e.preventDefault();
    $("#main").focus();
    return;
  }
  // Only our freshly-created export Blob may download during its busy action.
  const anchor = e.target.closest("a");
  if (busy && anchor && !downloadUrls.has(anchor.href)) {
    e.preventDefault();
    return;
  }
  const currentNav = e.target.closest("#mobile-nav a, #main-nav a");
  if (currentNav?.hash === location.hash) {
    e.preventDefault();
    window.scrollTo(0, 0);
    return;
  }
  const el = e.target.closest("[data-action]");
  if (!el) return;
  e.preventDefault();
  if (
    ["dingdong-report-refresh", "dingdong-weekly-turns"].includes(
      el.dataset.action,
    )
  ) {
    // These reads affect the robot slot only; CA navigation and child selection stay usable.
    if (busy || el.disabled) return;
    el.disabled = true;
    void handleAction(el.dataset.action, el)
      .catch(() => toast("暂时没能更新陪伴记录，可以继续其他体验。"))
      .finally(() => {
        el.disabled = false;
      });
    return;
  }
  act(() => handleAction(el.dataset.action, el), el);
});
window.addEventListener("hashchange", () => {
  if (!state.child && childDraft) {
    state.child = childDraft;
    childDraft = null;
  }
  leaveContext();
  window.scrollTo(0, 0);
  render();
});
// 对话框关闭后补上被挂起的那次轮询。推迟一个任务：换路由引起的关闭会紧接着重渲染
// 一次（那时 pollPending 已清），只有「用完对话框还留在同一页」才需要在这里补。
$("#dialog").addEventListener("close", () => {
  if (state.child && ["#explore", "#journey"].includes(location.hash))
    void updateExperienceTask(state.child.id, explorationToken());
  if (!pollPending) return;
  setTimeout(() => {
    if (pollPending) render();
  }, 0);
});
$("#child-select").onchange = (e) => {
  stopWork();
  window.IslandExplorer.reset();
  window.TalentExplorer.reset();
  state.child = state.children.find((c) => c.id === e.target.value);
  clearRobotContext();
  state.session = null;
  state.record = null;
  state.question = 0;
  state.island = "";
  state.companionPreference = null;
  state.journeyStatus = "";
  state.dingdongWeeklyTurns = 7;
  nextCursor = null;
  keys.clear();
  saveHints();
  to("explore");
};
const explorerModule = (purpose) =>
  purpose === "interest" ? window.IslandExplorer : window.TalentExplorer;
const explorationToken = () =>
  `${state.user?.id}:${state.child?.id}:${location.hash}:${explorationEpoch}`;
const explorerCurrent = (token) => token === explorationToken();
async function loadExplorers(child, route, id) {
  if (hints.explorerChild !== child) {
    const token = explorationToken();
    const rows = (await API.all(`/children/${child}/assessments`)).reverse();
    if (!explorerCurrent(token)) return;
    hints.explorerChild = child;
    hints.explorerRecord = null;
    hints.explorerSessions = {};
    for (const purpose of ["interest", "talent"]) {
      const session = resumableSession(rows, purpose);
      hints.explorerSessions[purpose] = session || null;
      explorerModule(purpose).setState(explorerState(session));
    }
  }
  if (
    id &&
    ["interest", "talents"].includes(route) &&
    hints.explorerRecord !== id
  ) {
    const token = explorationToken();
    const session = await API.request("/assessments/" + encodeURIComponent(id));
    if (!explorerCurrent(token)) return;
    const purpose = route === "interest" ? "interest" : "talent";
    if (session.child_id !== child || session.purpose !== purpose)
      throw new Error("请先切换到对应的儿童档案。");
    hints.explorerSessions[purpose] = session;
    hints.explorerRecord = id;
    explorerModule(purpose).setState(explorerState(session));
  }
}
async function ensureExplorer(purpose, selected = [], fresh = false) {
  const token = explorationToken(),
    child = state.child.id;
  const current = hints.explorerSessions?.[purpose];
  let expired = false;
  if (
    !fresh &&
    current &&
    (purpose !== "interest" ||
      sameSelection(current.selected_islands || [], selected))
  ) {
    const latest = await API.request("/assessments/" + current.id);
    if (!explorerCurrent(token)) return null;
    if (
      ["draft", "ready", "completed"].includes(latest.status) &&
      (latest.status === "completed" ||
        !latest.expires_at ||
        Date.parse(latest.expires_at) > Date.now())
    ) {
      hints.explorerSessions[purpose] = latest;
      return explorerState(latest);
    }
    expired =
      latest.status !== "completed" &&
      Date.parse(latest.expires_at) <= Date.now();
  }
  const [config, grants] = await Promise.all([
    API.request("/assessment-config?purpose=" + purpose),
    API.all(`/children/${child}/consents`),
  ]);
  if (!explorerCurrent(token)) return null;
  if (!config.available) throw new Error("这份探索还未开放，请稍后再来。");
  const grant = grants.find(
    (c) => c.purpose === "assessment_processing" && !c.revoked_at,
  );
  if (!grant) {
    const policy = await API.request(
      "/policies/current?purpose=assessment_processing",
      { auth: false },
    );
    if (!explorerCurrent(token)) return null;
    hints.pendingExplorer = { child, purpose, selected, policy, fresh };
    showDialog(
      "保存这次探索",
      `<p>回答会保存在当前儿童档案中，方便下次继续和回看。</p><details class="policy-details"><summary>查看使用说明</summary><div class="policy-body">${esc(policy.body)}</div></details><label class="checkline"><input id="explorer-consent" type="checkbox">我已阅读并同意保存本次回答</label>${actions(button("agree-explorer", "同意并开始"), button("close", "稍后再说", "", true))}`,
    );
    return null;
  }
  const key = `explorer-create:${child}:${purpose}:${selected.join("")}:${fresh ? "new" : "resume"}`;
  const session = await API.request(`/children/${child}/assessments`, {
    method: "POST",
    body: {
      request_id: requestKey(key),
      questionnaire_version_id: config.questionnaire_version_id,
      consent_grant_id: grant.id,
      ...(purpose === "interest" ? { selected_islands: selected } : {}),
    },
  });
  keys.delete(key);
  if (!explorerCurrent(token)) return null;
  hints.explorerSessions ||= {};
  hints.explorerSessions[purpose] = session;
  if (expired) toast("上次探索已结束，这次从第一题开始。");
  return explorerState(session);
}
async function updateExperienceTask(child, token) {
  if (!document.getElementById("experience-task-slot")) return;
  try {
    const [sessions, records] = await Promise.all([
      API.all(`/children/${child}/assessments`),
      API.all(`/children/${child}/activity-records`),
    ]);
    if (!explorerCurrent(token) || state.child?.id !== child) return;
    const slot = document.getElementById("experience-task-slot");
    if (slot)
      slot.innerHTML = renderExperienceTask(
        nextExperience(sessions, records, child),
      );
  } catch {
    // Completion succeeded. A failed progress refresh must not undo its result.
  }
}
const explorationBridge = {
  context: explorationToken,
  isCurrent: explorerCurrent,
  run: (fn, el) => act(fn, el),
  ensure: ensureExplorer,
  adopt(purpose) {
    const session = hints.explorerSessions?.[purpose];
    if (!session || session.child_id !== state.child?.id) return;
    const nextHash = continuedExplorerHash(location.hash, purpose, session.id);
    if (nextHash !== location.hash)
      history.replaceState(history.state, "", nextHash);
    const [route, record] = location.hash.slice(1).split("/");
    hints.explorerRecord =
      record && route === (purpose === "interest" ? "interest" : "talents")
        ? session.id
        : null;
  },
  async selection(selected, previous) {
    if (
      previous &&
      (previous.completed || Object.keys(previous.answers || {}).length)
    ) {
      if (
        !window.confirm(
          "调整组合会开始一次新的探索。原来的回答和结果仍会保留，继续吗？",
        )
      )
        return previous;
    }
    if (hints.explorerSessions) hints.explorerSessions.interest = null;
    return { selected, answers: {}, completed: false, result: null, index: 0 };
  },
  async answer(purpose, questionCode, value) {
    const token = explorationToken(),
      session = hints.explorerSessions?.[purpose];
    if (!session || session.child_id !== state.child.id)
      throw new Error("请重新打开这次探索。");
    const saved = await API.request(`/assessments/${session.id}/answers`, {
      method: "PATCH",
      body: {
        revision: session.revision,
        answers: [
          {
            question_code: String(questionCode),
            option_codes: [String(value)],
          },
        ],
      },
    });
    if (!explorerCurrent(token)) return null;
    hints.explorerSessions[purpose] = saved;
    const normalized = explorerState(saved);
    delete normalized.index;
    return normalized;
  },
  async complete(purpose) {
    const token = explorationToken(),
      session = hints.explorerSessions?.[purpose];
    if (!session || session.child_id !== state.child.id)
      throw new Error("请重新打开这次探索。");
    const completed = await API.request(
      `/assessments/${session.id}/complete-exploration`,
      { method: "POST", body: { revision: session.revision } },
    );
    if (!explorerCurrent(token)) return null;
    hints.explorerSessions[purpose] = completed;
    void updateExperienceTask(state.child.id, token);
    return explorerState(completed);
  },
  async restart(purpose) {
    const selected =
      purpose === "interest" ? window.IslandExplorer.exportData().selected : [];
    return ensureExplorer(purpose, selected, true);
  },
  dialog(title, body, footer = "") {
    showDialog(
      title,
      body + (footer ? `<div class="actions">${footer}</div>` : ""),
    );
  },
  close: closeDialog,
  render,
  toast,
  async task(code) {
    const token = explorationToken();
    const activities = await API.all("/activities");
    if (!explorerCurrent(token)) return;
    const activity = activities.find(
      (a) => a.code === code || a.code === "prototype-" + code,
    );
    if (!activity) {
      toast("这个活动还在准备中，可以先试试今日陪伴里的活动。");
      return;
    }
    hints.activities = activities;
    closeDialog();
    await activityDetail(activity.id);
  },
};
window.IslandExplorer.bind(explorationBridge);
window.TalentExplorer.bind(explorationBridge);
window.PlayWorld.bind({
  island(id) {
    state.island = id;
    state.mood = "";
    to("home");
  },
  ...explorationBridge,
});
channel?.addEventListener("message", (e) => {
  if (e.data.logout || e.data.user !== state.user?.id) {
    forget();
    boot();
  }
});
window.addEventListener("pagehide", stopWork);
async function boot() {
  // NFC 标签把凭据放在 URL 里：先取下来，再从地址栏摘掉。留在地址栏的凭据
  // 会被浏览历史、截图、转发出去的链接一起带走。
  const nfcToken = readNfcToken(location.href);
  if (nfcToken) {
    hints.nfcToken = nfcToken;
    hints.nfcRobotRef = readParam(location.href, "robot_ref");
    hints.nfcPrompted = false;
    markNfcPending(true);
    history.replaceState(null, "", stripBindingParams(location.href));
  } else {
    hints.nfcNeedsRetap = storedValue("ca.nfc-pending") === "1";
  }
  try {
    state.runtime = await API.request("/runtime", { auth: false });
    $("#environment").textContent = "成长空间";
    $("#source-note").textContent = "";
    $("#environment").hidden = true;
    try {
      await API.refresh();
      state.user = await API.request("/me");
      await loadChildren();
    } catch (e) {
      if (![401, 403].includes(e.status)) throw e;
    }
    await render();
  } catch (e) {
    $("#environment").hidden = true;
    page(
      empty(
        "暂时无法连接成长空间",
        "请稍后重试，或点击下方按钮重新连接。",
        '<button class="button" onclick="location.reload()">重新连接</button>',
      ),
    );
  }
}
export const appReady = boot();
