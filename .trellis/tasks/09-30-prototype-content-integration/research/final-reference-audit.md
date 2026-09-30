# 最终原型完整性复核（2026-09-30）

## 复核基线与结论

本次独立读取参考 `upstream/main@3b8723e0089b411c19c41e13e4361cb90e6b7c71` 的 README、原始 app、各模块、CSS、assets、legacy 和 QA；读取 CA `main@2e4567bf35e46446b4b7b162bfe0bdce6467c854` 与当前工作区、批准计划及前端规范。未拿已有内容矩阵当作结论。

**四大探索模块的数据、全部原题、职业组合和四指南已经完整吸收；“原型所有按钮/流程完全一致、没有遗漏”仍不成立。** 本记录是在补齐下列遗漏之前形成的检查快照；补齐须追加实际复测，不把计划修复写成完成。

## 独立比对证据

- 在隔离 Node VM 分别执行上游与当前 `riasec.js` / `talent-data.js` / `career-data.js` / `fingerprint-guide.js`，对 `RIASEC`、`TalentData`、`CareerData`、`FingerprintGuide.guides` 做完整结构化比较：**四者均相同**。这覆盖文字、题目、维度、计分选项、20组合职业/三步项目及四指南全部细项，非只核对数量。
- 上游 assets 树的**全部27文件**逐一比较 SHA256，与 `frontend/assets` 对应文件**全相同**：6最新生成岛图、6早期供应岛图、4纹路、机器人/礼盒/门户等；没有拿旧四岛素材冒充新增 E/C。
- `styles.css`、`playful.css` 与上游逐字节相同；将 CSS 经 PostCSS 解析并归一化排版、数字、引号之后，`fingerprint.css`、`talents.css` 规则和声明全部相同。`exploration-v4.css`、`readability.css` 有明确适配：去掉影响旧 CA 页面/按钮的全局覆盖，增加320/390/430流式机器人、字号/触控修复。这属于批准的移动布局调整，不能声称像素逐点相同。
- 原型四情境 `app.js` 的题目/四选项，在 `backend/dingdong_ca/testsupport/question_content.py::EXPLORATION` 全部存在；现通过 CA 已发布探索题库/`#reports` 开始，非24题八维替换掉了四题。
- 本机隔离真实服务 `127.0.0.1:4175` 对七个旧 HTML 地址逐一 GET：**全部404**（不是仅凭文件名推测）。
- 本复核未发送短信、读取凭据、改生产数据或调用供应商写接口。

## 四大模块原控件库存

| 原模块/控件 | CA 对应实现/证据 | 状态 |
| --- | --- | --- |
| 首页01兴趣岛、02八维、03指纹、04盲盒/滚到兴趣图 | `playworld.render`、`IslandExplorer.render` 原层级/四入口保留，module-scroll保留 | 完整 |
| 六岛 R/I/A/S/E/C 及图/文字 | RIASEC全对象相同；6生成图SHA相同 | 完整 |
| select/remove/earlier，最多3、前三顺序 | IslandExplorer三动作保留，合法选择校验，根桥接selection | 完整 |
| start，9题answer/previous/next，0–4 | IslandExplorer对应动作；根ensure/answer/complete真实API | 完整，保存改为按儿童 |
| interest review/back，三类均值/回答详情/说明 | 完成结果来自服务端；回看只读、返回岛图 | 完整，旧结果保护有意不同 |
| 职业解释/每份职业链接/低兴趣说明/首选差异/一周3步 | CareerData结构相同，CareerExplorer保留 | 完整 |
| interest task，六个行动入口 | paper-bridge/leaf-look/cloud-story/team-help/family-show/sort-desk已映射真实发布活动 | 可执行；具体活动标题/材料/部分步骤为CA适配版，不是上游逐字照搬 |
| talent start、24题answer/previous/next | 原24题/8维/1–5全对象相同；根真实会话桥接 | 完整 |
| talent雷达/八维解释/Top3含并列/全部同分/职业/每周行动 | 原维度对象相同，服务端分数；完整卡片/雷达/同分逻辑 | 完整 |
| talent review直接修改已完成答案重新计分 | CA完成结果只读，新增restart另建会话，旧版本/结果保留 | **批准的历史保护适配**，不等同原操作 |
| talent报告export、账号/成长记录export | CA没有下载按钮和导出动作/API；不是被历史回看或资料删除申请替代 | **实际遗漏** |
| fingerprint sample/scan/upload/camera/capture/reset | 八种原data-fp动作全部保留；取消/错误/失效释放相机及Blob | 完整 |
| fingerprint手选四形态/guide内切换/阅读锚点 | 纹路按钮、指南切换器、read-guide保留 | 完整 |
| W/L/R/X完整观察、学习、沟通、亲子3步、正反对话例子 | FingerprintGuide.guides全结构相同；额外4个实际活动按钮 | 完整且新增真实入口 |
| guide.next进入伙伴并选择相应引导方式 | CA链接仍进入#companion，但改成“选择孩子喜欢的陪伴方式”；CA四style不是原四style | **链接有，原四方式没有完整对应** |
| blindbox/open-box与动效/减弱动画 | 盲盒及openGift存在，接真实已发布活动 | 完整，随机来源为真实活动目录 |

## 原 app 操作库存与 CA 对应

此表覆盖上游 app 39种case动作；实际按钮可能由模板条件生成，不能只搜索 `data-action` 字符串判有无。

| 上游动作/功能 | CA 当前对照 | 结论 |
| --- | --- | --- |
| close，弹窗/Escape/关闭 | 原生dialog，closeDialog，上下文/焦点/语音清理 | 对应 |
| mood，rotate-task，task-detail，islands，island | 心情filters、surprise、activityDetail、六岛结果任务桥接 | 对应，列表呈现是CA现有页面 |
| start-task，web-task | 活动方式select有web/guide，POST记录mode | 两模式可选择，但当前stepView没有按mode改变引导展示 |
| style，speak-intro | #companion的CA四style和greeting朗读 | **原cognitive/imitative/reverse/open中后三种及选中方式的朗读未完整吸收**；不能覆盖CA已用枚举，宜加参考引导层 |
| guide按四style生成不同话术 | CAstepView固定读step.guide_text，记录style/mode不改变当前话术 | **实际引导效果遗漏** |
| next-step，prev-step | next-step真实PATCH；没有上一步按钮/handler（API合法step_index本来允许回退） | **上一步遗漏** |
| finish-task，feedback | 完成POST+三种感受select+160字记录，成长旅程显示 | 对应，控件形态不同 |
| skip-dialog，resume-guide，skip-task | CA直接skip记录跳过、成长旅程可继续活跃记录 | 核心休息/跳过存在；原确认弹窗形式不同 |
| resume-existing，replace-task | CA已有活动409保护，不自动覆盖；成长旅程resume-activity | 活跃记录安全性保留，原“继续/换新”的直接弹窗UX不同 |
| filter（全部/完成/跳过） | journey列表无筛选；GETactivity-records已有status参数 | **筛选控件遗漏** |
| period（15d/30d），talents | 实际growth-period15/30、首页八维与历史回看 | 对应，CA真实观察/报告结构不同 |
| device | CA NFC登录/授权/绑定/解绑/换机/固定演示号与实际聚合回读 | 批准的增强，不导入“设备未接入”静态占位 |
| profile | 真实儿童档案建立/编辑/冲突保护/多儿童切换 | 批准的增强，不恢复全浏览器昵称档案 |
| assessment/answer/assessment-prev/assessment-next/assessment-restart/to-companion | 原4题原文在CA探索题库，可从#reports作答；#companion缺4题直达，完成结果缺原“选择伙伴引导”/对应重做操作 | **题目未丢，原入口及结果动作未完整对应** |
| export | 上游profile/preferences/exploration/islandExploration/talentExploration/records统一JSON；CA无下载操作 | **实际遗漏**；不能宣称申请帮助相当于导出 |
| consent | CA真实授权说明/授予/撤回及绑定权限 | 批准的增强，不能照搬原浏览器布尔开关 |
| reset-dialog/reset | CA真实儿童数据删除申请/运营办理；不会即时删除家庭历史 | **有意适配**。原即时清空的是无真实账户的浏览器演示；不能为外观相同破坏CA家庭历史 |
| notifications | 上游只是“没有赶不上进度/继续活动”的占位提醒弹窗；CA真实复测/提醒在报告页面 | 占位壳/入口不一致，实际提醒已有CA来源 |
| parent-tips | #services有三段泛建议，缺原复盘3问弹窗（最喜欢哪步/意外发现/下次想试） | **原具体内容/操作遗漏** |

## 其他页面、导航与旧链接

- CA保留真实登录、退出、验证码冷却、儿童、NFC、旧22题Worker报告、运营后台；这些必须优先，不为了复刻静态原型替换为浏览器假档案或占位机器人数据。
- 原移动底栏包含“伙伴”，CA底栏是天赋探索/今日陪伴/成长旅程/测评与报告/账户与关联；伙伴从账户/指南可访问。此为CA已做导航布局，不应宣称各页布局完全一样。
- 原家长支持还含 Career Academy 外链 `https://happykua.com/CareerAcademy.html`、报告直达；CA当前该页没有这两个对应入口。应补原内容/入口并保留真实账户服务。
- 七个旧链接映射是明确功能，而不是七个独立页面：daily→home；test/result→talents；thumb→fingerprint；island/blindbox→explore；report→reports。当前都404；应安全重定向，不信任旧URL里评分/身份参数。`legacy.js` 上游仅做上述映射。
- 两份生产PDF及真实公网验收应在新增控件补齐后更新对应截图/步骤，不能用既有“核心模块通过”证明新增遗漏已修。

## 给父任务的修复指示

1. 保留CA现有styles/历史数据/后台枚举；补原四题直达、结果伙伴动作、原四种网页引导与可观察话术效果，不把这些自动当DingDong正式设置。
2. 补真实家庭授权范围内导出：答案/发布版本/服务端结果/活动记录；不含JWT/刷新Cookie、手机号验证码、NFC明文、指纹图片。导出功能不应成为清空真实账户的前提。
3. 复用现有API补活动上一步、旅程状态筛选；补家长复盘3问/CA链接。
4. 补7个旧地址映射及静态白名单/容器清单；验证旧score query不会生成假结果。
5. 补最小真实浏览器回归及本地单测，并追加本审计的关闭证据。完成之前只能说“四模块核心内容已经对齐”，不能说“原型所有内容/流程完美匹配”。


## 本地修复核销复核（2026-09-30，v0.3.21 工作区；尚未发布）

本节保留前文 `2e4567b` 审计快照，不将当时遗漏改写为已经存在。当前复核只列本轮实际证据。

| 原遗漏/边界 | 当前实现与验证 | 核销状态 |
| --- | --- | --- |
| 原四种网页引导标签/问候语/实际话术 | `guide-preference.js` 的 cognitive/imitative/reverse/open 标签、描述、问候与原 `upstream/main@3b8723e:app.js` 四套话术逐项核对；5项新纯单测覆盖四首步/末步、web替代、历史空值/未知方式与第4步回退。`app.js` 显示采用 `esc(guideText(record))`，朗读采用同一 helper。 | 纯模块与接线核销；完整保存/刷新/活动浏览器证据由根交互验收记录 |
| 不能破坏旧CA style/机器人设置 | ChildCompanionPreference 与 ActivityRecord.guide_mode 独立；输入限制原4键。新活动仍提交合法CAstyle并另传guide_mode；进度PATCH仅revision/step_index，偏好改变不改既有活动；历史blank保持cognitive当前步骤话术，没有从style硬映射。未新增机器人configure请求。 | 静态合同与纯回退已核对，数据库/API证据由后端组记录 |
| 四情境与结果动作 | `#companion`直达原4题，后端优先原默认code；`guidance_summary`仅完成的exploration/code=exploration/Q01..Q04/ABCD完整结构生成计数，其他问卷返回null；结果出现“选择伙伴引导”及新答卷重做。 | 代码接线已补，真实作答/不可变历史/刷新待根浏览器核销 |
| 真实导出与跨儿童 | `/children/{id}/export`只筛当前child的探索三purpose、活动和网页偏好；白名单无手机号、认证、NFC、指纹或正式算法图像。前端回包校验child与身份/儿童/route/epoch后才下载，切换/退出清偏好和Blob。八维结果已补共用export-child按钮。 | 静态边界已核对，导出内容/换儿童真实验证由后端与浏览器组核销 |
| 七旧页面404 | `daily→home; test/result→talents; thumb→fingerprint; island/blindbox→explore; report→reports`：七HTML加载固定 `legacy.js`，仅同源已知文件映射，完全舍弃query/hash；referrer=no-referrer，避免秘密参数外传。2项新unit含临时真实HTTP服务；独立Chrome1项覆盖七URL自动跳转、无身份/NFC参数和秘密referrer。 | 本地已核销，无SMS/业务写入 |
| 镜像遗漏旧入口 | `.dockerignore`七HTML放行，Dockerfile.web、from-v0319、from-v0320明确COPY两个新模块及七HTML；nginx现有try_files可直接服务。2项deploy检查通过。 | 构建配置核销，未远端部署 |
| 原四组内容/素材完整性 | 本轮重新对比原源码：RIASEC/TalentData/CareerData/FingerprintGuide.guides深结构相等；27个上游assets逐一SHA256与当前资源相等。 | 保持完整，不以更晚提交替换CA功能 |

本组最新检查：前端全套 **94/94 unit**（含本组新增7）；旧链接独立Chrome **1/1**（覆盖七URL）；发布兼容 **2/2**。证据：`deploy/evidence/v0.3.21/guide-legacy-unit.log`、`legacy-browser.log`、`legacy-deploy-resources.log`、`reference-content.json`、`reference-assets.json`。新增Storybook网页引导四故事直接复用生产helper，最终构建由根任务记录。

尚不能声称“全部完美匹配”：真实交互组仍需关闭原四题、导出、活动上一步/筛选等浏览器核销；运营复制/全库预览/资料删除409由后端验收；新增手册截图/PDF、远端发布及原手机/NFC彩排状态由根任务分别记录。既有CA真实账户、独立Worker、不可变历史、指纹仅临时本地和真实删除流程仍是经批准的适配，不能回退成上游浏览器假档案。


### 根集成核销追加

上述当时待浏览器项现已由真实本地API/数据库关闭：新增3项、既有6模块+2历史、旧登录/冷却/22题独立Worker/首页4项、NFC刷新1项，共16项不同业务Chrome用例全部通过。独立旧链接Chrome1项覆盖7入口。后端421、前端94、部署12与Storybook构建通过；运营实际18题预览显示、已有CA删除409/申请open/儿童active/账号bound均保留已取证。详见 `deploy/PROTOTYPE_REPAIR_20260930_V0321.md` 及该版证据目录。

远端发布、原手机/原NFC/相机彩排、正式供应商接入及有关联CA资料彻底去标识仍保留独立边界，不能据本地核销称“全站完美匹配”。
