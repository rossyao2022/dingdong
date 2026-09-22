# DingDong · 天赋成长伙伴 V4

面向亲子互动的原生 HTML / CSS / JavaScript 网页演示。

在线体验：[happykua.com/dingdong/](https://happykua.com/dingdong/)

## 六岛兴趣探索

默认进入霍兰德 RIASEC 六岛：自然原始岛 R、深思冥想岛 I、美丽浪漫岛 A、温暖友善岛 S、显赫富庶岛 E、现代井然岛 C。

按志愿顺序选择三座岛，可取消与调整顺序，生成如 `RIA` 的自选组合。所选三个方向各有三道原创中文活动情境，共九题；使用 0–4 的喜欢程度选项。结果展示所有三个方向的解释、答题明细、平均喜欢程度和可执行的小行动。组合代码保持选岛顺序，不冒充由全六类量表计算的前三类型。答案可在当前浏览器续接、导出或清空。

六类框架参考 [O*NET® Interest Profiler 说明](https://www.onetcenter.org/IP.html)。站内九题为原创亲子场景，不是官方量表的翻译、缩写或正式心理测评；没有覆盖未选的三类。网页提供 [官方完整英文测评](https://onetinterestprofiler.org/p/questions/1) 链接。

## 指纹与机器人素材

指纹页使用提供的原始纹路示意图，支持示例观察、本地图片和主动相机拍照。用户手动选定相近纹路后，显示原资料对应的四组参考卡：斗纹 W 认知型、正箕纹 L 模仿型、反箕纹 R 逆思型、弧纹 X 开放型（原资料也标注 A/X）。每张卡分为观察角度、学习方式和沟通方式。

这些对应关系来自原资料，未经本产品的科学效度验证；不由指纹推断能力、性格或职业，也不自动设置机器人。内容整理为可选择的沟通建议。图片只在当前页面临时预览，不上传、不写入持久存储，重置或离开会释放照片与相机。相机需要 HTTPS 或 localhost 及浏览器授权。

页面采用提供的 DingDong 紫色机器人、场景和礼盒素材。当前尚未接入正式后端、正式测评题库或实体机器人；设备数据保持待接入状态。

## 本地运行

Node.js 18+，无需安装前端依赖或构建：

```sh
npm run dev
```

访问 `http://127.0.0.1:4173/dingdong/`。服务器兼容 `/TalentRadar/`，仅用于本机开发。

## 验证

```sh
npm run check
python -m pip install playwright
python -m playwright install chromium
python -X utf8 qa/verify.py
python -X utf8 qa/verify_media.py
python -X utf8 qa/verify_v4.py
```

测试需先运行本地服务。三个脚本支持环境变量 `DINGDONG_BASE` 覆盖默认地址；V4 脚本默认使用 `http://127.0.0.1:4184/dingdong/`，其他脚本默认使用 4173。媒体测试使用模拟摄像头，不会调用物理摄像头。

V4 覆盖 20 种三岛组合、顺序调整、三方向九题、逐题评分、断点恢复、四类指纹说明、六个结果行动入口、八页五种屏宽、存储错误和清空。媒体测试覆盖拍照与释放、图片格式和大小边界、拒绝相机权限、盲盒与减弱动画。测试输出不提交到仓库。

## 主要文件

- `riasec.js`：六类兴趣内容与原创题目。
- `island-explorer.js`：三志愿选择、题目、结果与本地数据。
- `playworld.js`、`exploration-v4.css`：探索入口及新版视觉。
- `fingerprint.js`、`fingerprint-guide.js`：本地媒体与四类参考卡。
- `app.js`：原有陪伴任务、档案和成长记录；含新增的合作与组织任务。
- `assets/dingdong/`、`assets/fingerprints/`：提供素材的网页优化版本。
- `CONTENT_NOTES.md`、`ASSET_SOURCES.md`：内容边界和素材来源。

发布时上传根目录浏览器 HTML / CSS / JS 与 `assets/`，不上传开发服务器、文档和 QA 目录。默认页采用 hash 路由，资源路径相对目录。`dingdong-demo-v2` 保存原有演示记录；`dingdong-islands-v4` 单独保存新版兴趣体验，账户清空与导出同时包含两者。指纹图片不保存在这两个键中。
