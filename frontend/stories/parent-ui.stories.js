import {
  actions,
  button,
  emptyState,
  esc,
  pageHead,
  panel,
} from "../ui-components.js";

const frame = (story) =>
  `<main class="page" style="max-width:680px">${story()}</main>`;

export default {
  title: "家长端/基础构件",
  tags: ["autodocs"],
  decorators: [frame],
  parameters: {
    docs: {
      description: {
        component:
          "故事直接调用家长端正在使用的原生 HTML 构件，并加载 styles.css → playful.css → client.css。手机页面在 320、390、430 宽度下检查卡片间距、按钮换行和触控尺寸。",
      },
    },
  },
};

export const Buttons = {
  name: "按钮与操作组",
  render: () =>
    panel(
      "下一步",
      `<p>操作放在说明之后，按钮之间保持可点击的间距。</p>${actions(
        button("continue", "继续"),
        button("later", "稍后再说", "", true),
      )}`,
    ),
};

export const FormCard = {
  name: "表单与卡片",
  render: () =>
    panel(
      "儿童档案",
      `<p>确认资料后保存。</p><label class="field">姓名或称呼<input placeholder="怎么称呼孩子"></label>${actions(
        button("save", "保存档案"),
        button("cancel", "返回", "", true),
      )}`,
    ),
};

export const HeadingAndEmpty = {
  name: "页头与空态",
  render: () =>
    `${pageHead("测评与报告", "查看孩子的选择与成长记录。", "", "小朋友")}${emptyState(
      "还没有报告",
      "有新报告时，会显示在这里。",
      button("refresh", "刷新", "", true),
    )}`,
};

export const NarrowPhone = {
  name: "320px 手机间距",
  parameters: { viewport: { defaultViewport: "narrow" } },
  render: () =>
    `<div class="report-flow">${pageHead("测评与报告", "查看孩子的选择与成长记录。", "", "小朋友")}${panel(
      "探索偏好体验",
      `<p>从几个日常小情境开始，听听孩子此刻的想法。</p>${button("begin", "开始探索体验")}`,
    )}${panel(
      "初始测评",
      `<p>通过日常情境题了解孩子的近期状态。</p>${button("begin-assessment", "开始测评")}`,
    )}<h2 class="report-section-title">已生成报告</h2>${emptyState(
      "还没有报告",
      "有新报告时，会显示在这里。",
    )}</div>`,
};

export const LongText = {
  name: "长称呼与操作换行",
  render: () =>
    panel(
      "账户与关联",
      `<p><b>${esc("一位有很长称呼的小朋友")}</b></p><p>一台机器人只能服务一个孩子。</p>${actions(
        button("edit", "编辑档案", "", true),
        button("add", "添加儿童档案", "", true),
        button("bind", "绑定机器人"),
      )}`,
    ),
};
