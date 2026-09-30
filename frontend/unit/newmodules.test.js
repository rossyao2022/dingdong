import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
const base = path.resolve(import.meta.dirname, "..");
function modules() {
  const handlers = [];
  const context = vm.createContext({
    window: {},
    document: {
      addEventListener: (_, fn) => handlers.push(fn),
      querySelector: () => null,
    },
    location: { hash: "#explore" },
    setTimeout,
  });
  for (const file of [
    "riasec.js",
    "career-data.js",
    "career-explorer.js",
    "island-explorer.js",
    "talent-data.js",
    "talent-explorer.js",
    "fingerprint-guide.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context, {
      filename: file,
    });
  }
  return { window: context.window, handlers };
}
const allAnswers = (selected, value) =>
  Object.fromEntries(
    selected.flatMap((id) =>
      [0, 1, 2].map((index) => [`${id}-${index}`, value]),
    ),
  );

test("all six original islands have three scenarios and every ordered triple has career/project content", () => {
  const { window: w } = modules();
  assert.equal(w.RIASEC.islands.length, 6);
  assert.ok(w.RIASEC.islands.every((row) => row.questions.length === 3));
  assert.equal(Object.keys(w.CareerData).length, 20);
  let count = 0;
  for (const first of "RIASEC")
    for (const second of "RIASEC")
      for (const third of "RIASEC") {
        const selected = [first, second, third];
        if (new Set(selected).size !== 3) continue;
        const html = w.CareerExplorer.render(
          selected,
          selected.map((id) => ({ id, mean: 2 })),
        );
        assert.match(html, /career-combination/);
        assert.match(html, /career-plan/);
        assert.ok(html.includes(selected.join(" · ")));
        count++;
      }
  assert.equal(count, 120);
});

test("zero is a saved valid interest answer, unselected directions and malformed ratings are discarded", () => {
  const { window: w } = modules();
  w.IslandExplorer.setState({
    selected: ["R", "I", "A"],
    answers: { "R-0": 0, "R-1": 4, "R-2": 5, "S-0": 3, "I-0": "2" },
  });
  const state = w.IslandExplorer.exportData();
  assert.equal(state.answers["R-0"], 0);
  assert.equal(state.answers["R-1"], 4);
  assert.equal(Object.keys(state.answers).length, 2);
  assert.equal(state.completed, false);
  w.IslandExplorer.setState({
    selected: ["R", "R", "I"],
    answers: { "R-0": 3 },
  });
  assert.equal(w.IslandExplorer.exportData().selected.length, 0);
});

test("completed UI requires all answers and an authoritative server result", () => {
  const { window: w } = modules();
  const selected = ["R", "I", "A"];
  const answers = allAnswers(selected, 0);
  w.IslandExplorer.setState({ selected, answers, completed: true });
  assert.equal(w.IslandExplorer.exportData().completed, false);
  w.IslandExplorer.setState({
    selected,
    answers,
    completed: true,
    result: { profiles: selected.map((id) => ({ id, score: 0 })) },
  });
  assert.equal(w.IslandExplorer.exportData().completed, true);
  w.IslandExplorer.reset();
  assert.equal(Object.keys(w.IslandExplorer.exportData().answers).length, 0);
});

test("eight dimensions preserve the original 24 prompts and do not fill missing answers", () => {
  const { window: w } = modules();
  assert.equal(w.TalentData.questions.length, 24);
  assert.equal(w.TalentData.dimensions.length, 8);
  for (const row of w.TalentData.dimensions)
    assert.equal(
      w.TalentData.questions.filter((q) => q.type === row.id).length,
      3,
    );
  w.TalentExplorer.setState({ answers: { 1: 1, 2: 1 } });
  assert.equal(w.TalentExplorer.scores()[0].score, null);
  w.TalentExplorer.setState({
    answers: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 6, 6: "3" },
  });
  assert.equal(w.TalentExplorer.scores()[0].score, 3);
  assert.equal(w.TalentExplorer.scores()[1].score, null);
});

test("history uses published server scores and preserves ties without inventing a top three", () => {
  const { window: w } = modules();
  const answers = Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [i + 1, 1]),
  );
  const result = {
    dimensions: w.TalentData.dimensions.map((row) => ({
      id: row.id,
      score: 9,
    })),
  };
  w.TalentExplorer.setState({ answers, completed: true, result });
  assert.ok(w.TalentExplorer.scores().every((row) => row.score === 9));
  const html = w.TalentExplorer.render();
  assert.match(html, /本次不强行排前三/);
  assert.match(html, /9\/15/);
  assert.equal((html.match(/data-talent-dimension=/g) || []).length, 8);
});

test("published question titles are escaped, and completed answers are read only", () => {
  const { window: w } = modules();
  const answers = Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [i + 1, 3]),
  );
  const result = {
    dimensions: w.TalentData.dimensions.map((row) => ({
      id: row.id,
      score: 9,
    })),
  };
  w.TalentExplorer.setState({
    answers,
    completed: true,
    result,
    questions: [{ code: "1", title: "<script>bad()</script>" }],
  });
  const html = w.TalentExplorer.render();
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("consent cancellation and a stale asynchronous session do not open a questionnaire", async () => {
  const { window: w } = modules();
  let dialogs = 0;
  w.IslandExplorer.setState({ selected: ["R", "I", "A"] });
  w.IslandExplorer.bind({ ensure: async () => null, dialog: () => dialogs++ });
  await w.IslandExplorer.start();
  assert.equal(dialogs, 0);
  let resolve,
    current = true;
  w.TalentExplorer.bind({
    context: () => 1,
    isCurrent: () => current,
    ensure: () =>
      new Promise((r) => {
        resolve = r;
      }),
    dialog: () => dialogs++,
  });
  const pending = w.TalentExplorer.start();
  current = false;
  resolve({ answers: { 1: 5 } });
  await pending;
  assert.equal(dialogs, 0);
  assert.equal(Object.keys(w.TalentExplorer.exportData().answers).length, 0);
});

test("all four manual fingerprint guides retain observation, learning, communication and three-step activities", () => {
  const { window: w } = modules();
  assert.deepEqual(Object.keys(w.FingerprintGuide.guides).sort(), [
    "arch",
    "loop",
    "reverse",
    "whorl",
  ]);
  for (const [id, guide] of Object.entries(w.FingerprintGuide.guides)) {
    assert.equal(guide.angle.length, 3);
    assert.equal(guide.learning.length, 3);
    assert.equal(guide.communication.length, 3);
    assert.equal(guide.activity.steps.length, 3);
    const html = w.FingerprintGuide.render(id);
    assert.match(html, /不能据此判断能力/);
    assert.match(html, /data-fp-guide-pattern/);
  }
});

test("modules never persist answers, results or images in browser storage or issue image network writes", () => {
  for (const file of [
    "island-explorer.js",
    "talent-explorer.js",
    "fingerprint.js",
  ]) {
    const source = fs.readFileSync(path.join(base, file), "utf8");
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
    if (file === "fingerprint.js")
      assert.doesNotMatch(
        source,
        /fetch\(|XMLHttpRequest|sendBeacon|\.toDataURL\(/,
      );
  }
});

test("cancelling a changed completed selection restores its original answers and result", async () => {
  const { window: w, handlers } = modules();
  const selected = ["R", "I", "A"];
  w.IslandExplorer.setState({
    selected,
    answers: allAnswers(selected, 4),
    completed: true,
    result: { profiles: selected.map((id) => ({ id, score: 4 })) },
  });
  let pending;
  w.IslandExplorer.bind({
    selection: async (_selected, previous) => previous,
    run: (fn) => {
      pending = fn();
    },
  });
  const el = {
    disabled: false,
    dataset: { interestAction: "select", id: "R" },
  };
  handlers[0]({ target: { closest: () => el } });
  await pending;
  const restored = w.IslandExplorer.exportData();
  assert.deepEqual(Array.from(restored.selected), selected);
  assert.equal(Object.keys(restored.answers).length, 9);
  assert.equal(restored.completed, true);
});

test("a failed answer save does not advance or claim that the new answer was saved", async () => {
  const { window: w, handlers } = modules();
  w.IslandExplorer.setState({
    selected: ["R", "I", "A"],
    answers: { "R-0": 1 },
    index: 0,
  });
  let pending;
  w.IslandExplorer.bind({
    answer: async () => {
      throw Error("save unavailable");
    },
    run: (fn) => {
      pending = fn();
    },
  });
  const el = {
    disabled: false,
    dataset: { interestAction: "answer", rating: "4" },
  };
  handlers[0]({ target: { closest: () => el } });
  await assert.rejects(pending, /save unavailable/);
  assert.equal(w.IslandExplorer.exportData().answers["R-0"], 1);
  assert.equal(w.IslandExplorer.exportData().index, 0);
});

test("questionnaire options and historical review use escaped published-version labels", async () => {
  const { window: w } = modules();
  const answers = Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [i + 1, 3]),
  );
  const result = {
    dimensions: w.TalentData.dimensions.map((row) => ({
      id: row.id,
      score: 9,
    })),
  };
  const questions = [
    {
      code: "1",
      title: "新版题目",
      options: [{ code: "3", label: "新版选项 <img onerror=bad()> &" }],
    },
  ];
  const saved = { answers, completed: true, result, questions };
  w.TalentExplorer.setState(saved);
  assert.match(
    w.TalentExplorer.render(),
    /新版选项 &lt;img onerror=bad\(\)&gt; &amp;/,
  );
  let body = "";
  w.TalentExplorer.bind({
    ensure: async () => saved,
    dialog: (_title, value) => {
      body = value;
    },
  });
  await w.TalentExplorer.start();
  assert.match(body, /新版选项 &lt;img onerror=bad\(\)&gt; &amp;/);
  assert.ok(!body.includes("<img onerror=bad()>"));
  const interest = {
    selected: ["R", "I", "A"],
    answers: {},
    questions: [
      {
        code: "R-0",
        title: "兴趣新版题",
        options: [{ code: "0", label: "新版0 <b>标签</b>" }],
      },
    ],
  };
  w.IslandExplorer.setState(interest);
  w.IslandExplorer.bind({
    ensure: async () => interest,
    dialog: (_title, value) => {
      body = value;
    },
  });
  await w.IslandExplorer.start();
  assert.match(body, /新版0 &lt;b&gt;标签&lt;\/b&gt;/);
  assert.match(body, /兴趣新版题/);
});

test("a guarded new attempt adopts its refresh address before opening one-click question", async () => {
  const { window: w } = modules();
  for (const [purpose, module] of [
    ["interest", w.IslandExplorer],
    ["talent", w.TalentExplorer],
  ]) {
    let context = "historical",
      adopted = false,
      body = "";
    const next = {
      selected: purpose === "interest" ? ["R", "I", "A"] : [],
      answers: {},
      completed: false,
      index: 0,
    };
    module.bind({
      context: () => context,
      isCurrent: (token) => token === context,
      restart: async () => next,
      adopt: (p) => {
        assert.equal(p, purpose);
        context = "new-attempt";
        adopted = true;
      },
      render: async () => {},
      dialog: (_title, html) => {
        assert.equal(adopted, true);
        body = html;
      },
    });
    await module.restart();
    assert.match(
      body,
      purpose === "interest" ? /第 1 \/ 9 题/ : /第 1 \/ 24 题/,
    );
    assert.equal(Object.keys(module.exportData().answers).length, 0);
  }
});

test("a stale restart never adopts an address or opens a new question", async () => {
  const { window: w } = modules();
  let resolve,
    current = true,
    adoptions = 0,
    dialogs = 0;
  w.TalentExplorer.setState({ answers: { 1: 5 } });
  w.TalentExplorer.bind({
    context: () => 1,
    isCurrent: () => current,
    restart: () =>
      new Promise((r) => {
        resolve = r;
      }),
    adopt: () => adoptions++,
    dialog: () => dialogs++,
  });
  const pending = w.TalentExplorer.restart();
  current = false;
  resolve({ answers: {}, completed: false });
  await pending;
  assert.equal(adoptions, 0);
  assert.equal(dialogs, 0);
  assert.equal(w.TalentExplorer.exportData().answers[1], 5);
});
