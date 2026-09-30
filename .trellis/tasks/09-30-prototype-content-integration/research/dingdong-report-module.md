# DingDong 同源报告组件（v0.3.22，本地）

本组只实现独立报告呈现、样式、纯测试和 Storybook，不改 `app.js` 或部署配置。新源文件 `frontend/dingdong-report.js`、`frontend/dingdong-report.css`；根任务负责运行资源清单，页面组负责真实 GET/刷新/授权/儿童上下文。

## 使用合同

- `renderDingDongReport(data, options)` 直接返回完整报告 HTML，拥有标题“DingDong 陪伴成长报告”。不绑定事件、不调用 API、不生成预测值。
- 操作：`dingdong-weekly-turns` / `data-value=3|7|14|21`，`dingdong-report-refresh`。选中状态以真实响应的 `weekly_turns` 为准。
- 读取原摘要 `persona_name/companion_value/effective_turns`；`assessment.baseline_scores`；`growth.current.dimensions`；`growth.curve[{day,companion_value,engagement_index,dimensions}]`；顶层 `weekly_turns`（兼容growth内同值）、`updated_at`。不回显 `sync_source` 技术码，不传递凭据。
- `normaliseDingDongReport(data)` 是白名单纯数据出口。数值必须number、finite；维度0–100，陪伴值/有效轮次非负且可超过100。零有效，非法留null，不将字符串、布尔值或缺失转换成0。
- 曲线按0/7/15/30/60/90/180时间点排列；未知日不显示，缺失或重复日保持空白。缺维度会中断SVG折线，不以连接空缺制造已提供的数据。180日参考仅取实际180日点，不使用90日或最后一行冒充。
- `options.status` 支持loading/error/empty；错误只呈现固定家长文字，供应商原message不进入HTML。正常数据的动态伙伴名转义。报告文字明确“模拟趋势参考”，不称正式测评或真实周期报告。

## 样式与组件预览

专属 `.dd-report-*` CSS 保留紫色视觉，不覆盖既有页面；按钮至少48px、间距12px，手机频率选项和图例两列，汇总/表格/页脚适配窄屏。SVG八条源数据曲线、图例、起点/目前/180日参考表均由同一生产helper生成。

新增 Storybook 6 个故事：完整、390px、空、错误、加载、缺点/缺维。Storybook示例快照仅作组件预览；生产函数不计算这些示例分数。

## 本轮证据

5项关键测试先失败后实现通过；其中补真实 `growth.current.dimensions` 结构时再次出现明确失败，再按合同修正。覆盖零/大于100陪伴值、全部非法值、顺序/断点/180日缺失、XSS/敏感字段白名单、空/错误/部分数据。

`npm --prefix frontend run test:unit` 本轮 **101/101通过**，其中本组新增5项，其余包含其他并行组的已有测试；证据 `deploy/evidence/v0.3.22/frontend-report-unit.log`。生产模块和Storybook语法检查、改动diff-check通过。真实 API/手机Chrome布局/Storybook最终构建由根任务及页面组继续验收；本组没有把纯测试等同于供应商真实闭环，没有发码、供应商写入或部署。
