/** The journey uses persisted CA records only; it never infers a child's ability. */
import { esc } from "./ui-components.js?v=0.3.26";
const owned = (rows, child) =>
  (rows || []).filter((row) => row.child_id === child);
const timestamp = (row) =>
  Date.parse(
    row.completed_at ||
      row.finished_at ||
      row.started_at ||
      row.generated_at ||
      "",
  ) || 0;
const latest = (rows) =>
  [...rows].sort((a, b) => timestamp(b) - timestamp(a))[0];
const sessionHref = (row) =>
  `#${row.purpose === "interest" ? "interest" : row.purpose === "talent" ? "talents" : "assessment"}/${encodeURIComponent(row.id)}`;
const terminal = ["completed", "cancelled", "expired"];
export function nextExperience(sessions = [], records = [], child) {
  const activities = owned(records, child),
    assessments = owned(sessions, child);
  const active = latest(activities.filter((row) => row.status === "active"));
  if (active)
    return {
      kind: "activity",
      step: 1,
      title: active.activity.title,
      text: "上次的进度已经留好了，接着和孩子一起试试。",
      label: "继续这个活动",
      href: `#activity/${encodeURIComponent(active.id)}`,
    };
  const unfinished = assessments.find(
    (row) =>
      ["interest", "talent", "exploration"].includes(row.purpose) &&
      !terminal.includes(row.status) &&
      (!row.expires_at || Date.parse(row.expires_at) > Date.now()),
  );
  if (unfinished)
    return {
      kind: "resume",
      step: 0,
      title: unfinished.title,
      text: "先完成上次的小探索，再挑一个想尝试的活动。",
      label: "继续上次探索",
      href: sessionHref(unfinished),
      action: "journey-resume",
      sessionId: unfinished.id,
      purpose: unfinished.purpose,
    };
  if (
    !assessments.some(
      (row) => row.purpose === "interest" && row.status === "completed",
    )
  )
    return {
      kind: "interest",
      step: 0,
      title: "从孩子喜欢的事开始",
      text: "选三座心动的小岛，再回答九个小情境。",
      label: "开始兴趣探索",
      action: "journey-interest",
    };
  const completed = latest(
    activities.filter((row) => row.status === "completed"),
  );
  return {
    kind: "choose",
    step: completed ? 2 : 1,
    title: completed
      ? "一次小行动，已经留下来了"
      : "把这次发现，变成一个小行动",
    text: completed
      ? "可以回看这次记录，再选一个想一起尝试的活动。"
      : "选一个现在就能开始的活动，陪孩子试试看。",
    label: "选一个小活动",
    href: "#home",
    reviewHref: completed
      ? `#activity/${encodeURIComponent(completed.id)}`
      : null,
  };
}
export function renderExperienceTask(task) {
  const steps = ["探索一下", "一起行动", "留下记录"];
  const action = task.action
    ? `<button class="button" type="button" data-action="${esc(task.action)}"${task.sessionId ? ` data-id="${esc(task.sessionId)}" data-purpose="${esc(task.purpose)}"` : ""}>${esc(task.label)}</button>`
    : `<a class="button" href="${esc(task.href)}">${esc(task.label)}</a>`;
  return `<section class="panel experience-task" aria-label="体验主线"><span class="eyebrow">这次，一起做什么</span><ol class="experience-steps">${steps.map((label, index) => `<li${index === task.step ? ' aria-current="step" class="current"' : ""}><span aria-hidden="true">${index + 1}</span>${label}</li>`).join("")}</ol><h2>${esc(task.title)}</h2><p>${esc(task.text)}</p><div class="actions">${action}${task.reviewHref ? `<a class="button secondary" href="${esc(task.reviewHref)}">回看这次活动</a>` : ""}</div></section>`;
}
export function experienceRecords(
  sessions = [],
  reports = [],
  activities = [],
  child,
) {
  const assessments = owned(sessions, child);
  const linked = new Set(
    assessments.map((row) => row.report_id).filter(Boolean),
  );
  const result = assessments
    .filter((row) => row.status === "completed")
    .map((row) => ({
      id: `assessment:${row.id}`,
      title: row.title || "问卷体验",
      type:
        row.purpose === "interest"
          ? "兴趣探索"
          : row.purpose === "talent"
            ? "日常观察"
            : "问卷体验",
      status: "已完成",
      time: row.completed_at || null,
      href: sessionHref(row),
    }));
  for (const row of owned(activities, child).filter((row) =>
    ["completed", "skipped"].includes(row.status),
  ))
    result.push({
      id: `activity:${row.id}`,
      title: row.activity.title,
      type: "亲子活动",
      status: row.status === "completed" ? "已完成" : "已跳过",
      time: row.finished_at || row.started_at,
      href: `#activity/${encodeURIComponent(row.id)}`,
    });
  for (const row of reports.filter(
    (row) => !linked.has(row.id) && (!row.child_id || row.child_id === child),
  ))
    result.push({
      id: `report:${row.id}`,
      title: row.kind === "initial" ? "问卷体验记录" : "阶段观察记录",
      type: "历史记录",
      status: "已保存",
      time: row.generated_at,
      href: `#report/${encodeURIComponent(row.id)}`,
    });
  return result.sort(
    (a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0),
  );
}
export function renderExperienceRecords(rows) {
  if (!rows.length)
    return '<p class="note">完成一次探索或小活动后，就会在这里留下记录。</p>';
  return `<ol class="experience-records">${rows
    .map((row) => {
      const date = new Date(row.time);
      const valid = row.time && Number.isFinite(date.getTime());
      const label = valid
        ? new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(date)
        : "完成时间未记录";
      return `<li><div class="experience-record-meta"><span>${esc(row.type)} · ${esc(row.status)}</span>${valid ? `<time datetime="${esc(date.toISOString())}">${esc(label)}</time>` : `<span>${label}</span>`}</div><h3>${esc(row.title)}</h3><a class="button secondary" href="${esc(row.href)}" aria-label="回看${esc(row.title)}，${esc(label)}">回看这次记录</a></li>`;
    })
    .join("")}</ol>`;
}
