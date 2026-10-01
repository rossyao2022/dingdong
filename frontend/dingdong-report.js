/** Render only the supplied DingDong snapshot; never calculate projected scores here. */
import { esc } from "./ui-components.js?v=0.3.25";
import { boundAccount, safeChatUrl } from "./ca-link.js?v=0.3.25";

export function renderRobotEntry(accounts, childId, runtime = {}) {
  const bound = boundAccount(accounts, childId);
  const chat = safeChatUrl(bound?.chat_url);
  const exhibition = runtime?.exhibition_enabled
    ? '<a class="button secondary" href="#exhibition">展会体验</a>'
    : "";
  return `<section class="panel robot-entry"><h2>我的机器人</h2><p>${bound ? "机器人已绑定，来看看陪伴记录，或和 DingDong 聊聊。" : "还没有绑定机器人。可以继续探索和测评，也可以绑定机器人查看陪伴记录。"}</p><div class="actions">${bound ? `${chat ? `<a class="button" href="${esc(chat)}" target="_blank" rel="noopener noreferrer">和 DingDong 对话 ↗</a>` : ""}<a class="button secondary" href="#reports">查看机器人报告</a><a class="text-button" href="#settings">管理机器人</a>` : '<button class="button" type="button" data-action="bind-robot">绑定机器人</button>'}${exhibition}</div></section>`;
}

export const DIMENSION_KEYS = Object.freeze([
  "linguistic",
  "logical",
  "musical",
  "spatial",
  "bodily",
  "intrapersonal",
  "interpersonal",
  "naturalistic",
]);
export const DIMENSION_LABELS = Object.freeze({
  linguistic: "语言表达",
  logical: "逻辑思考",
  musical: "音乐感受",
  spatial: "空间想象",
  bodily: "身体运动",
  intrapersonal: "认识自己",
  interpersonal: "与人相处",
  naturalistic: "自然观察",
});
export const CURVE_DAYS = Object.freeze([0, 7, 15, 30, 60, 90, 180]);
export const WEEKLY_TURNS = Object.freeze([3, 7, 14, 21]);
const colors = [
  "#7b55ad",
  "#357ead",
  "#c56599",
  "#56928b",
  "#bf793b",
  "#8d6ca7",
  "#4c78ba",
  "#83943e",
];
const score = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100
    ? value
    : null;
const count = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const dimensionValues = (data) =>
  Object.fromEntries(DIMENSION_KEYS.map((key) => [key, score(data?.[key])]));
const display = (value) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(
        value,
      );

/** Explicit whitelist. Missing values remain null, including gaps in the supplied curve. */
export function normaliseDingDongReport(data) {
  if (
    !data ||
    typeof data !== "object" ||
    !["ready", "stale"].includes(data.availability)
  )
    return null;
  const baseline = dimensionValues(data.assessment?.baseline_scores);
  const current = dimensionValues(data.growth?.current?.dimensions);
  const rows = Array.isArray(data.growth?.curve) ? data.growth.curve : [];
  const curve = CURVE_DAYS.map((day) => {
    const matches = rows.filter((point) => point?.day === day);
    const row = matches.length === 1 ? matches[0] : null;
    return {
      day,
      companionValue: count(row?.companion_value),
      engagementIndex: score(row?.engagement_index),
      dimensions: dimensionValues(row?.dimensions),
    };
  });
  const weeklyTurns = data.weekly_turns ?? data.growth?.weekly_turns;
  const date =
    typeof data.updated_at === "string" ? new Date(data.updated_at) : null;
  return {
    personaName:
      typeof data.persona_name === "string"
        ? data.persona_name.slice(0, 80)
        : null,
    companionValue: count(data.companion_value),
    effectiveTurns: count(data.effective_turns),
    weeklyTurns: WEEKLY_TURNS.includes(weeklyTurns) ? weeklyTurns : null,
    updatedAt:
      date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
    curve,
    dimensions: DIMENSION_KEYS.map((key, index) => ({
      key,
      label: DIMENSION_LABELS[key],
      color: colors[index],
      baseline: baseline[key],
      current: current[key],
      future: curve[6].dimensions[key],
    })),
  };
}

function curveSvg(view) {
  if (
    !view.curve.some((point) =>
      DIMENSION_KEYS.some((key) => point.dimensions[key] !== null),
    )
  )
    return '<div class="dd-report-empty"><p>曲线还没有记录，稍后可以再来看。</p></div>';
  const x = (day) => 58 + (day / 180) * 546;
  const y = (value) => 285 - value * 2.45;
  const grid = [0, 25, 50, 75, 100]
    .map(
      (value) =>
        `<line x1="58" x2="604" y1="${y(value)}" y2="${y(value)}" class="dd-chart-grid"/><text x="45" y="${y(value) + 6}" text-anchor="end">${value}</text>`,
    )
    .join("");
  const labels = CURVE_DAYS.map(
    (day, index) =>
      `<text x="${x(day)}" y="${index % 2 ? 336 : 319}" text-anchor="middle">${day}</text>`,
  ).join("");
  const lines = view.dimensions
    .map((dimension) => {
      const segments = [];
      let points = [];
      for (const point of view.curve) {
        const value = point.dimensions[dimension.key];
        if (value === null) {
          if (points.length) segments.push(points);
          points = [];
        } else
          points.push({ x: x(point.day), y: y(value), value, day: point.day });
      }
      if (points.length) segments.push(points);
      return segments
        .map(
          (segment) =>
            `${segment.length > 1 ? `<polyline points="${segment.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${dimension.color}" stroke-width="3"/>` : ""}${segment.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${dimension.color}"><title>${esc(dimension.label)} · 第 ${point.day} 天：${esc(display(point.value))}</title></circle>`).join("")}`,
        )
        .join("");
    })
    .join("");
  return `<svg class="dd-report-chart" viewBox="0 0 660 350" role="img" aria-label="八个方面在0、7、15、30、60、90、180天的模拟趋势。缺少记录的时间点保持空白。"><title>八维模拟趋势参考</title>${grid}${lines}${labels}</svg><p class="dd-chart-caption">模拟时间点（天）</p><ul class="dd-chart-legend" aria-label="曲线对应的八个方面">${view.dimensions.map((d) => `<li><span style="--dd-color:${d.color}" aria-hidden="true"></span>${esc(d.label)}</li>`).join("")}</ul>`;
}

export function renderDingDongReport(data, options = {}) {
  const title = `<div class="dd-report-heading"><span class="eyebrow">DINGDONG · 陪伴与发现</span>${options.demonstration ? '<span class="tag muted">演示内容</span>' : ""}<h1 aria-label="DingDong 陪伴成长报告">DingDong <span class="dd-report-title-phrase">陪伴成长报告</span></h1></div>`;
  const view = normaliseDingDongReport(data);
  if (!view) {
    const text =
      options.status === "loading"
        ? "正在读取陪伴成长记录…"
        : options.status === "error"
          ? "暂时无法读取陪伴成长记录，请稍后再试。"
          : "还没有陪伴成长记录。与伙伴一起体验后，再来看看吧。";
    return `<section class="dd-report" aria-label="DingDong 陪伴成长报告">${title}<div class="panel dd-report-empty" ${options.status === "loading" ? 'role="status"' : ""}><p>${text}</p>${options.status !== "loading" ? '<button type="button" class="button secondary" data-action="dingdong-report-refresh">读取陪伴记录</button>' : ""}</div></section>`;
  }
  const weeklyTurns =
    view.weeklyTurns ??
    (WEEKLY_TURNS.includes(options.weeklyTurns) ? options.weeklyTurns : null);
  const updated = view.updatedAt
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(view.updatedAt))
    : null;
  const summary = `<section class="panel dd-report-summary"><div><span class="dd-report-label">陪学伙伴</span><h2>${view.personaName ? esc(view.personaName) : "还没有选择伙伴"}</h2></div><div><span class="dd-report-label">陪伴值</span><strong>${esc(display(view.companionValue))}</strong></div><div><span class="dd-report-label">有效互动</span><strong>${esc(display(view.effectiveTurns))}<small> 次</small></strong></div></section>`;
  const frequency = `<section class="panel dd-report-frequency"><h2>预计每周聊几次？</h2><p>选择不同频率，体验模拟趋势，不会修改机器人设置。</p><div class="dd-report-frequency-actions" role="group" aria-label="预计每周对话次数">${WEEKLY_TURNS.map((value) => `<button type="button" class="button secondary" data-action="dingdong-weekly-turns" data-value="${value}" aria-pressed="${weeklyTurns === value}">${value} 次</button>`).join("")}</div></section>`;
  const chart = `<section class="panel dd-report-trend"><h2>好奇心，一点一点积累</h2><p class="dd-report-simulation">模拟趋势参考：根据陪伴情况估算，未来可能与这里不同，不代表孩子的能力或正式测评结果。</p>${curveSvg(view)}</section>`;
  const comparison = `<section class="panel dd-report-comparison"><h2>从起点，看看未来的可能</h2><p>这里只作趋势参考，缺少记录的地方保持空白。</p><div class="dd-report-table" role="table" aria-label="八个方面的起点、目前和180天参考"><div class="dd-report-row dd-report-table-head" role="row"><span role="columnheader">观察方向</span><span role="columnheader">起点</span><span role="columnheader">目前</span><span role="columnheader">180 天参考</span></div>${view.dimensions.map((d) => `<div class="dd-report-row" role="row"><span role="rowheader">${esc(d.label)}</span><span role="cell">${esc(display(d.baseline))}</span><span role="cell">${esc(display(d.current))}</span><span role="cell">${esc(display(d.future))}</span></div>`).join("")}</div></section>`;
  const footer = `<div class="dd-report-footer">${data.availability === "stale" ? '<p class="notice">暂时没能更新，先显示已保存的记录。</p>' : ""}${updated ? `<p>最近更新：${esc(updated)}</p>` : ""}<button type="button" class="button secondary" data-action="dingdong-report-refresh">刷新陪伴变化</button></div>`;
  return `<section class="dd-report" aria-label="DingDong 陪伴成长报告">${title}${summary}${frequency}${chart}${comparison}${footer}</section>`;
}
