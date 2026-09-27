# T-052B 紫色素材集成

## Goal

将 `upstream/main` 最新紫色 DingDong 视觉素材用于现有 CA 家长端页面，保持四个既有活动与业务流程。

## Confirmed facts

- upstream `3b8723e` 当前兴趣岛图片为 `assets/generated/island-{R,I,A,S,E,C}-v5.webp`；旧 `assets/dingdong/island-*.webp` 是历史素材。
- `robot-front.webp`、`robot-wave.webp` 和 `gift.webp` 为项目提供素材；`dingdong.svg`、`mark.svg` 与本地字节一致，没有升级。
- CA 当前是科学、故事、自然、创意四座岛，远端是另一产品演示的六类 RIASEC。

## Requirements

- 从远端选择性复制当前页面需要的新版 WebP，记录来源 commit/路径。
- 所有现有机器人插图改为紫色版本；品牌可用紫色机器人标识；四座活动岛改用语义最近的 V5 场景。
- 四岛名称、活动 ID、导航和 API 路由不改变；图片 alt 与语义一致。
- 静态服务正确返回 WebP MIME；桌面和移动端验证加载与布局。
- 前端设定调整按用户 2026-09-27 答复仅指页面视觉（配色与图片布局），不新增机器人 `language/speed/tone` 配置入口。

## Acceptance Criteria

- [ ] 首页、登录、活动、伙伴和探索地图的旧绿机器人被紫色角色替代；四岛及选中区缩略图展示新版图。
- [ ] 所引用 WebP 返回 200 和 `image/webp`，浏览器 `naturalWidth > 0`；桌面与 390px 移动视口可用。
- [ ] 不引入六岛测评、指纹材料或本地存储业务；现有 CA 流程回归通过。
- [ ] 记录四岛到上游场景的映射和素材来源。

## Proposed mapping for review

- 科学发现岛 → I（观测/科学）；故事表达岛 → S（分享/表达）；自然观察岛 → R（自然/动手）；创意想象岛 → A（艺术/创作）。这只是视觉场景映射，不把 CA 活动伪装为正式 RIASEC 测评。

## Out of Scope

- upstream 六岛选择、九题或八维测评流程，指纹图与指纹解释模块。
- 晴幂生产部署及远端仓库 PR/merge。
