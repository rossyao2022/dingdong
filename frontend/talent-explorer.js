/* Original eight-dimension questionnaire: answer-derived scores, no synthetic defaults. */
(() => {
  "use strict";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const { questions, dimensions, options, version } = window.TalentData;
  const valid = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
  const blank = () => ({
    version,
    index: 0,
    answers: {},
    completed: false,
    completedAt: null,
    result: null,
    questions: [],
  });
  let state = blank(),
    bridge = {};
  const complete = () => questions.every((q) => valid(state.answers[q.id]));
  function setState(input = {}) {
    const next = blank();
    for (const q of questions)
      if (valid(input.answers?.[q.id]))
        next.answers[q.id] = input.answers[q.id];
    next.questions = Array.isArray(input.questions) ? input.questions : [];
    next.result = input.result || null;
    next.completed =
      !!input.completed &&
      questions.every((q) => valid(next.answers[q.id])) &&
      !!next.result;
    next.completedAt = next.completed ? input.completedAt : null;
    next.index = Number.isInteger(input.index)
      ? Math.max(0, Math.min(23, input.index))
      : state.index;
    state = next;
  }
  const text = (q) =>
    esc(
      state.questions.find((row) => row.code === String(q.id))?.title || q.text,
    );
  const optionLabel = (code, value) =>
    esc(
      state.questions
        .find((q) => q.code === String(code))
        ?.options?.find((o) => o.code === String(value))?.label ??
        options[value - 1],
    );
  const token = () => bridge.context?.();
  const current = (t) => !bridge.isCurrent || bridge.isCurrent(t);
  async function call(name, ...args) {
    if (typeof bridge[name] !== "function")
      throw Error("探索暂时无法保存，请稍后再试。");
    const t = token(),
      data = await bridge[name](...args);
    if (!current(t) || data == null) return false;
    setState(data);
    bridge.adopt?.(args[0]);
    return true;
  }
  function scores() {
    return dimensions.map((d) => {
      const answers = questions
        .filter((q) => q.type === d.id)
        .map((q) => state.answers[q.id]);
      return {
        ...d,
        score: state.completed
          ? state.result.dimensions.find((row) => row.id === d.id)?.score
          : answers.every(valid)
            ? answers.reduce((a, b) => a + b, 0)
            : null,
      };
    });
  }
  const link = '<a class="text-button" href="#explore">← 回到天赋探索</a>';
  function summary() {
    return `<a class="talent-summary" href="#talents"><span class="talent-summary-icon">✦</span><div><small>24 题 · 约 5–8 分钟</small><h3>八大天赋优势</h3><p>${state.completed ? "已完成 · 查看八维画像、逐项解释和行动建议" : Object.keys(state.answers).length ? `已回答 ${Object.keys(state.answers).length} / 24 题，接着发现自己` : "从日常表现了解八个维度"}</p></div><b>${state.completed ? "查看报告" : "开启探索"} →</b></a>`;
  }
  function render() {
    if (state.completed) return report();
    return `${link}<section class="talent-welcome"><div><h1>八大天赋优势</h1><p>和家长一起，按最近的真实表现作答。</p><p class="small-print">日常表现观察问卷，不代表标准化能力分数，也不为孩子固定类型。</p><div class="talent-welcome-actions"><button class="button" data-talent-action="start">${Object.keys(state.answers).length ? "继续上次的探索" : "开始 24 题探索"} →</button><span>24 道题 · 约 5–8 分钟</span></div></div><div class="talent-orbit"><img src="assets/dingdong/robot-wave.webp" alt="DingDong 陪你发现八种可能">${dimensions.map((d, i) => `<span style="--i:${i};--dim:${d.color}" title="${d.name}">${d.icon}</span>`).join("")}</div></section><details class="talent-intro-details"><summary>了解八个维度</summary><div class="talent-intro-grid">${dimensions.map((d, i) => `<article style="--dim:${d.color}"><span>${d.icon}</span><small>0${i + 1} / ${d.name}</small><h3>${d.nickname}</h3><p>${d.desc}</p></article>`).join("")}</div></details><details class="talent-method"><summary>作答与计分说明</summary><p>每个维度 3 题，选项从“完全不符合”到“完全符合”，每题 1–5 分。家长可以结合具体事例与孩子商量；暂时拿不准可选“一般”，之后补充观察再修改。可以中途退出并继续。</p><p>每维 3 题相加，原始分 3–15。答案会保存到孩子的探索记录，可以稍后继续。</p></details>`;
  }
  function question() {
    const q = questions[state.index],
      d = dimensions.find((d) => d.id === q.type);
    bridge.dialog?.(
      "八维日常表现问卷",
      `<div class="dialog-body talent-question" style="--dim:${d.color}"><div class="talent-question-top"><span>${d.icon} ${d.name}</span><b>第 ${state.index + 1} / 24 题</b></div><div class="talent-progress" role="progressbar" aria-label="八维问卷答题进度" aria-valuemin="0" aria-valuemax="24" aria-valuenow="${Object.keys(state.answers).length}"><i style="width:${(Object.keys(state.answers).length / 24) * 100}%"></i></div><p class="talent-prompt-hint">想一想，最近的自己符合这句话吗？</p><h3 id="talent-question-title" tabindex="-1">${text(q)}</h3><div class="talent-options" role="group" aria-label="符合程度">${options.map((label, i) => `<button data-talent-action="answer" data-value="${i + 1}" ${state.completed ? "disabled" : ""} class="${state.answers[q.id] === i + 1 ? "selected" : ""}" aria-pressed="${state.answers[q.id] === i + 1}"><span>${i + 1}</span>${optionLabel(q.id, i + 1)}<b aria-hidden="true">${state.answers[q.id] === i + 1 ? "✓" : "○"}</b></button>`).join("")}</div><p class="small-print">没有标准答案，选择真实的自己就好。可以退出，进度会自动保存。</p></div>`,
      `<button class="button ghost" data-talent-action="previous" ${state.index === 0 ? "disabled" : ""}>上一题</button><button class="button" data-talent-action="next" ${valid(state.answers[q.id]) ? "" : "disabled"}>${state.index === 23 ? "生成我的八维报告" : "下一题 →"}</button>`,
      "八大天赋优势",
    );
  }
  function radar(rows) {
    const order = [
      "word",
      "logic",
      "space",
      "music",
      "body",
      "social",
      "self",
      "nature",
    ];
    const ds = order.map((id) => rows.find((d) => d.id === id));
    const point = (i, r) => [
      200 + Math.sin((i * Math.PI) / 4) * r,
      190 - Math.cos((i * Math.PI) / 4) * r,
    ];
    return `<svg class="talent-radar" viewBox="0 0 400 390" role="img" aria-label="八维表现雷达图，各维度原始分见下方详细卡片"><title>八维观察得分，满分 15</title>${[
      1, 2, 3, 4, 5,
    ]
      .map(
        (n) =>
          `<polygon points="${ds.map((_, i) => point(i, n * 25).join(",")).join(" ")}" fill="${n % 2 ? "#f8f3ff" : "#fff"}" stroke="#e6deee"/>`,
      )
      .reverse()
      .join(
        "",
      )}${ds.map((_, i) => `<line x1="200" y1="190" x2="${point(i, 125)[0]}" y2="${point(i, 125)[1]}" stroke="#e6deee"/>`).join("")}<polygon points="${ds.map((d, i) => point(i, (d.score / 15) * 125).join(",")).join(" ")}" fill="#aa7ccb44" stroke="#9560b5" stroke-width="3"/>${ds.map((d, i) => `<circle cx="${point(i, (d.score / 15) * 125)[0]}" cy="${point(i, (d.score / 15) * 125)[1]}" r="5" fill="${d.color}"/><text x="${point(i, 160)[0]}" y="${point(i, 160)[1]}" text-anchor="middle" dominant-baseline="middle">${d.name}</text>`).join("")}</svg>`;
  }
  function report() {
    if (!state.completed || !complete()) return render();
    const rows = scores();
    if (rows.some((row) => !Number.isFinite(row.score)))
      return link + '<p role="status">探索记录暂时未能打开，请稍后重试。</p>';
    const ranked = [...rows].sort((a, b) => b.score - a.score),
      unique = [...new Set(rows.map((r) => r.score))],
      cut = ranked[2].score,
      top = unique.length === 1 ? [] : ranked.filter((r) => r.score >= cut);
    return `${link}<section class="talent-report-heading"><h1>八维观察报告</h1><p>24 / 24 题已完成 · 记录这次的日常表现</p><p class="small-print">不代表标准化能力分数，也不为孩子固定类型。</p><div class="talent-report-actions"><button class="button ghost" data-talent-action="review">回看答案</button><button class="button ghost" data-talent-action="restart">重新探索</button><button type="button" class="button ghost" data-action="export-child">导出成长记录</button></div></section><section class="talent-report-overview"><div>${radar(rows)}<p class="small-print">每维 3 题相加 · 原始分 3–15 · 非人群百分位</p></div><div><h2>${top.length ? "本次较常观察到的表现" : "八个维度得分相同"}</h2><div class="talent-top-tags">${(top.length ? top : rows).map((d) => `<span style="--dim:${d.color}">${d.icon} ${d.name} <b>${d.score}/15</b></span>`).join("")}</div><p>${top.length ? "得分前三位及同分维度。先选喜欢的一项，试试下面的活动。" : "各维度得分相同，本次不强行排前三。先选一个好奇的活动，积累更多真实事例。"}</p><p>低分也可能与接触机会或当前状态有关，无需急着下结论。</p><a class="text-button" href="#explore">再看看我喜欢哪些兴趣岛 →</a></div></section><div class="talent-detail-heading"><h2>八维明细与小活动</h2><span>展开查看建议或原题</span></div><div class="talent-results-grid">${rows
      .map(
        (d) =>
          `<article class="talent-result-card" data-talent-dimension="${d.id}" style="--dim:${d.color}"><header><span class="talent-card-icon">${d.icon}</span><div><small>${d.nickname}</small><h3>${d.name}</h3></div><b class="talent-score">${d.score}<small> / 15</small></b></header><div class="talent-score-track"><i style="width:${(d.score / 15) * 100}%"></i></div><p>${d.desc}</p><p class="talent-score-reading">${d.score >= 12 ? "本次回答中，这些表现较常被观察到。可以尝试更丰富的活动。" : d.score >= 8 ? "本次回答中，有些表现已被观察到。试着记录更具体的生活例子。" : "本次回答中，这些表现暂时较少被观察到。可以先轻松体验，无需急着下结论。"}</p><details class="talent-activity"><summary>这周试一次：${d.activity}</summary><b>10–15 分钟</b><p>${d.steps}</p><small>和 DingDong 聊聊：${d.reflection}</small></details><details><summary>可了解的职业</summary><p class="talent-career-note"><b>长大后可以了解</b><br>${d.careers}</p><p>用于认识工作内容，不是职业适配结论。</p></details><details><summary>回看这个维度的 3 个回答</summary><ol>${questions
            .filter((q) => q.type === d.id)
            .map(
              (q) =>
                `<li>${text(q)}<b>${optionLabel(q.id, state.answers[q.id])} · ${state.answers[q.id]} / 5</b></li>`,
            )
            .join("")}</ol></details></article>`,
      )
      .join(
        "",
      )}</div><details class="talent-method"><summary>怎样使用这份报告</summary><p>本周先选一项：约定 10–15 分钟体验，留下一张作品或一句发现，过一周再聊“还想继续吗”。家长描述具体行为，如“你试了两种方法”，少用固定的天赋标签。</p><p>沿用原版八维观察问卷的题目、维度与计分；说明及行动建议已按观察语气整理。职业名称用于拓展认识，不是职业适配结论；相关职业仍有各自的学习与资质要求。</p></details>`;
  }
  async function refresh() {
    await bridge.render?.();
  }
  async function start() {
    if (!(await call("ensure", "talent"))) return;
    const unanswered = questions.findIndex((q) => !valid(state.answers[q.id]));
    state.index = unanswered < 0 ? 0 : unanswered;
    question();
  }
  async function restart() {
    if (!(await call("restart", "talent"))) return;
    state.index = 0;
    await refresh();
    question();
  }
  async function handle(action, b) {
    if (action === "start") await start();
    if (action === "answer") {
      const v = Number(b.dataset.value);
      if (!valid(v) || state.completed) return;
      if (
        !(await call("answer", "talent", String(questions[state.index].id), v))
      )
        return;
      question();
      document
        .querySelector(`[data-talent-action=answer][data-value="${v}"]`)
        ?.focus();
    }
    if (action === "previous" && state.index > 0) {
      state.index--;
      question();
      document.querySelector("#talent-question-title")?.focus();
    }
    if (action === "next" && valid(state.answers[questions[state.index].id])) {
      if (state.index < 23) {
        state.index++;
        question();
        document.querySelector("#talent-question-title")?.focus();
      } else if (complete()) {
        if (!state.completed && !(await call("complete", "talent"))) return;
        bridge.close?.();
        await refresh();
        window.scrollTo({ top: 0 });
      }
    }
    if (action === "review") {
      state.index = 0;
      question();
    }
    if (action === "restart") await restart();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-talent-action]");
    if (!b || b.disabled) return;
    const fn = () => handle(b.dataset.talentAction, b);
    if (bridge.run) bridge.run(fn, b);
    else fn().catch((error) => bridge.toast?.(error.message));
  });
  window.TalentExplorer = {
    render,
    summary,
    scores,
    setState,
    start,
    restart,
    bind(b) {
      bridge = b;
    },
    exportData() {
      return {
        ...JSON.parse(JSON.stringify(state)),
        scores: state.completed
          ? scores().map(({ id, name, score }) => ({
              id,
              name,
              score,
              max: 15,
            }))
          : null,
      };
    },
    reset() {
      state = blank();
    },
  };
})();
