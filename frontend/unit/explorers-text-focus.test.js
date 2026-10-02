import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
const base = path.resolve(import.meta.dirname, "..");
function modules() {
  const context = vm.createContext({
    window: {},
    document: {
      addEventListener() {},
      querySelector() {
        return null;
      },
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
    "fingerprint.js",
  ])
    vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context);
  return context.window;
}
test("fingerprint primary preparation action precedes viewport and retains adjacent visible boundaries", () => {
  const w = modules(),
    html = w.FingerprintLab.render();
  assert.ok(
    html.indexOf('data-fp-action="sample"') <
      html.indexOf('id="fp-viewfinder"'),
  );
  assert.match(html, /<h1>观察指纹纹路/);
  assert.ok(
    html.indexOf("不会上传或保存") < html.indexOf('id="fp-viewfinder"'),
  );
  assert.match(html, /手动选择，不会自动识别/);
  assert.match(html, /不代表能力、性格或天赋/);
});
test("talent welcome keeps start and boundary visible while all eight introductory dimensions are optional", () => {
  const html = modules().TalentExplorer.render();
  assert.match(html, /data-talent-action="start"/);
  assert.match(html, /<details[^>]*><summary>了解八个维度/);
  assert.equal(
    (
      html.match(
        /\/ 语言|\/ 音乐|\/ 逻辑|\/ 空间|\/ 身体|\/ 内省|\/ 人际|\/ 自然/g,
      ) || []
    ).length,
    8,
  );
  assert.match(html, /不代表标准化能力分数/);
});
test("guide activity action and limitation precede optional complete advice", () => {
  const w = modules();
  for (const id of Object.keys(w.FingerprintGuide.guides)) {
    const html = w.FingerprintGuide.render(id),
      g = w.FingerprintGuide.guides[id];
    assert.ok(
      html.indexOf('data-action="exploration-guide-task"') <
        html.indexOf('class="fp-guide-details"'),
    );
    assert.ok(
      html.indexOf("不能据此判断能力") <
        html.indexOf('class="fp-guide-details"'),
    );
    assert.match(
      html,
      /<details class="fp-guide-details"><summary>查看学习与沟通建议/,
    );
    for (const group of [g.angle, g.learning, g.communication])
      for (const [title, detail] of group) {
        assert.ok(html.includes(title));
        assert.ok(html.includes(detail));
      }
    for (const step of g.activity.steps) assert.ok(html.includes(step));
  }
});
test("map selection warning remains visible throughout saved states and one selection instruction is retained", () => {
  const w = modules();
  w.IslandExplorer.setState({
    selected: ["R", "I", "A"],
    answers: { "R-0": 0 },
  });
  const html = w.IslandExplorer.render();
  assert.match(html, /调整组合会重置本次情境题答案/);
  assert.equal(
    (html.match(/按喜欢的顺序选 3 座岛，再答 9 题/g) || []).length,
    1,
  );
  assert.equal((html.match(/data-world-id=/g) || []).length, 6);
});
test("talent report keeps eight scores and each activity, career and saved answer reachable in details", () => {
  const w = modules(),
    answers = Object.fromEntries(w.TalentData.questions.map((q) => [q.id, 3]));
  w.TalentExplorer.setState({
    answers,
    completed: true,
    result: {
      dimensions: w.TalentData.dimensions.map((d) => ({ id: d.id, score: 9 })),
    },
  });
  const html = w.TalentExplorer.render();
  assert.equal((html.match(/data-talent-dimension=/g) || []).length, 8);
  assert.equal(
    (html.match(/<details class="talent-activity">/g) || []).length,
    8,
  );
  assert.equal(
    (html.match(/<summary>回看这个维度的 3 个回答/g) || []).length,
    8,
  );
  for (const d of w.TalentData.dimensions) {
    assert.ok(html.includes(d.activity));
    assert.ok(html.includes(d.steps));
    assert.ok(html.includes(d.reflection));
    assert.ok(html.includes(d.careers));
  }
  assert.match(html, /原始分 3–15 · 非人群百分位/);
  assert.match(html, /不代表标准化能力分数/);
});
test("career references keep low-interest caution visible and all 120 ordered combinations preserve source and project details", () => {
  const w = modules();
  for (const a of "RIASEC")
    for (const b of "RIASEC")
      for (const c of "RIASEC") {
        const ids = [a, b, c];
        if (new Set(ids).size !== 3) continue;
        const html = w.CareerExplorer.render(
            ids,
            ids.map((id) => ({ id, mean: 1 })),
          ),
          data =
            w.CareerData[
              Array.from("RIASEC")
                .filter((id) => ids.includes(id))
                .join("")
            ];
        assert.ok(html.indexOf("career-low-note") < html.indexOf("<details"));
        assert.ok(
          html.indexOf("不是问卷计算出的匹配率") < html.indexOf("<details"),
        );
        for (const career of data.careers) {
          assert.ok(html.includes(career.description));
          assert.ok(html.includes(career.code));
        }
        assert.ok(html.includes(data.source));
        for (const step of data.steps) assert.ok(html.includes(step));
      }
});
