/**
 * 面一（人设）与面三（健康度四态）的呈现判定。
 *
 * 后端已经给出 `availability`（沿用 `core/api/growth.py` 的 7 值词表）、
 * `data_origin`，以及映射好的中文 `type_label` / `trigger_label`；这里只决定
 * 「这一面该说什么、能不能显分数」，不产生 HTML（拼字符串在 `app.js`）。
 * 独立成模块是为了让四态分支被单测盯住。
 *
 * 依据 `.trellis/tasks/T-021/design.md` §1.1 / §1.3 / §3。
 */

/** 可取到数据的可用性取值：`stale` 也带着上次成功的数据，要显示并标注。 */
const USABLE = new Set(["ready", "stale"]);

/** 共用的可用性文案（设计 §3.1）：`title` 是状态行，`note` 是补完那句话的后半句。 */
export const AVAILABILITY_TEXT = {
  unbound: {
    title: "还没有绑定机器人",
    note: "绑定后这里会显示陪伴数据。",
    settings: true,
  },
  no_consent: {
    title: "尚未同意机器人数据同步用途",
    note: "",
    settings: true,
  },
  not_synced: {
    title: "机器人数据服务尚未接通",
    note: "稍后自动重试。",
  },
  error: {
    title: "暂时取不到机器人数据",
    note: "我们会在后台重试。",
  },
};

export const STALE_NOTICE = "最近一次同步没有成功，下面是上次成功同步的内容。";

/** 面一空态（设计 §3.2）：不显示空白卡片。 */
export const PERSONA_EMPTY =
  "还没有匹配到陪学伙伴。完成一次测评后，系统会推荐一位。";

/** 面三：`no_data` 与 `insufficient_data` 是同一句说法，都不显示分数。 */
export const HEALTH_COLLECTING = "还在收集互动数据，暂时不做判断。";

/** 面板底部固定说明（设计 §1.3）。 */
export const HEALTH_FOOTER = "这是互动情况的提示，不是对孩子的评价。";

/**
 * 健康度四态（设计 §1.3 表格 + 表 7.1 H 规则）。
 *
 * `score` 说的是这一态**允许**显示 `health_score`；`insufficient_data` 与
 * `reassess` 不显示，`watch` 只出轻提示、也不出分数（分数只随 `normal` 一起出现）。
 * 未知 `status` 一律落「不做判断」分支，不猜、不按 `normal` 展示。
 */
export const HEALTH_STATES = {
  insufficient_data: {
    label: HEALTH_COLLECTING,
    note: "",
    score: false,
  },
  normal: {
    label: "互动情况正常",
    note: "可以继续陪孩子体验。",
    score: true,
  },
  watch: {
    label: "继续体验并观察",
    note: "最近一段时间的互动比之前少了一些，过一段时间再看。",
    score: false,
  },
  reassess: {
    label: "建议重新测评",
    note: "最近一段时间互动偏少。",
    score: false,
  },
};

function envelope(data) {
  const availability = data?.availability || "error";
  return {
    availability,
    synthetic: data?.data_origin === "synthetic",
    usable: USABLE.has(availability),
    stale: availability === "stale",
  };
}

function blockedText(availability) {
  return AVAILABILITY_TEXT[availability] || AVAILABILITY_TEXT.error;
}

function emptyFace(base, title, note, settings = false) {
  return {
    ...base,
    showData: false,
    title,
    note,
    settings,
    persona: null,
    binding: null,
    matchScore: null,
  };
}

/** 面一的呈现判定。 */
export function personaSection(data) {
  const base = envelope(data);
  const persona = base.usable ? data.persona || null : null;
  const binding = base.usable ? data.binding || null : null;
  if (persona) {
    const match = binding?.match_score;
    return {
      ...base,
      showData: true,
      title: "",
      note: "",
      settings: false,
      persona,
      binding,
      matchScore: Number.isFinite(match) ? match : null,
    };
  }
  // 没有数据：先看是不是"对方确认没有"（空态），否则按可用性给说法。
  if (base.availability === "no_data" || base.usable) {
    return emptyFace(base, PERSONA_EMPTY, "");
  }
  const shared = blockedText(base.availability);
  return emptyFace(base, shared.title, shared.note, Boolean(shared.settings));
}

/** 面三的呈现判定。 */
export function healthSection(data) {
  const base = envelope(data);
  const health = base.usable ? data.health || null : null;
  if (!health) {
    if (base.availability === "no_data" || base.usable) {
      return {
        ...emptyFace(base, HEALTH_COLLECTING, ""),
        status: "insufficient_data",
        label: HEALTH_COLLECTING,
        showScore: false,
        score: null,
        observationDays: null,
        triggerLabel: null,
      };
    }
    const shared = blockedText(base.availability);
    return {
      ...emptyFace(base, shared.title, shared.note, Boolean(shared.settings)),
      status: null,
      label: shared.title,
      showScore: false,
      score: null,
      observationDays: null,
      triggerLabel: null,
    };
  }
  const known = Object.hasOwn(HEALTH_STATES, health.status);
  const state = known
    ? HEALTH_STATES[health.status]
    : HEALTH_STATES.insufficient_data;
  const score =
    state.score && Number.isFinite(health.health_score)
      ? health.health_score
      : null;
  return {
    ...base,
    showData: true,
    settings: false,
    status: known ? health.status : "insufficient_data",
    label: state.label,
    note: state.note,
    showScore: score !== null,
    score,
    observationDays: Number.isFinite(health.observation_days)
      ? health.observation_days
      : null,
    triggerLabel: health.trigger_label || null,
  };
}
