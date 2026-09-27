# T-052B 素材择取与验收

## 来源与合并边界

- 2026-09-27 重新 fetch：`upstream/main@3b8723e`，与 CA 仓库无共同 Git 历史；没有整分支合并。
- 机器人两图来自 upstream 的 `assets/dingdong/`，其 `ASSET_SOURCES.md` 记录为项目提供素材；岛图来自 upstream 当前 V5 的 `assets/generated/`，旧 `assets/dingdong/island-*.webp` 为历史素材。
- 复制的文件与 upstream 对应 Git blob 哈希逐一一致。沿用 CA 的四活动 ID、导航和后端 API，未引入六岛/指纹业务。

| CA 页面资源 | upstream 来源 | 用途 |
| --- | --- | --- |
| `frontend/assets/dingdong/robot-front.webp` | `assets/dingdong/robot-front.webp` | 品牌、登录、伙伴、空态 |
| `frontend/assets/dingdong/robot-wave.webp` | `assets/dingdong/robot-wave.webp` | 探索地图、今日陪伴、活动步骤 |
| `frontend/assets/islands/science.webp` | `assets/generated/island-I-v5.webp` | 科学发现岛 |
| `frontend/assets/islands/story.webp` | `assets/generated/island-S-v5.webp` | 故事表达岛 |
| `frontend/assets/islands/nature.webp` | `assets/generated/island-R-v5.webp` | 自然观察岛 |
| `frontend/assets/islands/imagination.webp` | `assets/generated/island-A-v5.webp` | 创意想象岛 |

## 本地视觉检查

- Chrome 桌面与 390×844 移动视口：探索地图、今日陪伴活动卡片、登录和品牌的紫色素材可见；页面无横向溢出，开发者控制台无错误。
- 页面引用的六个新 WebP 均为 `200 image/webp`，浏览器图片 `complete && naturalWidth > 0`。
- 全部 64 项 Chrome 用例分段覆盖：61 通过、3 项历史批次验收按配置跳过；运营题库延时跳转、异步任务队列和共享库短信限流问题已定位并复测通过。
- 用户确认“前端设定调整”指页面配色与图片布局；本轮未新增机器人语言/语速/语气设置入口。

## 部署验证

`dingdong-demo` 已升级 v0.3.9；公网 `/dingdong/version.txt` 返回 0.3.9，六张 WebP 均 200 image/webp。Chrome 公网页面品牌图片加载完成，桌面和 390px 断点无横向溢出、无控制台 error。发布包 SHA 与回退方式见 `deploy/TEST_RELEASE_20260927_V039.md`。
