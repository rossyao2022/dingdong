import test from "node:test";
import assert from "node:assert/strict";
import {
  explorerState,
  sameSelection,
  resumableSession,
} from "../exploration-session.js";

test("zero is a saved interest answer and first unanswered question resumes", () => {
  const result = explorerState({
    status: "draft",
    answers: [{ question_code: "R-0", option_codes: ["0"] }],
    questions: [{ code: "R-0" }, { code: "R-1" }],
    selected_islands: ["R", "I", "A"],
  });
  assert.equal(result.answers["R-0"], 0);
  assert.equal(result.index, 1);
  assert.equal(result.result, null);
});
test("ordered selection never resumes a different ranking or cancelled attempt", () => {
  assert.equal(sameSelection(["R", "I", "A"], ["I", "R", "A"]), false);
  const rows = [
    {
      purpose: "interest",
      status: "cancelled",
      selected_islands: ["R", "I", "A"],
    },
    { purpose: "interest", status: "draft", selected_islands: ["I", "R", "A"] },
  ];
  assert.equal(resumableSession(rows, "interest", ["R", "I", "A"]), null);
});
test("completed view uses persisted result rather than invented scores", () => {
  const result = {
    scoring_version: "v1",
    dimensions: [{ id: "word", score: 3 }],
  };
  assert.equal(
    explorerState({
      status: "completed",
      answers: [],
      questions: [],
      exploration_result: result,
    }).result,
    result,
  );
});

test("a new historical exploration has its own refreshable address for both purposes", async () => {
  const { continuedExplorerHash } = await import("../exploration-session.js");
  assert.equal(
    continuedExplorerHash("#interest/old-result", "interest", "new-attempt"),
    "#interest/new-attempt",
  );
  assert.equal(
    continuedExplorerHash("#talents/old-result", "talent", "new-attempt"),
    "#talents/new-attempt",
  );
});

test("adopting a new attempt preserves bare exploration and unrelated routes", async () => {
  const { continuedExplorerHash } = await import("../exploration-session.js");
  for (const hash of [
    "#explore",
    "#talents",
    "#settings",
    "#interest/old-result",
  ])
    assert.equal(continuedExplorerHash(hash, "talent", "new-attempt"), hash);
});
