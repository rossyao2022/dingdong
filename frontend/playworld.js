(() => {
  "use strict";
  let revealTimer = null;
  const arrow = '<span aria-hidden="true">→</span>';
  function render() {
    return (
      window.IslandExplorer.render() +
      talentSection() +
      `<section class="discovery-portals" aria-label="更多天赋探索入口"><div class="portal-grid portal-grid-two">

 <a class="discovery-portal fingerprint-portal" href="#fingerprint"><div class="portal-art"><img class="portal-fingerprint" src="assets/fingerprints/whorl.webp" alt="斗纹示意图" loading="lazy"><span class="portal-sticker">03 · 纹路与陪伴</span></div><div class="portal-copy"><h3>指纹小宇宙</h3><p>手动观察四种纹路，试试亲子小行动。</p><span class="portal-go">打开指纹探索 →</span></div></a>
 <button class="discovery-portal gift-portal" data-action="blindbox"><div class="portal-art"><img class="portal-supplied-art" src="assets/dingdong/gift.webp" alt="DingDong 和惊喜礼盒" loading="lazy"><span class="portal-sticker">04 · 今日小行动</span></div><div class="portal-copy"><h3>灵感惊喜盲盒</h3><p>随机选一个今天能做的小行动。</p><span class="portal-go">拆开看看 →</span></div></button>
 </div></section>`
    );
  }
  function talentSection() {
    return `<section class="talent-module" aria-label="八大天赋优势模块">${window.TalentExplorer.summary()}</section>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-module-scroll]");
    if (b)
      document.getElementById(b.dataset.moduleScroll)?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
  });
  function gift(large = true) {
    return `<div class="toy-gift ${large ? "large" : ""}"><span class="gift-glow"></span><span class="gift-box"><i></i><b></b></span><span class="gift-lid"><i></i><b></b><em></em></span><span class="gift-star star-a">✦</span><span class="gift-star star-b">✧</span><span class="gift-star star-c">✦</span></div>`;
  }
  function giftBody(mood) {
    return `<div class="dialog-body mystery-room"><div class="gift-stage">${gift()}<div class="gift-confetti" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};--r:${i * 30}deg"></i>`).join("")}</div></div><h3>今天的小行动</h3><p>给「${mood}」的你，<br>选一个现在能做的小行动。</p><small>免费灵感体验 · 可以按自己的节奏再试试</small></div>`;
  }
  function openGift(reveal) {
    const room = document.querySelector(".mystery-room");
    if (!room || room.classList.contains("opening")) return;
    room.classList.add("opening");
    const button = document.querySelector('[data-action="open-box"]');
    if (button) {
      button.disabled = true;
      button.textContent = "正在打开小惊喜…";
    }
    clearTimeout(revealTimer);
    revealTimer = setTimeout(
      () => {
        if (room.isConnected && document.querySelector("#dialog")?.open) {
          reveal();
          burst();
        }
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 1250,
    );
  }
  function burst() {
    const layer = document.createElement("div");
    layer.className = "celebration-particles";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = Array.from(
      { length: 24 },
      (_, i) =>
        `<i style="--i:${i};--x:${(i % 8) * 13 - 45}vw;--r:${i * 39}deg"></i>`,
    ).join("");
    document.body.append(layer);
    setTimeout(() => layer.remove(), 1800);
  }
  window.PlayWorld = {
    render,
    mount() {},
    bind(callbacks) {
      window.IslandExplorer.bind(callbacks);
      window.TalentExplorer.bind(callbacks);
    },
    giftBody,
    openGift,
    burst,
    goToIslands() {
      window.IslandExplorer.goToIslands();
    },
  };
})();
