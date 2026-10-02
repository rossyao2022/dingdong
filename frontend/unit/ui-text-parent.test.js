import test from "node:test";
import assert from "node:assert/strict";
import { renderDingDongReport, DIMENSION_KEYS } from "../dingdong-report.js";
import { renderExperienceRecords } from "../experience-flow.js";
import { pageHead, renderGuidePreference } from "../ui-components.js";
import { GUIDE_MODES } from "../guide-preference.js";

test("eight-dimensional values remain available in closed native details with visible simulation notice", () => {
  const dimensions = Object.fromEntries(
    DIMENSION_KEYS.map((key, i) => [key, i]),
  );
  const html = renderDingDongReport({
    availability: "ready",
    assessment: { baseline_scores: dimensions },
    growth: { current: { dimensions }, curve: [{ day: 180, dimensions }] },
  });
  assert.match(
    html,
    /<details class="panel dd-report-comparison"><summary>查看八维明细<\/summary>/,
  );
  assert.ok(!html.includes('dd-report-comparison" open'));
  assert.equal((html.match(/role="rowheader"/g) || []).length, 8);
  assert.equal((html.match(/role="cell"/g) || []).length, 24);
  assert.ok(html.indexOf("不代表孩子") < html.indexOf("<details"));
  assert.match(html, /role="cell">0<\/span>/);
});

test("empty personal records offer an immediate exploration action; history remains intact", () => {
  const empty = renderExperienceRecords([]);
  assert.match(empty, /还没有体验记录/);
  assert.match(empty, /href="#explore"[^>]*>开始一次探索/);
  const history = renderExperienceRecords([
    {
      type: "兴趣探索",
      status: "已完成",
      title: "<历史>",
      href: "#interest/saved",
      time: "2026-10-01T01:00:00Z",
    },
  ]);
  assert.match(history, /href="#interest\/saved"/);
  assert.match(history, /&lt;历史&gt;/);
  assert.ok(!history.includes("开始一次探索"));
});

test("guide preference exposes current mode and keeps all four settings in native details", () => {
  for (const guide_mode of Object.keys(GUIDE_MODES)) {
    const html = renderGuidePreference(guide_mode, GUIDE_MODES);
    assert.match(
      html,
      new RegExp(`当前方式：<b>${GUIDE_MODES[guide_mode].label}`),
    );
    assert.match(
      html,
      /<details class="guide-options"><summary>调整引导方式<\/summary>/,
    );
    assert.equal((html.match(/data-action="style"/g) || []).length, 4);
    assert.match(
      html,
      new RegExp(`data-value="${guide_mode}" aria-pressed="true"`),
    );
    assert.match(html, /data-action="companion-exploration"/);
  }
});

test("optional common description leaves no empty paragraph or repeated identity", () => {
  assert.ok(!pageHead("今日陪伴", "", "", "合成儿童").includes("合成儿童"));
  assert.ok(!pageHead("今日陪伴").includes("<p>"));
  assert.match(pageHead("记录", "<必要说明>"), /&lt;必要说明&gt;/);
});
