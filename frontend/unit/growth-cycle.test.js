import test from "node:test";
import assert from "node:assert/strict";

import {
  DIMENSION_KEYS,
  DIMENSION_MISSING,
  DIMENSION_UNKNOWN,
  NO_PERIOD_DATA,
  PERIOD_INCOMPLETE,
  PROXY_NOTE,
  growthCycleSection,
} from "../growth-cycle.js";

const DIMS = {
  linguistic: 64,
  logical: 48,
  musical: 66,
  spatial: 62,
  bodily: 44,
  intrapersonal: 57,
  interpersonal: 51,
  naturalistic: 42,
};

/** 中文名由后端下发（与 `stage_label` 同一做法），前端不硬编码。 */
const LABELS = {
  linguistic: "语言成长代理",
  logical: "逻辑成长代理",
  musical: "音乐成长代理",
  spatial: "空间成长代理",
  bodily: "实践成长代理",
  intrapersonal: "自我认知成长代理",
  interpersonal: "人际成长代理",
  naturalistic: "自然成长代理",
};

const growthData = (over = {}) => ({
  availability: "ready",
  data_origin: "synthetic",
  source: "dingdong",
  reason: null,
  period: { days: 15, start: "2026-09-01", end: "2026-09-15" },
  persona: {
    persona_id: "persona_art_01",
    persona_name: "Mia",
    persona_type: "art",
    match_score: 82,
  },
  companion: { start: 12, end: 47, delta: 35 },
  engagement: { index: 58.31, stage: "developing", stage_progress: 55, stage_label: "成长" },
  growth_dimensions: DIMS,
  growth_dimension_labels: LABELS,
  algorithm_version: "growth_v1",
  generated_at: "2026-09-16T00:10:00+08:00",
  ...over,
});

test("面二：ready 时给出周期、陪伴值增长、阶段与八维", () => {
  const view = growthCycleSection(growthData());
  assert.equal(view.showData, true);
  assert.equal(view.synthetic, true);
  assert.equal(view.stale, false);
  assert.equal(view.settings, false);
  assert.deepEqual(view.period, { days: 15, start: "2026-09-01", end: "2026-09-15" });
  assert.equal(view.personaName, "Mia");
  assert.equal(view.companionDelta, 35);
  assert.equal(view.companionStart, 12);
  assert.equal(view.companionEnd, 47);
  assert.equal(view.stageLabel, "成长");
  assert.equal(view.stageProgress, 55);
});

test("面二：八维按固定顺序给出，维度名取后端下发的中文", () => {
  const view = growthCycleSection(growthData());
  assert.deepEqual(view.dimensions.map((d) => d.key), [...DIMENSION_KEYS]);
  assert.equal(view.dimensions[0].label, "语言成长代理");
  assert.equal(view.dimensions[0].value, 64);
  assert.equal(view.dimensions[7].label, "自然成长代理");
  assert.equal(view.dimensions[7].value, 42);
});

test("面二：后端没给该维中文名时给兜底说法，不把英文 code 当维度名", () => {
  const view = growthCycleSection(
    growthData({ growth_dimension_labels: { ...LABELS, logical: null } }),
  );
  assert.equal(view.dimensions.find((d) => d.key === "logical").label, DIMENSION_UNKNOWN);
  assert.notEqual(view.dimensions.find((d) => d.key === "logical").label, "logical");
  assert.equal(view.dimensions[0].label, "语言成长代理");
});

test("面二：整块没给中文名时不崩，八维仍按固定顺序给出", () => {
  const view = growthCycleSection(growthData({ growth_dimension_labels: null }));
  assert.equal(view.dimensions.length, 8);
  assert.deepEqual(view.dimensions.map((d) => d.label), Array(8).fill(DIMENSION_UNKNOWN));
  assert.equal(view.dimensions[0].value, 64);
});

test("面二：缺失维度给 null 并标「本周期无该维度数据」，不补 0、不插值", () => {
  const view = growthCycleSection(
    growthData({ growth_dimensions: { ...DIMS, logical: null, spatial: null } }),
  );
  const logical = view.dimensions.find((d) => d.key === "logical");
  const spatial = view.dimensions.find((d) => d.key === "spatial");
  assert.equal(logical.value, null);
  assert.equal(spatial.value, null);
  assert.equal(DIMENSION_MISSING, "本周期无该维度数据");
  // 其余维度原样保留，没有被插值或被 0 顶替。
  assert.deepEqual(
    view.dimensions.filter((d) => d.value !== null).map((d) => d.value),
    [64, 66, 44, 57, 51, 42],
  );
});

test("面二：维度值为 0 是数据，不当缺失处理", () => {
  const view = growthCycleSection(
    growthData({ growth_dimensions: { ...DIMS, bodily: 0 } }),
  );
  assert.equal(view.dimensions.find((d) => d.key === "bodily").value, 0);
});

test("面二：缺八维整块时八个维度全部标缺失，不崩", () => {
  const view = growthCycleSection(growthData({ growth_dimensions: null }));
  assert.equal(view.showData, true);
  assert.equal(view.dimensions.length, 8);
  assert.deepEqual(view.dimensions.map((d) => d.value), Array(8).fill(null));
});

test("面二：no_data + period_incomplete 说周期还没走完，不说「没有报告」", () => {
  const view = growthCycleSection(
    growthData({
      availability: "no_data",
      reason: "period_incomplete",
      period: null,
      persona: null,
      companion: null,
      engagement: null,
      growth_dimensions: null,
    }),
  );
  assert.equal(view.showData, false);
  assert.equal(view.title, PERIOD_INCOMPLETE);
  assert.equal(view.settings, false);
  assert.notEqual(view.title, NO_PERIOD_DATA);
});

test("面二：no_data + no_period_data 说这个周期还没有报告", () => {
  const view = growthCycleSection(
    growthData({ availability: "no_data", reason: "no_period_data", period: null }),
  );
  assert.equal(view.showData, false);
  assert.equal(view.title, NO_PERIOD_DATA);
});

test("面二：unbound / no_consent 给去「账户与关联」的入口，其余不给", () => {
  for (const availability of ["unbound", "no_consent"]) {
    const view = growthCycleSection(growthData({ availability, period: null }));
    assert.equal(view.showData, false, availability);
    assert.equal(view.settings, true, availability);
  }
  for (const availability of ["not_synced", "error"]) {
    const view = growthCycleSection(growthData({ availability, period: null }));
    assert.equal(view.showData, false, availability);
    assert.equal(view.settings, false, availability);
    assert.equal(view.dimensions, null, availability);
  }
});

test("面二：not_synced 说的是服务没接通，不说「暂无数据」", () => {
  const view = growthCycleSection(
    growthData({ availability: "not_synced", period: null, reason: "upstream_not_configured" }),
  );
  assert.equal(view.title, "机器人数据服务尚未接通");
  assert.equal(view.title.includes("暂无"), false);
});

test("面二：stale 仍显示上次成功的周期报告并标注", () => {
  const view = growthCycleSection(growthData({ availability: "stale", reason: "50001" }));
  assert.equal(view.showData, true);
  assert.equal(view.stale, true);
  assert.equal(view.companionDelta, 35);
  assert.equal(view.dimensions[0].value, 64);
});

test("面二：availability 非 ready/stale 时不带出任何数值", () => {
  for (const availability of ["unbound", "no_consent", "not_synced", "no_data", "error"]) {
    const view = growthCycleSection(growthData({ availability }));
    assert.equal(view.showData, false, availability);
    assert.equal(view.dimensions, null, availability);
    assert.equal(view.companionDelta, null, availability);
    assert.equal(view.stageProgress, null, availability);
    assert.equal(view.period, null, availability);
  }
});

test("面二：ready 但没有 period 时按「这个周期还没有报告」处理", () => {
  const view = growthCycleSection(growthData({ period: null }));
  assert.equal(view.showData, false);
  assert.equal(view.title, NO_PERIOD_DATA);
});

test("面二：未知阶段码不把英文 code 当阶段名显示", () => {
  const view = growthCycleSection(
    growthData({
      engagement: { index: 40, stage: "unknown_stage", stage_progress: 10, stage_label: null },
    }),
  );
  assert.equal(view.showData, true);
  assert.equal(view.stageLabel, null);
  assert.equal(view.stageProgress, 10);
  assert.equal(view.stageNote, "机器人服务下发的阶段名暂不可识别。");
});

test("面二：companion / engagement 非数字时不显数值", () => {
  const view = growthCycleSection(
    growthData({
      companion: { start: null, end: null, delta: null },
      engagement: { index: null, stage: "deep", stage_progress: null, stage_label: "深入" },
    }),
  );
  assert.equal(view.showData, true);
  assert.equal(view.companionDelta, null);
  assert.equal(view.companionStart, null);
  assert.equal(view.companionEnd, null);
  assert.equal(view.stageLabel, "深入");
  assert.equal(view.stageProgress, null);
});

test("面二：缺 availability 不崩，按取不到数据处置", () => {
  const view = growthCycleSection({});
  assert.equal(view.showData, false);
  assert.equal(view.availability, "error");
  assert.equal(view.dimensions, null);
});

test("来源标记：非合成数据不挂合成徽标", () => {
  assert.equal(growthCycleSection(growthData({ data_origin: "live" })).synthetic, false);
});

test("面二：八维标注写明是成长代理，不是能力评分", () => {
  assert.equal(PROXY_NOTE, "成长代理由机器人服务算法产出，不是能力评分。");
});
