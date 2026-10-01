import {
  CURVE_DAYS,
  DIMENSION_KEYS,
  renderDingDongReport,
  renderRobotEntry,
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
  render: () => renderDingDongReport(snapshot, { demonstration: true }),
};
export const NarrowPhone = {
  name: "390px 手机报告",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: () => renderDingDongReport(snapshot, { demonstration: true }),
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

export const UnboundRobot = {
  name: "未绑定：CA体验与可选展会入口",
  render: () =>
    renderRobotEntry([], "synthetic-child", { exhibition_enabled: true }),
};
export const BoundRobot = {
  name: "已绑定：聊天、报告和管理",
  render: () =>
    renderRobotEntry(
      [
        {
          child_id: "synthetic-child",
          status: "active",
          bind_state: "bound",
          chat_url: "https://www.dingdongrobo.top/dingdong/companion/main",
        },
      ],
      "synthetic-child",
      { exhibition_enabled: true },
    ),
};
export const Exhibition = {
  name: "独立展会演示报告",
  render: () =>
    `<section class="panel"><h2>展会体验</h2><p>演示报告不代表孩子的测评结果。多人共享这次演示，伙伴和内容可能随体验变化。</p></section>${renderDingDongReport(snapshot, { demonstration: true })}`,
};

export const PendingRobot = {
  name: "待接通：继续连接，不显示管理",
  render: () =>
    renderRobotEntry(
      [
        {
          child_id: "synthetic-child",
          status: "active",
          bind_state: "unbound",
        },
      ],
      "synthetic-child",
      { exhibition_enabled: true },
    ),
};
export const UnknownRobot = {
  name: "连接读取失败：不猜测未绑定",
  render: () =>
    renderRobotEntry(null, "synthetic-child", { exhibition_enabled: true }),
};
