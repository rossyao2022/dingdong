/**
 * 面二（15 / 30 天周期成长报告）的呈现判定。
 *
 * 与 `companion.js` 同一套做法：后端已经给出 `availability`（沿用 `growth.py` 的
 * 7 值词表）、`data_origin`、映射好的中文 `engagement.stage_label` 与固定顺序的
 * `growth_dimensions`；这里只决定「这一面该说什么、哪些数值能显示」，不产生 HTML。
 * 可用性文案与陈旧提示直接复用 `companion.js` 的表，避免同一件事出现两种说法。
 *
 * 依据 `.trellis/tasks/T-021/design.md` §1.2 / §3.1 / §3.2。
 */

import { AVAILABILITY_TEXT, STALE_NOTICE } from "./companion.js";

export { STALE_NOTICE };

/** 可取到数据的可用性取值：`stale` 也带着上次成功的数据，要显示并标注。 */
const USABLE = new Set(["ready", "stale"]);

/**
 * 八维成长代理的固定顺序（键）。顺序与后端 `GROWTH_DIMENSIONS` 一致；
 * 中文名一律由后端 `growth_dimension_labels` 下发（与 `stage_label` 同一做法），
 * 前端不维护第二套映射。
 */
export const DIMENSION_KEYS = [
  "linguistic",
  "logical",
  "musical",
  "spatial",
  "bodily",
  "intrapersonal",
  "interpersonal",
  "naturalistic",
];

/** 固定两个 Tab；任意区间由既有「成长观察」承担，不是同一份数据。 */
export const PERIODS = [
  ["15d", "15 天"],
  ["30d", "30 天"],
];

/** 某一维本周期为空时的说法（设计 §1.2：不补 0、不插值）。 */
export const DIMENSION_MISSING = "本周期无该维度数据";

/** 后端没给该维中文名时的兜底；不把英文 code 当维度名显示。 */
export const DIMENSION_UNKNOWN = "未识别维度";

/** 八维的性质标注（设计 §1.2），与「网页活动是家庭自报记录」同一纪律。 */
export const PROXY_NOTE = "成长代理由机器人服务算法产出，不是能力评分。";

/** 空态两句分开写（设计 §3.2）：周期没走完 ≠ 对方没有这个周期。 */
export const PERIOD_INCOMPLETE = "成长周期还没走完，满 15 天后会生成第一份周期报告。";
export const NO_PERIOD_DATA = "这个周期还没有报告。";

/** 对方下发的阶段码不在我方映射表里时的说法；不把英文 code 当阶段名显示。 */
export const STAGE_UNKNOWN = "机器人服务下发的阶段名暂不可识别。";

const finite = (v) => (Number.isFinite(v) ? v : null);

/** 八维按固定顺序转成行；缺失维度给 null，不补 0、不插值。中文名取后端下发。 */
export function dimensionRows(dimensions, labels) {
  return DIMENSION_KEYS.map((key) => ({
    key,
    label: labels?.[key] || DIMENSION_UNKNOWN,
    value: finite(dimensions?.[key]),
  }));
}

export function growthCycleSection(data) {
  const availability = data?.availability || "error";
  const base = {
    availability,
    synthetic: data?.data_origin === "synthetic",
    usable: USABLE.has(availability),
    stale: availability === "stale",
  };
  const empty = (title, note, settings = false) => ({
    ...base,
    showData: false,
    title,
    note,
    settings,
    period: null,
    personaName: null,
    companionDelta: null,
    companionStart: null,
    companionEnd: null,
    stageLabel: null,
    stageProgress: null,
    stageNote: null,
    dimensions: null,
    algorithmVersion: null,
    generatedAt: null,
  });

  const period = base.usable ? data.period || null : null;
  if (!period) {
    // 没有数据：先看是不是"对方确认没有这个周期"（空态），否则按可用性给说法。
    if (base.availability === "no_data" || base.usable) {
      return empty(
        data?.reason === "period_incomplete" ? PERIOD_INCOMPLETE : NO_PERIOD_DATA,
        "",
      );
    }
    const shared = AVAILABILITY_TEXT[base.availability] || AVAILABILITY_TEXT.error;
    return empty(shared.title, shared.note, Boolean(shared.settings));
  }

  const companion = data.companion || {};
  const engagement = data.engagement || {};
  const delta = finite(companion.delta);
  const start = finite(companion.start);
  const end = finite(companion.end);
  return {
    ...base,
    showData: true,
    title: "",
    note: "",
    settings: false,
    period,
    personaName: data.persona?.persona_name || null,
    companionDelta: delta,
    companionStart: start,
    companionEnd: end,
    stageLabel: engagement.stage_label || null,
    stageProgress: finite(engagement.stage_progress),
    stageNote: engagement.stage_label ? null : STAGE_UNKNOWN,
    dimensions: dimensionRows(data.growth_dimensions, data.growth_dimension_labels),
    algorithmVersion: data.algorithm_version || null,
    generatedAt: data.generated_at || null,
  };
}
