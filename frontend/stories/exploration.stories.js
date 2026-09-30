import "../riasec.js";
import "../career-data.js";
import "../career-explorer.js";
import "../island-explorer.js";
import "../talent-data.js";
import "../talent-explorer.js";
import "../fingerprint-guide.js";
import "../fingerprint.js";

export default {
  title: "家长端/探索模块",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "直接使用生产页面的探索模块。故事数据只供组件预览；实际页面从 CA 儿童档案读取答案与结果。",
      },
    },
  },
  decorators: [
    (story) =>
      `<main style="max-width:1100px;margin:24px auto;padding:16px">${story()}</main>`,
  ],
};
export const SixIslands = {
  name: "六岛与有序通行证",
  render() {
    window.IslandExplorer.setState({
      selected: ["R", "I", "A"],
      answers: {},
      index: 0,
    });
    return window.IslandExplorer.render();
  },
};
export const TalentIntroduction = {
  name: "八维介绍与开始卡",
  render() {
    window.TalentExplorer.reset();
    return window.TalentExplorer.render();
  },
};
export const TalentResult = {
  name: "八维结果与并列说明",
  render() {
    const answers = Object.fromEntries(
      window.TalentData.questions.map((q) => [q.id, 3]),
    );
    window.TalentExplorer.setState({
      answers,
      completed: true,
      index: 0,
      result: {
        dimensions: window.TalentData.dimensions.map((d) => ({
          id: d.id,
          score: 9,
        })),
      },
    });
    return window.TalentExplorer.render();
  },
};
export const FingerprintGuide = {
  name: "指纹示例与手动指南",
  render: () => window.FingerprintLab.render(),
};
