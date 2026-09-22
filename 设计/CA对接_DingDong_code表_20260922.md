# CA 对接：DingDong Code 表（对方微信回复，2026-09-22）

来源：DingDong 侧 2026-09-22 微信回复的三张 code 表，配合同日交付的两份 docx
（`材料/文档/DingDong_CA_API_Integration_Guide_v1.0.docx`、`DingDong_CA_Prototype_Demo_Logic_v1.0.docx`）。
本文是对接合同的取值口径记录，代码映射以本文为准。

## 1. 测评类型 / 学习风格 Code 表（CA → DingDong：POST /profile 用）

**测评类型（`interest_primary` / `interest_secondary` 取值域，也是 `persona_type` 的角色类型域）：**

| DingDong Code | 含义 | CA 侧用途 |
| --- | --- | --- |
| `art` | 艺术型 | CA 测评结果映射 |
| `science` | 科学型 | CA 测评结果映射 |
| `engineering` | 工程型 | CA 测评结果映射 |
| `philosophy` | 哲思型 | CA 测评结果映射 |
| `language` | 语言型 | CA 测评结果映射 |
| `social` | 社交型 | CA 测评结果映射 |

**学习风格（`learning_style` 取值域，三值）：**

| DingDong Code | 含义 | CA 侧用途 |
| --- | --- | --- |
| `cognitive` | 认知型学习风格 | DingDong 对话/教学策略 |
| `imitative` | 模仿型学习风格 | DingDong 对话/教学策略 |
| `open` | 开放型学习风格 | DingDong 对话/教学策略 |

> 口径注记（2026-09-22 实测）：
> - API 文档 6.2 示例里 `interest_secondary: "robotics"` **不在上表六值域内**；实测 POST /profile
>   提交 robotics 仍返回 201（mock 不校验），但正式合同以上表为准，我方映射实现不产出 robotics。
> - CA 测评八维分数 → 测评类型/学习风格的映射算法是 **CA 侧责任**（表内「CA 测评结果映射」），
>   对方只收 code。

## 2. Persona / 角色 Code 表（DingDong → CA：选完人设后 CA 收到的角色数据）

| DingDong Code | 字段 | 含义 | CA 侧用途 |
| --- | --- | --- | --- |
| `persona_id` | 角色唯一 ID | 当前绑定的人设 | CA 存储当前 DingDong 角色 |
| `variant_id` | 角色版本 ID | 同一类型下的具体角色版本 | 区分不同角色 |
| `character_name` | 角色名称 | 前端展示名称 | CA 页面展示 |
| `persona_type` | 角色类型 Code | 与测评类型对应 | 判断角色所属类型 |
| `match_score` | 匹配度 | 当前画像与角色匹配结果 | CA 展示角色匹配信息 |
| `bind_time` | 绑定时间 | 用户选择该角色的时间 | CA 记录角色变更 |

> 口径注记：`persona_type` 与上节测评类型六值对应（对方原文「与测评类型对应」）。

## 3. Companion / Growth Code 表（DingDong → CA：Persona + Companion + Growth 数据）

| DingDong Code | 类型 | 含义 | CA 侧用途 |
| --- | --- | --- | --- |
| `companion_value` | integer | 当前累计陪伴值 | CA 存库/展示 |
| `effective_turns` | integer | 有效互动次数 | 解释陪伴值来源 |
| `engagement_index` | number | 互动活跃指标 | 成长报告 |
| `growth_dimensions` | object | DingDong 计算的成长代理指标 | 成长曲线展示 |
| `linguistic` | number | 语言维度 | 成长代理指标 |
| `logical` | number | 逻辑维度 | 成长代理指标 |
| `musical` | number | 音乐维度 | 成长代理指标 |
| `spatial` | number | 空间维度 | 成长代理指标 |
| `bodily` | number | 身体运动维度 | 成长代理指标 |
| `intrapersonal` | number | 自我认知维度 | 成长代理指标 |
| `interpersonal` | number | 人际维度 | 成长代理指标 |
| `naturalistic` | number | 自然观察维度 | 成长代理指标 |
| `algorithm_version` | string | DingDong 算法版本 | 数据追踪 |

> 口径注记（2026-09-22 实测）：
> - `companion_value` 的计数单位对方未单列，但结合 `effective_turns` 字段与 Prototype 文档
>   「每有效对话 +1 点陪伴值」，按**累计有效对话次数**理解（推断口径，家长端量词用「次」）。
> - `growth_dimensions` 是 DingDong 成长代理指标，**不是 CA 原始八维测评分**，展示面必须带
>   「成长代理」标注（既有 T-034 口径不变）。
> - 待对方答复：profile 请求提交 int（如 72），对方返回字符串 `"72.00"`（文档写 0–100/null），
>   类型以哪个为准。我方解析器已按 `float(str)` 兼容。
