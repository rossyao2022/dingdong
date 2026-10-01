import test from "node:test";
import assert from "node:assert/strict";
import {
  nextExperience,
  experienceRecords,
  renderExperienceTask,
  renderExperienceRecords,
} from "../experience-flow.js";
const child = "child-a";
const session = (id, purpose, status, extra = {}) => ({
  id,
  child_id: child,
  purpose,
  status,
  title: "实际题库名称",
  completed_at: "2026-10-01T02:00:00Z",
  ...extra,
});
test("active activity wins over unfinished exploration and completed interest", () => {
  const task = nextExperience(
    [session("s", "interest", "draft")],
    [
      {
        id: "a",
        child_id: child,
        status: "active",
        activity: { title: "找树叶" },
      },
    ],
    child,
  );
  assert.equal(task.href, "#activity/a");
});
test("unfinished exploration resumes actual session; cancelled and other children cannot influence journey", () => {
  assert.equal(
    nextExperience(
      [
        session("x", "interest", "cancelled"),
        session("wrong", "talent", "draft", { child_id: "b" }),
        session("s", "talent", "ready"),
      ],
      [],
      child,
    ).href,
    "#talents/s",
  );
  assert.equal(
    nextExperience([session("s", "assessment", "processing")], [], child).kind,
    "interest",
  );
});
test("completed interest selects existing activities and latest completed activity offers review", () => {
  const sessions = [session("s", "interest", "completed")];
  assert.equal(nextExperience(sessions, [], child).href, "#home");
  const task = nextExperience(
    sessions,
    [
      {
        id: "done",
        child_id: child,
        status: "completed",
        finished_at: "2026-10-01T03:00:00Z",
        activity: { title: "找树叶" },
      },
    ],
    child,
  );
  assert.equal(task.reviewHref, "#activity/done");
});
test("session and linked report produce one dated entry, repeated same-title sessions remain distinct", () => {
  const rows = experienceRecords(
    [
      session("s", "assessment", "completed", { report_id: "r" }),
      session("s2", "assessment", "completed", {
        completed_at: "2026-09-30T01:00:00Z",
      }),
    ],
    [{ id: "r", kind: "initial", generated_at: "2026-10-01T02:01:00Z" }],
    [],
    child,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].href, "#assessment/s");
  assert.equal(rows[0].title, "实际题库名称");
  assert.equal(rows[0].time, "2026-10-01T02:00:00Z");
});
test("history sorts activity and assessment by time and filters other child data", () => {
  const rows = experienceRecords(
    [
      session("s", "interest", "completed"),
      session("b", "talent", "completed", { child_id: "b" }),
    ],
    [],
    [
      {
        id: "a",
        child_id: child,
        status: "completed",
        finished_at: "2026-10-01T04:00:00Z",
        activity: { title: "亲子活动" },
      },
    ],
    child,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].href, "#activity/a");
});
test("components escape dynamic titles, preserve zero knowledge and use accessible progress/time", () => {
  const task = renderExperienceTask(nextExperience([], [], child));
  assert.match(task, /aria-label="体验主线"/);
  assert.match(task, /开始兴趣探索/);
  const html = renderExperienceRecords(
    experienceRecords(
      [session("s", "talent", "completed", { title: "<img onerror=bad>" })],
      [],
      [],
      child,
    ),
  );
  assert.ok(!html.includes("<img onerror"));
  assert.match(html, /&lt;img/);
  assert.match(html, /<time datetime=/);
  assert.ok(!html.includes("初始报告"));
});

test("unfinished interest and talent main actions resume a specific saved questionnaire, not only its map", () => {
  for (const purpose of ["interest", "talent"]) {
    const task = nextExperience(
      [session("unfinished", purpose, "draft")],
      [],
      child,
    );
    assert.equal(task.action, "journey-resume");
    assert.equal(task.sessionId, "unfinished");
    assert.equal(task.purpose, purpose);
    assert.match(renderExperienceTask(task), /data-action="journey-resume"/);
    assert.match(renderExperienceTask(task), /data-id="unfinished"/);
  }
});
