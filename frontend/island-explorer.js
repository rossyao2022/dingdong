/* Six-island selection, ordered three-letter combination and original interest prompts. */
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
  const { islands, version } = window.RIASEC;
  const blank = () => ({
    version,
    selected: [],
    answers: {},
    index: 0,
    completed: false,
    result: null,
    questions: [],
  });
  let state = blank(),
    bridge = {};
  const item = (id) => islands.find((x) => x.id === id);
  const questionList = () =>
    state.selected.flatMap((id) =>
      item(id).questions.map((text, index) => ({
        id: `${id}-${index}`,
        island: id,
        text: esc(
          state.questions.find((q) => q.code === `${id}-${index}`)?.title ||
            text,
        ),
      })),
    );
  const ratingLabels = [
    "很不喜欢",
    "不太喜欢",
    "不确定",
    "有点喜欢",
    "非常喜欢",
  ];
  const optionLabel = (code, value) =>
    esc(
      state.questions
        .find((q) => q.code === String(code))
        ?.options?.find((o) => o.code === String(value))?.label ??
        ratingLabels[value],
    );
  const validRating = (x) => Number.isInteger(x) && x >= 0 && x <= 4;
  function setState(input = {}) {
    const next = blank();
    if (
      Array.isArray(input.selected) &&
      input.selected.length <= 3 &&
      new Set(input.selected).size === input.selected.length &&
      input.selected.every(item)
    )
      next.selected = [...input.selected];
    next.questions = Array.isArray(input.questions) ? input.questions : [];
    for (const id of next.selected)
      for (let i = 0; i < 3; i++) {
        const code = `${id}-${i}`;
        if (validRating(input.answers?.[code]))
          next.answers[code] = input.answers[code];
      }
    const complete =
      next.selected.length === 3 &&
      next.selected.every((id) =>
        [0, 1, 2].every((i) => validRating(next.answers[`${id}-${i}`])),
      );
    next.result = input.result || null;
    next.completed = !!input.completed && complete && !!next.result;
    next.index = Number.isInteger(input.index)
      ? Math.max(0, Math.min(8, input.index))
      : state.index;
    if (next.index < 0 || next.index > 8) next.index = 0;
    state = next;
  }
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
  function slots() {
    return `<div class="island-passport" aria-label="兴趣岛前三志愿">${[0, 1, 2]
      .map((i) => {
        const p = item(state.selected[i]);
        return `<div class="passport-slot ${p ? "filled" : ""}" ${p ? `style="--slot:${p.color};--soft:${p.soft}"` : ""}><span class="slot-order">第 ${i + 1} 志愿</span>${p ? `<div class="slot-value"><b>${p.id}</b><span>${p.name}<small>${p.type} · ${p.verb}</small></span><button data-interest-action="remove" data-id="${p.id}" aria-label="移除${p.name}">×</button></div><div class="slot-tools">${i > 0 ? `<button data-interest-action="earlier" data-id="${p.id}" aria-label="将${p.name}向前移一位">← 向前一位</button>` : "<span>我的第一选择</span>"}</div>` : '<div class="slot-empty"><span>＋</span> 选择一座心动的小岛</div>'}</div>`;
      })
      .join("")}</div>`;
  }
  function dock() {
    return `<div class="interest-dock-copy"><span class="interest-count">已选择 <b>${state.selected.length}</b> / 3 座岛</span><h3>${state.selected.length === 3 ? `我的兴趣组合：<strong>${state.selected.join(" · ")}</strong>` : "让三个兴趣方向，组成独特的你。"}</h3><p>${state.selected.length === 3 ? "按选择顺序组合，三个方向各有 3 道小情境。" : "依次点击第一、第二、第三志愿；再次点击可取消。"}</p></div><button class="button interest-start" data-interest-action="start" ${state.selected.length === 3 ? "" : "disabled"}>${state.completed ? "查看我的组合报告" : Object.keys(state.answers).length ? "继续兴趣探索" : "带上我的组合，出发"} <span>→</span></button>`;
  }
  function render() {
    return `<div class="wonder-heading v4-heading"><div><span class="wonder-eyebrow">DINGDONG EXPLORER CLUB · RIASEC</span><h1 aria-label="发现兴趣，认识独特的你。">发现兴趣，<em>认识独特的你。</em></h1><p>喜欢什么、怎样学习、如何陪伴，每一个方向都值得慢慢探索。</p></div></div>
 <nav class="module-nav" aria-label="探索模块"><button data-module-scroll="interest-map" style="--module:#397461"><b>01</b><span>兴趣岛<small>发现我喜欢什么</small></span><i>↓</i></button><a href="#talents" style="--module:#765492"><b>02</b><span>八大天赋优势<small>看见日常表现</small></span><i>↗</i></a><a href="#fingerprint" style="--module:#357584"><b>03</b><span>指纹小宇宙<small>观察纹路 · 探索陪伴</small></span><i>↗</i></a><button data-action="blindbox" style="--module:#a46832"><b>04</b><span>灵感盲盒<small>开始一个小行动</small></span><i>↗</i></button></nav><div class="module-heading" style="--module:#397461"><b>01</b><div><h2>兴趣岛 · 我喜欢做什么</h2><p>从六座岛中选出三个方向，认识兴趣组合和可以尝试的职业世界。</p></div><span>六选三 · 9 个情境</span></div><section class="six-island-world" id="interest-map" aria-label="霍兰德六座兴趣岛" data-selected="${state.selected.join("")}">
  <div class="six-world-intro"><div><span class="map-label">✦ 霍兰德兴趣岛 · 选出前三志愿</span><h2>下一站，<span>你的热爱。</span></h2><p>动手、研究、艺术、助人、发起、整理。<br>每一种好奇，都有一座岛等着你。</p></div><div class="six-guide"><span>我会陪你，<br>找到喜欢的方向！</span><img src="assets/dingdong/robot-wave.webp" alt="紫色 DingDong 机器人" width="160" height="160"></div></div>
  <div class="six-islands">${islands
    .map((p) => {
      const n = state.selected.indexOf(p.id);
      return `<button class="island-stop island-v4 ${n >= 0 ? "is-chosen" : ""}" style="--island-color:${p.color};--island-soft:${p.soft}" data-interest-action="select" data-world-id="${p.id}" data-id="${p.id}" aria-pressed="${n >= 0}" aria-label="${p.id} ${p.name}，${p.type}"><span class="island-rank">${n >= 0 ? `第 ${n + 1} 志愿 ✓` : "点击选岛 ＋"}</span><span class="island-halo"></span><img src="assets/generated/island-${p.id}-v5.webp" width="360" height="300" alt="DingDong 在${p.verb}的岛上" draggable="false"><span class="island-v4-title"><b class="riasec-letter">${p.id}</b><span><strong>${p.name}</strong><small>${p.type} · ${p.verb}</small></span></span><span class="island-description">${p.desc}</span></button>`;
    })
    .join("")}</div>
  <div class="selection-station"><div class="station-heading"><h3>我的登岛通行证</h3><span>按喜欢的顺序，装进三个方向</span></div><div id="island-slots">${slots()}</div><p id="island-selection-message" class="selection-message" role="status" aria-live="polite">选岛顺序会组成你的三个字母，例如 RIA。${Object.keys(state.answers).length ? " 调整组合会重置本次情境题答案。" : ""}</p><div id="world-dock" class="interest-dock">${dock()}</div></div>
 </section>
 <details class="interest-principle"><summary>六座兴趣岛，来自怎样的原理？<span>＋</span></summary><div><h3>霍兰德 RIASEC：认识你喜欢做的事</h3><p>R 实用型、I 研究型、A 艺术型、S 社会型、E 企业型、C 事务型，是六个兴趣方向。兴趣可以组合，也会随着体验发生变化。这里的三个字母记录你的选岛顺序。</p><p>本页的 9 道中文情境题由 DingDong 围绕所选方向编写，只反馈这些活动的喜欢程度，未覆盖其余三类，不是完整霍兰德测评、能力评定或职业定论。想了解完整的六类职业兴趣评估，可由家长陪同访问官方工具。</p><a href="https://www.onetcenter.org/IP.html" target="_blank" rel="noopener noreferrer">查看 O*NET® Interest Profiler 原理说明 ↗</a><a href="https://onetinterestprofiler.org/p/questions/1" target="_blank" rel="noopener noreferrer">打开官方完整英文测评 ↗</a></div></details>`;
  }
  function update(message = "") {
    const map = document.querySelector("#interest-map");
    if (!map) return;
    map.dataset.selected = state.selected.join("");
    map.querySelectorAll("[data-interest-action=select]").forEach((el) => {
      const n = state.selected.indexOf(el.dataset.id);
      el.classList.toggle("is-chosen", n >= 0);
      el.setAttribute("aria-pressed", String(n >= 0));
      el.querySelector(".island-rank").textContent =
        n >= 0 ? `第 ${n + 1} 志愿 ✓` : "点击选岛 ＋";
    });
    document.querySelector("#island-slots").innerHTML = slots();
    document.querySelector("#world-dock").innerHTML = dock();
    document.querySelector("#island-selection-message").textContent =
      message ||
      `已选 ${state.selected.length} 座岛。${state.selected.length === 3 ? "可以出发，也可以调整顺序。" : "继续选择你喜欢的方向。"}`;
  }
  async function change(id, action) {
    const previous = exportData();
    const ticket = token();
    const selected = [...state.selected];
    if (!item(id)) return;
    const index = selected.indexOf(id);
    if (action === "earlier") {
      if (index < 1) return;
      [selected[index - 1], selected[index]] = [
        selected[index],
        selected[index - 1],
      ];
    } else if (index >= 0) selected.splice(index, 1);
    else if (action === "select") {
      if (selected.length === 3) {
        update("通行证已经装满三座岛啦！先取消一座，再选择新的小岛。");
        return;
      }
      selected.push(id);
    } else return;
    const candidate = {
      selected,
      answers: {},
      index: 0,
      completed: false,
      result: null,
    };
    // Keep the existing answers and map intact while the parent decides.
    const data = bridge.selection
      ? await bridge.selection(selected, previous)
      : candidate;
    if (!current(ticket)) return;
    setState(data || previous);
    update();
    if (action !== "select")
      document.querySelector(`[data-world-id="${id}"]`)?.focus();
  }
  async function start() {
    if (state.selected.length !== 3) {
      bridge.close?.();
      goToIslands();
      return;
    }
    if (!(await call("ensure", "interest", [...state.selected]))) return;
    update();
    if (state.completed) {
      result();
      return;
    }
    const unanswered = questionList().findIndex(
      (q) => !validRating(state.answers[q.id]),
    );
    state.index = unanswered < 0 ? 0 : unanswered;
    question();
  }
  function question() {
    const questions = questionList();
    if (questions.length !== 9) return;
    const q = questions[state.index],
      p = item(q.island);
    bridge.dialog?.(
      "想一想，你喜欢这样玩吗？",
      `<div class="dialog-body interest-question"><div class="interest-question-meta"><span class="interest-code-badge" style="--island-color:${p.color}">${p.id} · ${p.name}</span><span>第 ${state.index + 1} / 9 题</span></div><div class="interest-progress" role="progressbar" aria-label="答题进度" aria-valuemin="0" aria-valuemax="9" aria-valuenow="${Object.keys(state.answers).length}"><i style="width:${(Object.keys(state.answers).length / 9) * 100}%"></i></div><div class="interest-question-scene"><img src="assets/generated/island-${p.id}-v5.webp" alt="" width="140" height="140"><h3 tabindex="-1" id="interest-question-title">${q.text}</h3></div><div class="interest-ratings" role="group" aria-label="对这个活动的喜欢程度">${["很不喜欢", "不太喜欢", "不确定", "有点喜欢", "非常喜欢"].map((label, i) => `<button class="interest-rating ${state.answers[q.id] === i ? "selected" : ""}" data-interest-action="answer" data-rating="${i}" ${state.completed ? "disabled" : ""} aria-pressed="${state.answers[q.id] === i}"><span aria-hidden="true">${["☁", "◔", "◉", "✿", "★"][i]}</span>${optionLabel(q.id, i)}</button>`).join("")}</div><p class="interest-question-note">回答“想不想做”，不用判断“做得好不好”。没有试过，可以选不确定。<br>答案会保存到孩子的探索记录，可以稍后继续。</p><span class="interest-method-label">所选三类的兴趣情境体验 · 非 O*NET 正式量表</span></div>`,
      `<button class="button ghost" data-interest-action="previous" ${state.index === 0 ? "disabled" : ""}>上一题</button><button class="button" data-interest-action="next" ${validRating(state.answers[q.id]) ? "" : "disabled"}>${state.index === 8 ? "看看我的兴趣组合" : "下一题 →"}</button>`,
      "MY THREE ISLANDS · " + state.selected.join(" · "),
    );
  }
  function result() {
    if (!state.completed) return;
    const profiles = state.selected.map((id) => {
      const p = item(id),
        scores = p.questions.map((_, i) => state.answers[`${id}-${i}`]);
      return {
        ...p,
        scores,
        mean: state.result.profiles.find((row) => row.id === id)?.score,
      };
    });
    if (profiles.some((p) => !Number.isFinite(p.mean))) {
      bridge.toast?.("探索记录暂时未能打开，请稍后重试。");
      return;
    }
    bridge.dialog?.(
      "原来，我的好奇有这些方向。",
      `<div class="dialog-body interest-result"><div class="interest-result-hero"><img src="assets/dingdong/robot-wave.webp" alt="DingDong 为你的发现庆祝" width="140" height="140"><div><span>我的选岛组合 · 按志愿顺序</span><h3>${state.selected.join(" · ")}</h3><p>${profiles.map((p) => p.type).join(" ＋ ")}</p></div></div><p class="interest-result-intro">三个字母来自你选择小岛的顺序；下方数值来自刚刚的 9 个回答。它们记录此刻的兴趣，不限定你未来的可能。</p>${window.CareerExplorer.render(state.selected, profiles)}<div class="interest-profile-list">${profiles.map((p, i) => `<article class="interest-profile" style="--island-color:${p.color};--island-soft:${p.soft}"><div class="interest-profile-title"><span>${p.id}</span><div><small>第 ${i + 1} 志愿 · ${p.type}</small><h3>${p.name}</h3></div><b>${p.mean.toFixed(1)}<small>喜欢程度 / 4</small></b></div><p>${p.mean >= 3 ? "在本次回答中，你对这个方向的活动比较感兴趣。" : p.mean >= 2 ? "在本次回答中，你对这个方向有些好奇，也有还想了解的部分。" : "这个岛吸引了你，但题目中的活动还不太合你的心意。可以换个玩法再看看。"}</p><p>${p.meaning}</p><details><summary>看看这三题的回答</summary><ol>${p.questions.map((q, j) => `<li>${esc(state.questions.find((row) => row.code === `${p.id}-${j}`)?.title || q)}<b>${optionLabel(`${p.id}-${j}`, p.scores[j])} · ${p.scores[j]} / 4</b></li>`).join("")}</ol></details><div class="interest-next-step"><b>和 DingDong 试一次</b><p>${p.try}</p><button class="text-button" data-interest-action="task" data-id="${p.id}">打开小行动 →</button></div><small class="interest-fields">可一起了解：${p.fields}</small></article>`).join("")}</div><div class="interest-result-boundary">每类数值是该方向三题的平均值（0–4），不表示能力分数；未选择的方向未测量。这个组合属于本次选岛与活动偏好体验，不是官方霍兰德测评结论。</div></div>`,
      `<button class="button ghost" data-interest-action="review">回看我的答案</button><button class="button ghost" data-interest-action="restart">重新探索</button><button class="button" data-interest-action="back">回到兴趣岛</button>`,
      "DINGDONG · MY INTEREST PASSPORT",
    );
  }
  function goToIslands() {
    if (location.hash !== "#explore") {
      location.hash = "explore";
      setTimeout(
        () =>
          document
            .querySelector("#interest-map")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    } else
      document
        .querySelector("#interest-map")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function restart() {
    if (!(await call("restart", "interest"))) return;
    state.index = 0;
    update();
    question();
  }
  async function handle(action, el) {
    if (["select", "remove", "earlier"].includes(action)) {
      await change(el.dataset.id, action);
      return;
    }
    if (action === "start") {
      await start();
      return;
    }
    if (action === "answer") {
      const q = questionList()[state.index],
        rating = Number(el.dataset.rating);
      if (!q || !validRating(rating) || state.completed) return;
      if (!(await call("answer", "interest", q.id, rating))) return;
      question();
      update();
      document
        .querySelector(`[data-interest-action=answer][data-rating="${rating}"]`)
        ?.focus();
      return;
    }
    if (action === "previous" && state.index > 0) {
      state.index--;
      question();
      document.querySelector("#interest-question-title")?.focus();
    }
    if (action === "next") {
      const q = questionList()[state.index];
      if (!q || !validRating(state.answers[q.id])) return;
      if (state.index === 8) {
        if (state.completed) {
          result();
          return;
        }
        if (!(await call("complete", "interest"))) return;
        update();
        if (state.completed) result();
      } else {
        state.index++;
        question();
        document.querySelector("#interest-question-title")?.focus();
      }
    }
    if (action === "review") {
      state.index = 0;
      question();
    }
    if (action === "restart") await restart();
    if (action === "back") {
      bridge.close?.();
      goToIslands();
    }
    if (action === "task") {
      const p = item(el.dataset.id);
      if (p) {
        bridge.close?.();
        await bridge.task?.(p.task, p.id);
      }
    }
  }
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-interest-action]");
    if (!el || el.disabled) return;
    const fn = () => handle(el.dataset.interestAction, el);
    if (bridge.run) bridge.run(fn, el);
    else fn().catch((error) => bridge.toast?.(error.message));
  });
  const exportData = () => JSON.parse(JSON.stringify(state));
  window.IslandExplorer = {
    render,
    bind(callbacks) {
      bridge = callbacks;
    },
    setState,
    start,
    restart,
    goToIslands,
    exportData,
    reset() {
      state = blank();
      update();
    },
  };
})();
