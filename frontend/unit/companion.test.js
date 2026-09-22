import test from "node:test";
import assert from "node:assert/strict";

import {
  HEALTH_COLLECTING,
  PERSONA_EMPTY,
  healthSection,
  personaSection,
} from "../companion.js";

const personaData = (over = {}) => ({
  availability: "ready",
  data_origin: "synthetic",
  source: "dingdong",
  reason: null,
  persona: {
    persona_id: "persona_art_01",
    persona_name: "Mia",
    persona_type: "art",
    type_label: "艺术",
    public_description: "艺术创作陪学伙伴",
    learning_style_tags: ["imitation", "open"],
    talent_weight_version: "pw_v1",
  },
  binding: {
    binding_id: "bind_mock_001",
    bind_time: "2026-09-01T02:05:00+08:00",
    match_score: 82,
    status: "active",
  },
  ...over,
});

const healthData = (health, over = {}) => ({
  availability: "ready",
  data_origin: "synthetic",
  source: "dingdong",
  reason: null,
  health,
  ...over,
});

const health = (over = {}) => ({
  health_id: "health_mock_001",
  persona_id: "persona_art_01",
  observation_days: 15,
  companion_delta: 35,
  health_score: 82,
  status: "normal",
  reassessment_recommended: false,
  trigger_reason: null,
  trigger_label: null,
  evaluated_at: "2026-09-15T16:10:00+08:00",
  ...over,
});

test("面一：ready 且有人设时展示人设与匹配度", () => {
  const view = personaSection(personaData());
  assert.equal(view.showData, true);
  assert.equal(view.persona.persona_name, "Mia");
  assert.equal(view.persona.type_label, "艺术");
  assert.equal(view.matchScore, 82);
  assert.equal(view.synthetic, true);
  assert.equal(view.settings, false);
  assert.equal(view.stale, false);
});

test("面一：no_data 用人设自己的空态，不显示空白卡片", () => {
  const view = personaSection(
    personaData({ availability: "no_data", persona: null, binding: null }),
  );
  assert.equal(view.showData, false);
  assert.equal(view.title, PERSONA_EMPTY);
  assert.equal(view.note, "");
  assert.equal(view.settings, false);
});

test("面一：unbound / no_consent 给去「账户与关联」的入口", () => {
  for (const availability of ["unbound", "no_consent"]) {
    const view = personaSection(
      personaData({ availability, persona: null, binding: null }),
    );
    assert.equal(view.showData, false);
    assert.equal(view.settings, true, availability);
    assert.notEqual(view.title, PERSONA_EMPTY);
  }
});

test("面一：not_synced 说的是服务没接通，不说「暂无数据」", () => {
  const view = personaSection(
    personaData({
      availability: "not_synced",
      persona: null,
      binding: null,
      reason: "upstream_not_configured",
    }),
  );
  assert.equal(view.showData, false);
  assert.equal(view.title, "机器人数据服务尚未接通");
  assert.equal(view.settings, false);
});

test("面一：stale 仍显示上次成功的人设并标注", () => {
  const view = personaSection(personaData({ availability: "stale" }));
  assert.equal(view.showData, true);
  assert.equal(view.stale, true);
  assert.equal(view.persona.persona_name, "Mia");
});

test("面一：ready 但人设为空时按空态处理，不显示卡片", () => {
  const view = personaSection(personaData({ persona: null, binding: null }));
  assert.equal(view.showData, false);
  assert.equal(view.title, PERSONA_EMPTY);
});

test("面一：缺 availability 不崩，按取不到数据处置", () => {
  const view = personaSection({});
  assert.equal(view.showData, false);
  assert.equal(view.availability, "error");
  assert.equal(view.settings, false);
});

test("面一：match_score 非数字时不显数值", () => {
  const view = personaSection(
    personaData({
      binding: { binding_id: "b", bind_time: null, match_score: null },
    }),
  );
  assert.equal(view.showData, true);
  assert.equal(view.matchScore, null);
});

test("面三：normal 显分数与观察天数", () => {
  const view = healthSection(healthData(health()));
  assert.equal(view.status, "normal");
  assert.equal(view.showScore, true);
  assert.equal(view.score, 82);
  assert.equal(view.observationDays, 15);
  assert.equal(view.label, "互动情况正常");
});

test("面三：watch 只出轻提示，不显 health_score 数值", () => {
  const view = healthSection(
    healthData(
      health({
        status: "watch",
        health_score: 55,
        companion_delta: 10,
        trigger_label: "近期互动偏少",
      }),
    ),
  );
  assert.equal(view.status, "watch");
  assert.equal(view.showScore, false);
  assert.equal(view.score, null);
  assert.equal(view.observationDays, 15);
  assert.equal(view.triggerLabel, "近期互动偏少");
  assert.equal(view.label, "继续体验并观察");
});

test("面三：insufficient_data 不做判断，即使后端给了 0 分也不显示", () => {
  const view = healthSection(
    healthData(
      health({
        status: "insufficient_data",
        health_score: 0,
        observation_days: 3,
        companion_delta: 0,
      }),
    ),
  );
  assert.equal(view.status, "insufficient_data");
  assert.equal(view.showScore, false);
  assert.equal(view.score, null);
  assert.equal(view.label, HEALTH_COLLECTING);
});

test("面三：reassess 只出建议文案，不显分数", () => {
  const view = healthSection(
    healthData(
      health({
        status: "reassess",
        health_score: 28,
        observation_days: 21,
        reassessment_recommended: true,
        trigger_label: "连续多期互动偏少",
      }),
    ),
  );
  assert.equal(view.status, "reassess");
  assert.equal(view.showScore, false);
  assert.equal(view.observationDays, 21);
  assert.equal(view.label, "建议重新测评");
  assert.equal(view.triggerLabel, "连续多期互动偏少");
});

test("面三：未知 status 落「不做判断」分支，不按 normal 展示", () => {
  const view = healthSection(
    healthData(health({ status: "switch_candidate", health_score: 91 })),
  );
  assert.equal(view.status, "insufficient_data");
  assert.equal(view.showScore, false);
  assert.equal(view.label, HEALTH_COLLECTING);
});

test("面三：no_data 与 insufficient_data 是同一句说法", () => {
  const view = healthSection(
    healthData(null, { availability: "no_data", reason: "no_health_data" }),
  );
  assert.equal(view.showData, false);
  assert.equal(view.label, HEALTH_COLLECTING);
  assert.equal(view.showScore, false);
});

test("面三：unbound / no_consent / not_synced / error 都不显示数值", () => {
  for (const availability of ["unbound", "no_consent", "not_synced", "error"]) {
    const view = healthSection(healthData(null, { availability }));
    assert.equal(view.showData, false, availability);
    assert.equal(view.showScore, false, availability);
    assert.equal(view.score, null, availability);
    assert.notEqual(view.label, "互动情况正常", availability);
  }
});

test("面三：stale 显示上次成功的健康度并标注", () => {
  const view = healthSection(healthData(health(), { availability: "stale" }));
  assert.equal(view.showData, true);
  assert.equal(view.stale, true);
  assert.equal(view.showScore, true);
});

test("面三：health_score 非数字时不显分数", () => {
  const view = healthSection(healthData(health({ health_score: null })));
  assert.equal(view.showData, true);
  assert.equal(view.showScore, false);
  assert.equal(view.score, null);
});

test("来源标记：非合成数据不挂合成徽标", () => {
  assert.equal(
    personaSection(personaData({ data_origin: "live" })).synthetic,
    false,
  );
  assert.equal(
    healthSection(healthData(health(), { data_origin: "live" })).synthetic,
    false,
  );
});
