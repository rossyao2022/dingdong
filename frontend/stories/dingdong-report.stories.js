import {
  CURVE_DAYS,
  DIMENSION_KEYS,
  renderDingDongReport,
} from "../dingdong-report.js";

export default {
  title: "家长端/DingDong 陪伴成长报告",
  tags: ["autodocs"],
  decorators: [
    (story) =>
      `<main class="page" style="max-width:1000px;margin:auto">${story()}</main>`,
  ],
};

// Storybook-only snapshot; the production renderer never generates projection values.
const baseline = Object.fromEntries(
  DIMENSION_KEYS.map((key, index) => [key, 30 + index * 5]),
);
const snapshot = {
  availability: "ready",
  persona_name: "Nova",
  companion_value: 12,
  effective_turns: 12,
  assessment: { baseline_scores: baseline },
  growth: {
    weekly_turns: 7,
    current: { dimensions: baseline },
    curve: CURVE_DAYS.map((day, index) => ({
      day,
      companion_value: index * 7,
      engagement_index: 50,
      dimensions: Object.fromEntries(
        DIMENSION_KEYS.map((key, dimension) => [
          key,
          baseline[key] + index * (1 + (dimension % 3)),
        ]),
      ),
    })),
  },
  updated_at: "2026-09-30T06:00:00Z",
};

export const Ready = {
  name: "完整陪伴报告",
  render: () => renderDingDongReport(snapshot),
};
export const NarrowPhone = {
  name: "390px 手机报告",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: () => renderDingDongReport(snapshot),
};
export const Empty = {
  name: "暂无报告",
  render: () => renderDingDongReport(null),
};
export const Error = {
  name: "读取失败可重试",
  render: () => renderDingDongReport(null, { status: "error" }),
};
export const Loading = {
  name: "正在读取",
  render: () => renderDingDongReport(null, { status: "loading" }),
};
export const MissingData = {
  name: "缺少一个时间点与维度",
  render: () =>
    renderDingDongReport({
      ...snapshot,
      assessment: { baseline_scores: { ...baseline, musical: null } },
      growth: {
        ...snapshot.growth,
        curve: snapshot.growth.curve.filter((point) => point.day !== 30),
      },
    }),
};
