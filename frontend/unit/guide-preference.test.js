import test from "node:test";
import assert from "node:assert/strict";
import {
  GUIDE_MODES,
  greeting,
  guideText,
  renderGuidanceSummary,
} from "../guide-preference.js";

const record = (guide_mode, step_index = 0, mode = "guide") => ({
  guide_mode,
  mode,
  step_index,
  style: "creative",
  activity: {
    alternative: "也可以用积木搭一座桥。",
    steps: [
      { instruction: "把纸折成桥。", guide_text: "你觉得怎样更稳？" },
      { instruction: "放上小石子。", guide_text: "试着比较两种做法。" },
      { instruction: "分享发现。", guide_text: "刚才有什么新发现？" },
      { instruction: "再试一次。", guide_text: "这次你想改变什么？" },
    ],
  },
});

test("original four guide modes keep their names and greetings independently of CA style", () => {
  assert.deepEqual(Object.keys(GUIDE_MODES), [
    "cognitive",
    "imitative",
    "reverse",
    "open",
  ]);
  assert.deepEqual(
    Object.values(GUIDE_MODES).map((v) => v.label),
    ["认知型引导", "模仿型引导", "逆思型引导", "开放型引导"],
  );
  assert.equal(greeting("open"), "没有唯一答案，试试你的想法。");
  assert.equal(greeting("unknown"), greeting("cognitive"));
  assert.equal(
    guideText({ ...record(""), style: "reverse" }),
    "你觉得怎样更稳？",
  );
});

test("each original mode produces its actual first and final step speech", () => {
  assert.equal(guideText(record("cognitive")), "你觉得怎样更稳？");
  assert.equal(
    guideText(record("imitative")),
    "先看一个例子：把纸折成桥。 你也可以按自己的节奏来。",
  );
  assert.equal(
    guideText(record("reverse")),
    "如果把熟悉的做法反过来，会发生什么？先试第一步。",
  );
  assert.equal(
    guideText(record("open")),
    "你想怎么开始？可以照着这一步，也可以用替代方案。",
  );
  assert.equal(
    new Set(Object.keys(GUIDE_MODES).map((m) => guideText(record(m)))).size,
    4,
  );
  assert.equal(
    guideText(record("imitative", 2)),
    "照着做完以后，你最想改变哪个地方？",
  );
  assert.equal(
    guideText(record("reverse", 2)),
    "刚才哪个发现和你最初的猜测不一样？",
  );
  assert.equal(
    guideText(record("open", 2)),
    "给今天的探索起个名字吧。你愿意的话，也可以分享给家人。",
  );
});

test("web mode uses the real activity alternative for every preference", () => {
  for (const m of Object.keys(GUIDE_MODES))
    assert.equal(guideText(record(m, 1, "web")), "也可以用积木搭一座桥。");
});

test("longer activities and invalid historical records have a readable safe fallback", () => {
  assert.equal(guideText(record("open", 3)), "这次你想改变什么？");
  assert.equal(guideText(record("invalid")), "你觉得怎样更稳？");
  for (const invalid of [-1, 1.5, 99, "0", null])
    assert.equal(
      guideText(record("open", invalid)),
      "和孩子一起观察，按自己的节奏试一试。",
    );
  assert.equal(guideText(null), "和孩子一起观察，按自己的节奏试一试。");
  assert.equal(
    guideText({ ...record("open"), mode: "web", activity: { steps: [] } }),
    "和孩子一起观察，按自己的节奏试一试。",
  );
});

test("guidance summary renders only known finite counts and never interpolates untrusted text", () => {
  const html = renderGuidanceSummary({
    answered_count: 4,
    counts: { cognitive: 2, imitative: 1, reverse: 0, open: 1 },
    content_version: "<img onerror=alert(1)>",
  });
  for (const { label } of Object.values(GUIDE_MODES))
    assert.ok(html.includes(label));
  assert.ok(html.includes("2 次"));
  assert.ok(!html.includes("<img"));
  assert.equal(renderGuidanceSummary(null), "");
  assert.equal(
    renderGuidanceSummary({ counts: { cognitive: "<script>" } }),
    "",
  );
  assert.equal(
    renderGuidanceSummary({
      counts: { cognitive: 4, imitative: 0, reverse: 0, open: 0 },
      answered_count: 3,
    }),
    "",
  );
  const unsafe = record("cognitive");
  unsafe.activity.steps[0].guide_text = "<img src=x onerror=alert(1)>";
  assert.equal(
    guideText(unsafe),
    unsafe.activity.steps[0].guide_text,
    "speech is plain data; HTML rendering must escape it",
  );
});
