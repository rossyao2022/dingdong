/** Original webpage guidance, independent of CA styles and robot configuration. */
import { esc } from "./ui-components.js?v=0.3.26";

export const GUIDE_MODES = Object.freeze({
  cognitive: Object.freeze({
    label: "认知型引导",
    description: "多问一个为什么",
    greeting: "先猜一猜，再一起找答案。",
  }),
  imitative: Object.freeze({
    label: "模仿型引导",
    description: "看一看，再试试看",
    greeting: "我先给一个例子，你可以做得不一样。",
  }),
  reverse: Object.freeze({
    label: "逆思型引导",
    description: "给熟悉的事换个方向",
    greeting: "如果反过来做，会有什么新发现？",
  }),
  open: Object.freeze({
    label: "开放型引导",
    description: "让想象自由发生",
    greeting: "没有唯一答案，试试你的想法。",
  }),
});

const fallback = "和孩子一起观察，按自己的节奏试一试。";
const text = (value) =>
  typeof value === "string" && value.trim() ? value : "";
const validMode = (mode) =>
  Object.hasOwn(GUIDE_MODES, mode) ? mode : "cognitive";

export function greeting(mode) {
  return GUIDE_MODES[validMode(mode)].greeting;
}

/** Returns plain text. The caller must escape it before inserting into HTML. */
export function guideText(record) {
  const activity = record?.activity;
  if (record?.mode === "web") return text(activity?.alternative) || fallback;
  const index = record?.step_index;
  const steps = activity?.steps;
  if (
    !Array.isArray(steps) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= steps.length
  )
    return fallback;
  const step = steps[index];
  const currentText =
    text(step?.guide_text) || text(step?.instruction) || fallback;
  if (index > 2) return currentText;
  const mode = validMode(record?.guide_mode);
  const speech = {
    imitative: [
      `先看一个例子：${text(steps[0]?.instruction) || currentText} 你也可以按自己的节奏来。`,
      "沿用刚才的做法试一试。哪里需要我再说一次？",
      "照着做完以后，你最想改变哪个地方？",
    ],
    reverse: [
      "如果把熟悉的做法反过来，会发生什么？先试第一步。",
      "有没有另一种做法？你可以选择比较，也可以先看眼前的结果。",
      "刚才哪个发现和你最初的猜测不一样？",
    ],
    open: [
      "你想怎么开始？可以照着这一步，也可以用替代方案。",
      "没有唯一的做法，看看你的想法会带来什么。",
      "给今天的探索起个名字吧。你愿意的话，也可以分享给家人。",
    ],
  };
  return speech[mode]?.[index] || currentText;
}

/** Only the canonical four-question summary is meaningful as a mode distribution. */
export function renderGuidanceSummary(summary) {
  if (summary?.answered_count !== 4) return "";
  const counts = Object.keys(GUIDE_MODES).map((mode) => summary.counts?.[mode]);
  if (
    counts.some(
      (count) => !Number.isInteger(count) || count < 0 || count > 4,
    ) ||
    counts.reduce((a, b) => a + b, 0) !== 4
  )
    return "";
  return `<section class="notice guidance-summary"><h2>这次你们的引导偏好</h2><p>这是四个小情境中的选择，可以试试不同的陪伴方式。</p><ul>${Object.entries(
    GUIDE_MODES,
  )
    .map(
      ([mode, info]) =>
        `<li><b>${esc(info.label)}</b>：${summary.counts[mode]} 次 · ${esc(info.description)}</li>`,
    )
    .join("")}</ul></section>`;
}
