import test from "node:test";
import assert from "node:assert/strict";
import {
  DIMENSION_KEYS,
  CURVE_DAYS,
  normaliseDingDongReport,
  renderDingDongReport,
} from "../dingdong-report.js";

const dimensions = (value) =>
  Object.fromEntries(DIMENSION_KEYS.map((key) => [key, value]));
const report = () => ({
  availability: "ready",
  persona_name: "Nova",
  companion_value: 130,
  effective_turns: 0,
  assessment: { baseline_scores: dimensions(0) },
  growth: {
    current: {
      dimensions: dimensions(25),
      engagement_index: 30,
      growth_stage: "growing",
      stage_progress: 0.62,
    },
    weekly_turns: 7,
    curve: CURVE_DAYS.map((day) => ({
      day,
      companion_value: day,
      engagement_index: 30,
      growth_stage: "growing",
      dimensions: dimensions(day / 2),
    })),
  },
  updated_at: "2026-09-30T06:00:00Z",
  sync_source: "get",
});

test("report uses source baseline/current/180-day curve and preserves zero and companion values over 100", () => {
  const view = normaliseDingDongReport(report());
  assert.equal(view.companionValue, 130);
  assert.equal(view.effectiveTurns, 0);
  assert.equal(view.weeklyTurns, 7);
  assert.equal(view.dimensions[0].baseline, 0);
  assert.equal(view.dimensions[0].current, 25);
  assert.equal(view.dimensions[0].future, 90);
  assert.equal(view.curve[0].dimensions.linguistic, 0);
  const html = renderDingDongReport(report());
  assert.match(html, /DingDong 陪伴成长报告/);
  assert.match(html, /模拟趋势参考/);
  assert.match(
    html,
    /data-action="dingdong-weekly-turns" data-value="7" aria-pressed="true"/,
  );
  assert.match(html, /<svg[^>]+role="img"/);
  assert.match(html, /130/);
});

test("canonical curve order ignores unknown days, leaves missing/duplicate days blank and never invents values", () => {
  const data = report();
  data.growth.curve = [
    data.growth.curve[6],
    data.growth.curve[0],
    { day: 8, dimensions: dimensions(99) },
    { day: 7, dimensions: dimensions(22) },
    { day: 7, dimensions: dimensions(44) },
  ];
  const view = normaliseDingDongReport(data);
  assert.deepEqual(
    view.curve.map((point) => point.day),
    CURVE_DAYS,
  );
  assert.equal(view.curve[0].dimensions.linguistic, 0);
  assert.equal(view.curve[1].dimensions.linguistic, null);
  assert.equal(view.curve[2].dimensions.linguistic, null);
  assert.equal(view.curve[6].dimensions.linguistic, 90);
  assert.ok(
    !renderDingDongReport(data).includes("<polyline"),
    "missing time points must interrupt the line instead of implying supplied values",
  );
  data.growth.curve = [{ day: 90, dimensions: dimensions(80) }];
  assert.equal(normaliseDingDongReport(data).dimensions[0].future, null);
});

test("numeric boundaries reject strings, booleans, infinities, negative and over-100 dimensions", () => {
  for (const value of [null, "72.00", true, NaN, Infinity, -1, 100.1, {}, []]) {
    const data = report();
    data.assessment.baseline_scores = dimensions(value);
    data.growth.current = { dimensions: dimensions(value) };
    data.growth.curve = [{ day: 180, dimensions: dimensions(value) }];
    const view = normaliseDingDongReport(data);
    assert.equal(view.dimensions[0].baseline, null);
    assert.equal(view.dimensions[0].current, null);
    assert.equal(view.dimensions[0].future, null);
    assert.ok(!renderDingDongReport(data).includes("NaN"));
  }
  const data = report();
  data.companion_value = -1;
  data.effective_turns = false;
  assert.equal(normaliseDingDongReport(data).companionValue, null);
  assert.equal(normaliseDingDongReport(data).effectiveTurns, null);
});

test("whitelisted report data and rendered HTML never carry credentials or injectable markup", () => {
  const data = report();
  data.persona_name = "<img src=x onerror=alert(1)>";
  data.access_token = "secret-jwt";
  data.nfc_token = "secret-nfc";
  data.phone = "18500000000";
  data.growth.curve[0].dimensions.extra = "secret-extra";
  const view = JSON.stringify(normaliseDingDongReport(data));
  const html = renderDingDongReport(data);
  for (const secret of [
    "secret-jwt",
    "secret-nfc",
    "18500000000",
    "secret-extra",
  ]) {
    assert.ok(!view.includes(secret));
    assert.ok(!html.includes(secret));
  }
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("sync_source"));
  assert.ok(!html.includes("growing"));
});

test("absent report, loading/error and partial data produce readable states without fabricated curves", () => {
  assert.equal(normaliseDingDongReport(null), null);
  assert.match(renderDingDongReport(null), /还没有陪伴成长记录/);
  assert.match(renderDingDongReport(null, { status: "loading" }), /正在读取/);
  assert.match(
    renderDingDongReport(null, {
      status: "error",
      message: "<script>secret</script>",
    }),
    /暂时无法读取/,
  );
  assert.ok(
    !renderDingDongReport(null, {
      status: "error",
      message: "<script>secret</script>",
    }).includes("secret"),
  );
  const data = report();
  data.growth = null;
  data.assessment = null;
  const html = renderDingDongReport(data);
  assert.match(html, /曲线还没有记录/);
  assert.ok(!html.includes("<polyline"));
  assert.ok(!html.includes("undefined"));
  assert.ok(!html.includes("NaN"));
});

test("simulation curve uses real day spacing and does not change robot settings", () => {
  const html = renderDingDongReport(report(), { demonstration: true });
  assert.match(html, /cx="79\.23333333333333"[^>]+><title>语言表达 · 第 7 天/);
  assert.match(html, /不会修改机器人设置/);
  assert.match(html, /演示内容/);
  assert.match(html, /有效互动/);
  assert.ok(!html.includes("<details"));
});

test("robot entry keeps bound chat independent of report read failures and preserves unbound CA experience", async () => {
  const { renderRobotEntry } = await import("../dingdong-report.js");
  const account = {
    status: "active",
    bind_state: "bound",
    child_id: "a",
    chat_url: "http://122.51.108.225",
  };
  const bound = renderRobotEntry([account], "a", { exhibition_enabled: true });
  assert.match(bound, /和 DingDong 对话/);
  assert.match(bound, /href="#reports"/);
  assert.match(bound, /href="#settings"/);
  assert.ok(!bound.includes("展会机器人"));
  const own = renderRobotEntry([account], "b", { exhibition_enabled: true });
  assert.match(own, /绑定机器人/);
  assert.match(own, /href="#exhibition"/);
  assert.ok(!own.includes("http://122.51"));
  assert.ok(
    !renderRobotEntry([], "a", { exhibition_enabled: false }).includes(
      "#exhibition",
    ),
  );
});

test("stale snapshots show saved time and a refresh action; empty cache remains actionable", () => {
  const html = renderDingDongReport({
    availability: "stale",
    updated_at: "2026-10-01T01:30:00Z",
    weekly_turns: 7,
  });
  assert.match(html, /暂时没能更新，先显示已保存的记录/);
  assert.match(html, /最近更新/);
  assert.match(html, /data-action="dingdong-report-refresh"/);
  assert.match(
    renderDingDongReport({ availability: "no_data" }),
    /data-action="dingdong-report-refresh"/,
  );
});
