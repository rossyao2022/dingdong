/* Fingerprint observation is a local visual activity, not an ability assessment. */
(() => {
  'use strict';
  const patterns = [
    { id: 'whorl', name: '斗纹', nickname: '小小漩涡', detail: '观察中间：纹路会不会像小漩涡一样，围着中心转圈？', color: 'mint' },
    { id: 'loop', name: '正箕纹', nickname: '转弯的小河', detail: '像一条转弯的小河。对照手指方向，看纹路的开口朝向哪一侧。', color: 'peach' },
    { id: 'arch', name: '弧纹', nickname: '弯弯小山丘', detail: '像一座小山丘：纹路从一边升起，再向另一边轻轻落下。', color: 'lemon' },
    { id: 'reverse', name: '反箕纹', nickname: '镜子里的小河', detail: '与另一种箕纹像镜中伙伴。辨别时要结合左右手和手指方向。', color: 'sky' },
  ];
  let root = null;
  let stream = null;
  let objectUrl = null;
  let timer = null;
  let generation = 0;
  let mode = 'empty';
  let selected = null;
  let sourceName = '';

  function fingerprint(id = 'whorl', extra = '') {
    const paths = id === 'arch' ? [
      'M16 85 Q60 12 104 85', 'M17 96 Q60 31 103 96', 'M15 74 Q60 -1 105 74',
      'M22 106 Q60 49 98 106', 'M26 61 Q60 9 94 61', 'M32 115 Q60 68 88 115',
      'M32 47 Q60 10 88 47', 'M44 119 Q60 90 76 119',
    ] : id === 'loop' || id === 'reverse' ? [
      'M24 110 C-3 35 33 8 66 20 C111 36 105 94 79 113',
      'M32 115 C7 47 37 19 63 29 C98 42 98 91 73 111',
      'M41 115 C18 54 42 29 61 39 C86 51 85 83 69 98 C55 113 34 99 41 77',
      'M51 114 C28 81 37 46 58 48 C79 53 76 78 64 88 C54 96 45 90 49 75',
      'M58 78 C51 62 68 61 64 73', 'M91 115 C120 58 94 10 60 10',
      'M16 93 C-4 40 15 12 39 9',
    ] : [
      'M22 100 C-2 49 22 9 59 10 C103 11 123 66 95 111',
      'M32 111 C7 69 17 22 55 21 C95 18 112 63 88 105',
      'M43 117 C17 91 20 36 55 32 C89 26 103 65 80 97',
      'M55 119 C26 101 28 54 49 45 C76 30 97 63 74 87 C54 109 31 90 42 64',
      'M64 112 C88 105 102 88 106 73',
      'M51 82 C40 72 49 51 63 54 C83 59 72 85 60 83 C49 80 52 66 61 65',
      'M19 118 L11 104',
    ];
    return `<svg class="fp-print ${extra}" viewBox="0 0 120 130" aria-hidden="true" fill="none"><g ${id === 'reverse' ? 'transform="translate(120 0) scale(-1 1)"' : ''} stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
  }

  function render() {
    return `<div class="fp-page" id="fingerprint-lab">
      <header class="fp-heading"><div><a class="fp-back" href="#explore">← 回到天赋探索</a><p class="fp-kicker">DINGDONG · LITTLE DISCOVERY LAB</p><h1>指尖里，藏着一个<span>小宇宙<span class="fp-title-star" aria-hidden="true">✦</span></span></h1><p class="fp-intro">伸出小手，和叮咚一起找找纹路里的漩涡、小河与山丘。</p></div><div class="fp-lab-sticker" aria-hidden="true"><span>好奇心</span><b>实验室</b><i>✧ EXPLORE ✧</i></div></header>
      <ol class="fp-journey" aria-label="探索步骤"><li><b>01</b><span>准备一张指纹</span><i>✧</i></li><li><b>02</b><span>用眼睛找一找</span><i>✧</i></li><li><b>03</b><span>发现独特的你</span><i>★</i></li></ol>
      <div class="fp-layout">
        <section class="fp-scanner-card" aria-labelledby="fp-scanner-heading">
          <div class="fp-card-heading"><span class="fp-number">01</span><div><h2 id="fp-scanner-heading">小手准备好了吗？</h2><p>先用示例玩一玩，也可以观察自己的纹路</p></div><span class="fp-live-dot" aria-hidden="true"></span></div>
          <div class="fp-scanner-shell"><div class="fp-scanner-top"><span><i></i>叮咚的观察窗</span><span>✦ TOUCH THE WONDER</span></div><div class="fp-viewfinder" id="fp-viewfinder"><div id="fp-stage" class="fp-stage">${emptyStage()}</div><span class="fp-corner fp-corner-tl"></span><span class="fp-corner fp-corner-tr"></span><span class="fp-corner fp-corner-bl"></span><span class="fp-corner fp-corner-br"></span><div class="fp-scan-line" aria-hidden="true"></div></div><div class="fp-scanner-bottom"><span class="fp-hint-led"></span><span id="fp-frame-caption">每一根手指，都是一张独特的地图</span><span aria-hidden="true">✳</span></div></div>
          <div class="fp-status" id="fp-status" role="status" aria-live="polite">还没有准备图片？点击下方按钮，和示例纹路打个招呼。</div>
          <div class="fp-main-actions"><button class="button fp-primary" data-fp-action="sample">✦ 用示例纹路体验</button><button class="button fp-primary" data-fp-action="scan" id="fp-scan-button" hidden>开始观察动画</button><button class="button fp-primary" data-fp-action="capture" id="fp-capture-button" hidden>◎ 拍下这张指纹</button></div>
          <div class="fp-secondary-actions"><button class="button fp-secondary" data-fp-action="upload"><span aria-hidden="true">▧</span> 选择指纹图片</button><button class="button fp-secondary" data-fp-action="camera"><span aria-hidden="true">◎</span> 打开相机</button><button class="fp-reset" data-fp-action="reset">重新开始 ↺</button></div>
          <input id="fp-file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择指纹图片">
          <p class="fp-local-note"><span aria-hidden="true">⌂</span> 照片仅在此页面临时预览，不会上传或保存。支持 JPG / PNG / WebP，最大 10 MB。</p>
        </section>
        <section class="fp-comparison" aria-labelledby="fp-comparison-heading"><div class="fp-compare-heading"><span class="fp-number">02</span><div><h2 id="fp-comparison-heading">它更像哪一种？</h2><p>仔细看一看，亲手选出你观察到的纹路。</p></div><span class="fp-doodle" aria-hidden="true">↙</span></div><div class="fp-pattern-grid">${patterns.map(p => `<button class="fp-pattern fp-${p.color}" data-fp-action="pattern" data-fp-pattern="${p.id}" aria-pressed="false"><span class="fp-check" aria-hidden="true">✓</span><span class="fp-pattern-art">${fingerprint(p.id)}</span><span class="fp-pattern-name">${p.name}</span><span class="fp-pattern-nickname">${p.nickname}</span><span class="fp-pattern-select">选这一种 <span aria-hidden="true">↗</span></span></button>`).join('')}</div><p class="fp-diagram-note">以上是示意图。左右手、拍摄方向会影响箕纹的辨别；不确定也没关系，可以换个角度再观察。</p><div class="fp-observation" id="fp-observation" aria-live="polite"><span class="fp-observation-star" aria-hidden="true">✧</span><div><h3>没有标准答案，先发现一点不同</h3><p>看纹路的中心、走向和开口。找到一个小细节，就是今天的发现！</p></div></div></section>
      </div>
      <aside class="fp-robot-note"><img src="assets/dingdong.svg" alt="叮咚机器人"><div><span>叮咚想告诉你</span><h2>你有多少可能，<em>要一起探索才知道。</em></h2><p>纹路选择只用来观察指纹，不代表能力、性格或天赋。真正的发现，藏在你喜欢尝试的每件小事里。</p></div><a class="button fp-next" href="#explore">去解锁一个小挑战 <span aria-hidden="true">→</span></a><span class="fp-note-spark" aria-hidden="true">✦</span></aside>
    </div>`;
  }

  function emptyStage() {
    return `<div class="fp-empty"><span class="fp-orbit fp-orbit-one"></span><span class="fp-orbit fp-orbit-two"></span><div class="fp-print-bubble">${fingerprint()}</div><span class="fp-float fp-float-star">✦</span><span class="fp-float fp-float-dot">●</span><span class="fp-float fp-float-plus">＋</span><b>你好，独一无二的小指纹！</b><p>用好奇心，打开你的指尖地图</p></div>`;
  }

  function query(selector) { return root && root.querySelector(selector); }
  function status(message, error = false) {
    const target = query('#fp-status');
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('fp-status-error', error);
  }
  function setCaption(text) { const target = query('#fp-frame-caption'); if (target) target.textContent = text; }
  function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    const video = query('video');
    if (video) video.srcObject = null;
  }
  function release() {
    generation += 1;
    clearTimeout(timer);
    timer = null;
    stopCamera();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    query('#fp-viewfinder')?.classList.remove('fp-is-scanning', 'fp-is-observed');
  }
  function buttons(nextMode) {
    mode = nextMode;
    const scan = query('#fp-scan-button');
    const capture = query('#fp-capture-button');
    const sample = query('[data-fp-action="sample"]');
    if (!scan || !capture || !sample) return;
    sample.hidden = mode !== 'empty';
    scan.hidden = !['sample', 'image', 'scanning', 'observed'].includes(mode);
    scan.disabled = mode === 'scanning';
    scan.textContent = mode === 'scanning' ? '✧ 正在展开指尖地图…' : mode === 'observed' ? '再观察一次 ↺' : '✦ 开始观察动画';
    capture.hidden = mode !== 'camera';
    capture.disabled = false;
    const camera = query('[data-fp-action="camera"]');
    camera.disabled = mode === 'loading-camera';
    camera.textContent = mode === 'loading-camera' ? '正在打开相机…' : '◎ 打开相机';
  }

  function reset() {
    release();
    selected = null;
    sourceName = '';
    query('#fp-stage').innerHTML = emptyStage();
    query('#fp-file-input').value = '';
    query('.fp-pattern-grid').querySelectorAll('button').forEach(b => { b.classList.remove('fp-selected'); b.setAttribute('aria-pressed', 'false'); });
    query('#fp-observation').innerHTML = '<span class="fp-observation-star" aria-hidden="true">✧</span><div><h3>没有标准答案，先发现一点不同</h3><p>看纹路的中心、走向和开口。找到一个小细节，就是今天的发现！</p></div>';
    query('#fp-observation').classList.remove('fp-observation-selected');
    buttons('empty');
    setCaption('每一根手指，都是一张独特的地图');
    status('还没有准备图片？点击下方按钮，和示例纹路打个招呼。');
  }

  function scan() {
    if (!['sample', 'image', 'observed'].includes(mode)) return;
    clearTimeout(timer);
    buttons('scanning');
    query('#fp-viewfinder').classList.remove('fp-is-observed');
    query('#fp-viewfinder').classList.add('fp-is-scanning');
    status('叮咚正在展开观察画面。接下来请你亲自对照纹路卡片；这是演示动画，不进行 AI 识别。');
    setCaption('观察小任务：找到中心，再沿着纹路走一走');
    const ticket = generation;
    timer = setTimeout(() => {
      if (!root || ticket !== generation) return;
      query('#fp-viewfinder').classList.remove('fp-is-scanning');
      query('#fp-viewfinder').classList.add('fp-is-observed');
      buttons('observed');
      status('观察画面已准备好！请手动选择相似的纹路卡片，也可以直接用眼睛比较。');
      setCaption(`${sourceName} · 由你亲自观察与选择`);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 2400);
  }

  function sample() {
    release();
    sourceName = '示例纹路';
    query('#fp-stage').innerHTML = `<div class="fp-sample-image"><span class="fp-sample-tag">示例图 · 非真实指纹</span>${fingerprint('whorl')}<span class="fp-image-caption">这片小漩涡，你发现了吗？</span></div>`;
    buttons('sample');
    scan();
  }

  function showBlob(blob, name) {
    release();
    const ticket = generation;
    sourceName = name;
    const url = URL.createObjectURL(blob);
    objectUrl = url;
    const img = new Image();
    img.className = 'fp-user-image';
    img.alt = '待观察的指纹图片，仅在本页显示';
    status('正在准备图片…');
    buttons('loading-image');
    query('#fp-stage').replaceChildren(img);
    img.onload = () => {
      if (!root || ticket !== generation) return;
      buttons('image');
      setCaption(`${name} · 仅在此页面临时预览`);
      status('图片准备好了！可以播放观察动画，或直接与彩色纹路卡片比一比。');
    };
    img.onerror = () => {
      if (!root || ticket !== generation) return;
      reset();
      status('这张图片没有成功打开，请换一张 JPG、PNG 或 WebP 图片。', true);
    };
    img.src = url;
  }

  function upload(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reset();
      status('暂时只能打开 JPG、PNG 或 WebP 图片，请换一种格式。', true);
      return;
    }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      reset();
      status('请选一张非空、且不超过 10 MB 的图片。', true);
      return;
    }
    showBlob(file, '我的指纹图片');
  }

  async function camera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status('当前环境暂时无法使用相机。请在 HTTPS 或本机预览地址打开，或点击「选择指纹图片」。', true);
      return;
    }
    release();
    buttons('loading-camera');
    status('正在请求相机。请允许使用摄像头；也可以点击「重新开始」取消。');
    query('#fp-stage').innerHTML = '<div class="fp-camera-message"><span aria-hidden="true">◎</span><b>相机准备中</b><p>允许访问后，把指尖放进观察窗</p></div>';
    const ticket = generation;
    let acquired = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!root || ticket !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.className = 'fp-camera-video';
      video.setAttribute('aria-label', '指纹拍摄预览');
      query('#fp-stage').replaceChildren(video);
      video.srcObject = stream;
      await video.play();
      if (!root || ticket !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      buttons('camera');
      setCaption('相机已打开 · 拍照后会自动关闭相机');
      status('把指尖放在明亮处，保持一点距离，等待画面清晰后点击「拍下这张指纹」。');
    } catch (error) {
      if (!root || ticket !== generation) { acquired?.getTracks().forEach(track => track.stop()); return; }
      reset();
      const errors = { NotAllowedError: '相机权限没有开启。可以重新尝试，或选择一张指纹图片。', NotFoundError: '没有找到可用的摄像头。可以选择图片，或先用示例体验。', NotReadableError: '摄像头暂时无法使用，可能正被其他应用占用。可以选择图片继续。' };
      status(errors[error.name] || '这次没有成功打开相机。请再试一次，或使用示例纹路。', true);
    }
  }

  function capture() {
    const video = query('video');
    if (!video || !video.videoWidth || !video.videoHeight) { status('画面还在准备，请稍等片刻再拍照。', true); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) { status('当前浏览器无法处理照片，请改用「选择指纹图片」。', true); return; }
    context.drawImage(video, 0, 0);
    query('#fp-capture-button').disabled = true;
    const ticket = generation;
    status('正在准备刚刚拍下的照片…');
    canvas.toBlob(blob => {
      if (!root || ticket !== generation) return;
      if (!blob) { query('#fp-capture-button').disabled = false; status('照片没有成功生成，请再拍一次。', true); return; }
      showBlob(blob, '刚拍下的指纹');
    }, 'image/jpeg', 0.9);
  }

  function choosePattern(id) {
    const item = patterns.find(p => p.id === id);
    if (!item) return;
    selected = id;
    query('.fp-pattern-grid').querySelectorAll('button').forEach(button => {
      const active = button.dataset.fpPattern === selected;
      button.classList.toggle('fp-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    query('#fp-observation').classList.add('fp-observation-selected');
    query('#fp-observation').innerHTML = `<span class="fp-observation-star" aria-hidden="true">★</span><div><span class="fp-manual-label">我的手动观察</span><h3>我发现了「${item.nickname}」！</h3><p>${item.detail}</p><small>你选择了${item.name}，仅作纹路观察，不是能力或性格结论。</small></div>`;
  }

  function onClick(event) {
    const target = event.target.closest('[data-fp-action]');
    if (!target || !root?.contains(target)) return;
    const action = target.dataset.fpAction;
    if (action === 'sample') sample();
    else if (action === 'scan') scan();
    else if (action === 'upload') query('#fp-file-input').click();
    else if (action === 'camera') camera();
    else if (action === 'capture') capture();
    else if (action === 'reset') reset();
    else if (action === 'pattern') choosePattern(target.dataset.fpPattern);
  }
  function onChange(event) { if (event.target.id === 'fp-file-input') upload(event.target.files[0]); }
  function onPageHide() { if (root) reset(); }
  function mount() {
    cleanup();
    root = document.getElementById('fingerprint-lab');
    if (!root) return;
    mode = 'empty';
    selected = null;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    window.addEventListener('pagehide', onPageHide);
  }
  function cleanup() {
    release();
    if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
    window.removeEventListener('pagehide', onPageHide);
    root = null;
  }
  window.FingerprintLab = { render, mount, cleanup };
})();
