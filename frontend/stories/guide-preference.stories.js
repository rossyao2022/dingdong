import {
  GUIDE_MODES,
  greeting,
  guideText,
  renderGuidanceSummary,
} from "../guide-preference.js";
import { esc, panel } from "../ui-components.js";

export default {
  title: "家长端/网页引导",
  tags: ["autodocs"],
  decorators: [
    (story) => `<main class="page" style="max-width:680px">${story()}</main>`,
  ],
};

const activity = {
  alternative: "也可以用积木搭一座桥。",
  steps: [
    { instruction: "把纸折成一座桥。", guide_text: "你觉得哪种形状更稳？" },
    {
      instruction: "放上小石子，试试能承受多少。",
      guide_text: "你发现了什么变化？",
    },
    { instruction: "把发现分享给家人。", guide_text: "下次你想尝试什么？" },
  ],
};

export const FourModes = {
  name: "同一活动的四种引导",
  render: () =>
    Object.entries(GUIDE_MODES)
      .map(([mode, info]) =>
        panel(
          info.label,
          `<p>${esc(info.description)}</p><p>${esc(greeting(mode))}</p><div class="notice">${esc(guideText({ guide_mode: mode, mode: "guide", step_index: 0, activity }))}</div>`,
        ),
      )
      .join(""),
};

export const SelfExploration = {
  name: "自主探索显示替代方案",
  render: () =>
    panel(
      "自己看步骤",
      `<p>${esc(activity.steps[0].instruction)}</p><div class="notice">${esc(guideText({ guide_mode: "open", mode: "web", step_index: 0, activity }))}</div>`,
    ),
};

export const FourSituations = {
  name: "四情境偏好回看",
  render: () =>
    renderGuidanceSummary({
      answered_count: 4,
      counts: { cognitive: 2, imitative: 1, reverse: 0, open: 1 },
    }),
};

export const LongActivity = {
  name: "较长活动沿用实际步骤引导",
  render: () =>
    panel(
      "再试一次",
      `<p>${esc(guideText({ guide_mode: "open", mode: "guide", step_index: 3, activity: { ...activity, steps: [...activity.steps, { instruction: "再试一次。", guide_text: "这次你想改变什么？" }] } }))}</p>`,
    ),
};
