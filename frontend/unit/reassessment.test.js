import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCEPTED_TEXT,
  DECLINED_EXPANDED_NOTE,
  DECLINED_TEXT,
  DONE_TEXT,
  KEEP_CURRENT_TEXT,
  SUGGEST_TEXT,
  SWITCH_TEXT,
  SYNC_PENDING_NOTE,
  completionCard,
  reassessmentSection,
} from "../reassessment.js";

/** 事件形状照 `backend/dingdong_ca/core/services/ca_display.py` 的 `_event_out`。 */
const event = (over = {}) => ({
  event_id: "reassess_mock_001",
  old_profile_id: "profile_mock_005",
  old_persona_id: "persona_science_01",
  trigger_type: "low_engagement",
  trigger_label: "近期互动偏少",
  recommended_at: "2026-09-22T01:00:00+08:00",
  accepted: null,
  new_assessment_id: null,
  new_profile_id: null,
  new_persona_id: null,
  persona_switched: false,
  ...over,
});

const data = (value, over = {}) => ({
  availability: "ready",
  data_origin: "synthetic",
  source: "dingdong",
  reason: null,
  event: value,
  ...over,
});

test("没有待处理建议时不显示任何 CTA", () => {
  for (const over of [
    { availability: "no_data", reason: "no_pending_event" },
    { availability: "unbound" },
    { availability: "no_consent" },
    { availability: "not_synced" },
    { availability: "error" },
  ]) {
    const view = reassessmentSection(data(event(), over));
    assert.equal(view.show, false, over.availability);
    assert.equal(view.phase, "hidden");
    assert.deepEqual(view.actions, []);
  }
  // 可用但没有事件：同样不显示，不报错、不留空框。
  assert.equal(reassessmentSection(data(null)).show, false);
  assert.equal(reassessmentSection(undefined).show, false);
});

test("第 1 步：未回写时展示建议与两个按钮", () => {
  const view = reassessmentSection(data(event()));
  assert.equal(view.show, true);
  assert.equal(view.phase, "suggest");
  assert.equal(view.title, SUGGEST_TEXT);
  assert.equal(view.eventId, "reassess_mock_001");
  assert.equal(view.recommendedAt, "2026-09-22T01:00:00+08:00");
  assert.equal(view.triggerLabel, "近期互动偏少");
  assert.deepEqual(view.actions, ["accept", "decline"]);
  assert.equal(view.synthetic, true);
});

test("第 2 步：选择先不测后只剩一行，可展开看当时的建议", () => {
  const collapsed = reassessmentSection(data(event({ accepted: false })));
  assert.equal(collapsed.phase, "declined");
  assert.equal(collapsed.title, DECLINED_TEXT);
  assert.deepEqual(collapsed.actions, []);
  assert.equal(collapsed.expandable, true);
  assert.equal(collapsed.expanded, false);
  assert.equal(collapsed.expandedNote, "");

  const expanded = reassessmentSection(data(event({ accepted: false })), {
    expanded: true,
  });
  assert.equal(expanded.expanded, true);
  assert.equal(expanded.expandedNote, DECLINED_EXPANDED_NOTE);
  // 展开也不给第二个「重新测评」按钮：同一事件换个答案会被后端按 422 拒绝。
  assert.deepEqual(expanded.actions, []);
});

test("第 3 步：已确认但未回写时出「开始复测」", () => {
  const view = reassessmentSection(data(event({ accepted: true })));
  assert.equal(view.phase, "accepted");
  assert.equal(view.title, ACCEPTED_TEXT);
  assert.deepEqual(view.actions, ["start"]);
  assert.equal(view.completion, null);
});

test("第 4 步：回写完成后给结果，刷新后只给中性说明", () => {
  const result = { switch_recommended: false, match_delta: 6 };
  const view = reassessmentSection(
    data(event({ accepted: true, new_assessment_id: "a-1" })),
    { completion: result },
  );
  assert.equal(view.phase, "done");
  assert.equal(view.title, DONE_TEXT);
  assert.equal(view.note, "");
  assert.equal(view.completion.title, KEEP_CURRENT_TEXT);

  // 刷新后拿不到 `complete` 响应（事件字段里没有分数），只说已回写。
  const reloaded = reassessmentSection(
    data(event({ accepted: true, new_assessment_id: "a-1" })),
  );
  assert.equal(reloaded.note, "换不换陪学伙伴由你决定，我们不会自动更换。");
  assert.equal(reloaded.completion, null);
});

test("switch_recommended 真分支：展示新角色名与匹配度差", () => {
  const card = completionCard({
    new_persona_id: "persona_philosophy_01",
    new_persona_name: "Socrates",
    match_score: 86,
    current_persona_match_score: 69,
    match_delta: 17,
    switch_recommended: true,
  });
  assert.equal(card.recommended, true);
  assert.equal(card.title, SWITCH_TEXT);
  assert.equal(card.newPersonaName, "Socrates");
  assert.equal(card.matchScore, 86);
  assert.equal(card.currentScore, 69);
  assert.equal(card.delta, 17);
});

test("switch_recommended 假分支：不展示新角色名", () => {
  const card = completionCard({
    new_persona_id: "persona_science_02",
    new_persona_name: "Ada",
    match_score: 79,
    current_persona_match_score: 73,
    match_delta: 6,
    switch_recommended: false,
  });
  assert.equal(card.recommended, false);
  assert.equal(card.title, KEEP_CURRENT_TEXT);
  assert.equal(card.newPersonaName, null);
  assert.equal(card.matchScore, null);
  assert.equal(card.delta, null);
  // 当前角色匹配度仍可展示，它不泄漏新角色身份。
  assert.equal(card.currentScore, 73);
});

test("任何路径都不自动切换：不照抄响应里的 auto_switch", () => {
  for (const value of [true, "true", 1, null, undefined]) {
    const card = completionCard({
      switch_recommended: true,
      auto_switch: value,
      new_persona_name: "Socrates",
    });
    assert.equal(card.autoSwitch, false);
  }
  assert.equal(completionCard(null), null);
});

test("出站没确认时给一句可重试说明", () => {
  const view = reassessmentSection(data(event()), {
    sync: { sync_pending: true, sync_error: "同步服务暂时不可用" },
  });
  assert.equal(view.syncNote, SYNC_PENDING_NOTE);
  assert.equal(reassessmentSection(data(event())).syncNote, "");
});

test("回写失败时错误落在复测区块自己这一块", () => {
  const view = reassessmentSection(data(event()), {
    error: "服务暂时不可用，请稍后再试。",
  });
  // 建议还在（本地没落库），错误与重试由 `app.js` 渲染在这一块内。
  assert.equal(view.show, true);
  assert.equal(view.phase, "suggest");
  assert.equal(view.error, "服务暂时不可用，请稍后再试。");
  assert.deepEqual(view.actions, ["accept", "decline"]);
  // 没有失败时不出现任何错误文案
  assert.equal(reassessmentSection(data(event())).error, "");
});
