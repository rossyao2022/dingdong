/**
 * 面四（复测 CTA 与回写）的呈现判定。
 *
 * 后端已经给出事件字段与 `data_origin`；这里只决定「这一面该说什么、该出哪些
 * 按钮」，不产生 HTML（拼字符串在 `app.js`）。独立成模块是为了让四步状态机与
 * `switch_recommended` 两个分支被单测盯住。
 *
 * 依据 `.trellis/tasks/T-021/design.md` §1.4 / §3.2。
 */

/** 可取到数据的可用性取值：`stale` 也带着上次成功的数据。 */
const USABLE = new Set(["ready", "stale"]);

export const SUGGEST_TEXT = "最近一段时间互动偏少，要不要重新测一次？";
export const DECLINED_TEXT = "已选择暂不重新测评";
export const ACCEPTED_TEXT = "已确认重新测评";
export const ACCEPTED_NOTE = "开始一次新的测评，完成后我们会把结果回写。";
export const DECLINED_EXPANDED_NOTE =
  "这条建议已经处理过，不会重复提示。要再测一次，可以从「初始测评」重新开始。";
export const DONE_TEXT = "这次复测的结果已经回写。";
export const DONE_NOTE = "换不换陪学伙伴由你决定，我们不会自动更换。";
export const SWITCH_TEXT = "新角色推荐";
export const SWITCH_NOTE =
  "换人设需要你确认，我们不会自动更换；确认入口尚未开放，现在只展示建议。";
export const KEEP_CURRENT_TEXT = "保留当前角色";
export const KEEP_CURRENT_NOTE =
  "新角色与当前角色的匹配度差别不大，继续用现在的陪学伙伴。";
export const SYNC_PENDING_NOTE =
  "机器人服务还没有确认这次选择，我们会在后台重试。";
/** 回写没成功时的落点：就落在复测区块自身，不借道页面级的错误位置。 */
export const WRITE_FAILED_TEXT = "这次没写成功，请重试。";

const HIDDEN = {
  show: false,
  phase: "hidden",
  eventId: null,
  recommendedAt: null,
  triggerLabel: null,
  title: "",
  note: "",
  error: "",
  actions: [],
  expandable: false,
  expanded: false,
  expandedNote: "",
  syncNote: "",
  completion: null,
};

function envelope(data) {
  const availability = data?.availability || "error";
  return {
    availability,
    synthetic: data?.data_origin === "synthetic",
    usable: USABLE.has(availability),
  };
}

/**
 * 面四的四步状态机（设计 §1.4）：
 *
 * 1. `accepted === null` → 展示建议 + 「重新测评 / 先不测」；
 * 2. `accepted === false` → 一行说明，不再重复打扰，可展开看当时的建议；
 * 3. `accepted === true` 且未回写 → 「开始复测」承接既有测评流程；
 * 4. 已回写 → 结果卡（`switch_recommended` 真/假两分支）。
 *
 * 没有待处理建议（含 `no_data`：契约里 404 就是「没有建议」）时整块不显示，
 * 不报错、不留空框。不可用状态由健康度那一段给说法，这里不再重复。
 */
export function reassessmentSection(data, options = {}) {
  const base = envelope(data);
  const event = base.usable ? data?.event || null : null;
  if (!event) return { ...base, ...HIDDEN };
  const shared = {
    ...base,
    ...HIDDEN,
    show: true,
    eventId: event.event_id,
    recommendedAt: event.recommended_at || null,
    triggerLabel: event.trigger_label || null,
    error: options.error || "",
    syncNote: options.sync?.sync_pending ? SYNC_PENDING_NOTE : "",
  };
  if (event.accepted === null || event.accepted === undefined)
    return {
      ...shared,
      phase: "suggest",
      title: SUGGEST_TEXT,
      actions: ["accept", "decline"],
    };
  if (event.accepted === false)
    return {
      ...shared,
      phase: "declined",
      title: DECLINED_TEXT,
      expandable: true,
      expanded: Boolean(options.expanded),
      expandedNote: options.expanded ? DECLINED_EXPANDED_NOTE : "",
    };
  if (!event.new_assessment_id)
    return {
      ...shared,
      phase: "accepted",
      title: ACCEPTED_TEXT,
      note: ACCEPTED_NOTE,
      actions: ["start"],
    };
  const completion = options.completion
    ? completionCard(options.completion)
    : null;
  return {
    ...shared,
    phase: "done",
    title: DONE_TEXT,
    note: completion ? "" : DONE_NOTE,
    completion,
  };
}

/**
 * `complete` 响应里的结果与新角色建议（设计 §1.4 第 4 步）。
 *
 * `switch_recommended` 为假时不展示新角色名——避免无谓的换人设冲动；
 * `autoSwitch` 恒为 `false`：对方响应里若出现别的值也不照抄，不自动切换
 * 是产品不变量（`需求/后台设计已确认约束.md`）。
 */
export function completionCard(result) {
  if (!result) return null;
  const recommended = result.switch_recommended === true;
  return {
    recommended,
    autoSwitch: false,
    title: recommended ? SWITCH_TEXT : KEEP_CURRENT_TEXT,
    newPersonaName: recommended ? result.new_persona_name || null : null,
    matchScore:
      recommended && Number.isFinite(result.match_score)
        ? result.match_score
        : null,
    currentScore: Number.isFinite(result.current_persona_match_score)
      ? result.current_persona_match_score
      : null,
    delta:
      recommended && Number.isFinite(result.match_delta)
        ? result.match_delta
        : null,
    note: recommended ? SWITCH_NOTE : KEEP_CURRENT_NOTE,
  };
}
