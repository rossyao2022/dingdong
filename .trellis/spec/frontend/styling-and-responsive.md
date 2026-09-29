# 样式与响应式

## 三层 CSS，各管一段

`index.html` 按顺序引入三份样式：`styles.css` → `playful.css` → `client.css`。

| 文件 | 来源 | 能不能改 |
| --- | --- | --- |
| `styles.css` | 参考仓库 `参考代码/dingdong/styles.css`（当前逐字节相同） | **不要改**。保留参考视觉是用户明确约束（`AGENTS.md`、`PROJECT_MEMORY.md`） |
| `playful.css` | 参考仓库 `参考代码/dingdong/playful.css`（当前逐字节相同） | **不要改** |
| `client.css` | 本仓库新增（如 `.account-row`、`.conflict-diff`、`.inline-code`、`.tag.warn`、登录页、面板等） | 新增与覆盖都写这里 |

新增样式一律追加到 `client.css`，靠引入顺序覆盖前两份。要动参考样式，先确认这是不是“保留参考视觉”这条约束允许的改动。

`client.css` 顶部有 `:root` 令牌（`--ink` / `--muted` / `--accent` / `--line`）；运营后台那套 `--tblr-*` 令牌体系只属于 `/ops/`，家长端不用。

## 断点与视口

- 参考样式的断点（两份文件合起来）：1500 / 1200 / 1050 / 1000 / 760 / 440，写法是 `@media (max-width: …)` 的压缩单行规则（`styles.css` 与 `playful.css`）。
- 本仓库新增样式用的断点只有两个：`@media (max-width: 1100px)` 与 `@media (max-width: 760px)`（`client.css`）。**新增的覆盖规则优先沿用这两个**，避免出现第四套断点。
- 760px 以下进入移动形态：侧栏 `display:none`，改用 `#mobile-nav` 底部导航（`index.html` 里是独立 `<nav>`，`header()` 只给它渲染 5 个入口：explore / home / journey / reports / settings）。
- 验收视口约定：桌面（Playwright `devices["Desktop Chrome"]`）加 **390×844** 窄屏。`playwright.public.config.js` 就是 `desktop` + `mobile`（390×844）两个 project；`tests/ca-account.spec.js`、`tests/flows.spec.js` 用 `page.setViewportSize({ width: 390, height: 844 })`。
- v0.3.16 的 `tests/mobile-layout.spec.js` 另覆盖 320×700、390×844、430×932，以及 768/1280 抽查。320px 要检查底部五项导航不折行、顶栏不被挤成两行、验证码与日期表单单列、相邻卡片至少留 16px。
- 注意：390×844 是**视口模拟**，不等于真机验收（`PROJECT_MEMORY.md` 反复注明“未做真实手机硬件验收”）。不要把它写成手机实测。

## 横向溢出：有硬指标

长标识串（29 位 `ca_…` 账户号、UUID、时间戳）最容易把卡片撑出横向滚动条。既有做法：

- `.inline-code`、`.account-body .note` 用 `overflow-wrap: anywhere`（`client.css`），强制定长串折行。
- 用例的判定方式：`document.documentElement.scrollWidth - window.innerWidth <= 1`（`tests/ca-account.spec.js` 的“窄屏下账户号不撑破页面”）、`document.documentElement.scrollWidth <= innerWidth`（`tests/flows.spec.js` 的移动端用例）。
- 新增会展示长串或宽表格的区块时，自己加一次这个断言到对应用例里，别只靠肉眼看截图。
- 运营后台的逐页体检用同一类指标（`frontend/tools/ops-page-audit.mjs` 的“横向溢出”列）。

## 动效与可访问性偏好

- `prefers-reduced-motion: reduce` 在三份样式里都有关闭动画的规则（`playful.css` 还额外隐藏 `.celebration-particles`，`client.css` 另外把 `scroll-behavior` 关掉）。
- JS 侧也要尊重：`playworld.js` 的 `openGift()` 在 `matchMedia("(prefers-reduced-motion: reduce)").matches` 时把揭晓延时从 1250ms 压到 80ms。
- 焦点样式统一在 `client.css` 的 `:focus-visible`（`button` / `a` / `input` / `select` / `textarea`），不要在行内样式里另写。
- `button:disabled` 有统一的 `opacity` 与 `cursor` 规则；`busy` 期间由 `act()` 负责禁用，样式不用额外处理。

## 资源

- 图片全部本地：`assets/mark.svg`、`assets/dingdong.svg`、`assets/islands/<island>.svg`、`assets/sample-1..5.png`。**不引 CDN、不引外部字体**（生产环境同样由后端容器托管这几份文件）。
- 新增图片/图标要符合 `server.cjs` 的静态白名单正则（小写字母、数字、`_`、`-`，扩展名 `svg`/`png`），见 `directory-structure.md`。
- Storybook 开发预览直接引入这三层 CSS 和 `ui-components.js`；`stories/` 不进入生产镜像。样式修正只改 `client.css`，故事要展示生产正在使用的 HTML 函数。
- 图片一律写 `alt`：装饰性图片用 `alt=""`，语义图片写清楚（如 `alt="DingDong 成长伙伴"`、`alt="科学发现岛的浮空小世界"`）。
- 内联 SVG 用 `aria-hidden="true"`（`playworld.js` 里的 `arrow` / `spark` / `fp`）或 `role="img"` + 标题，不要留无标签的图形。
