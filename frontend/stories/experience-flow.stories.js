import {
  nextExperience,
  experienceRecords,
  renderExperienceTask,
  renderExperienceRecords,
} from "../experience-flow.js";
export default {
  title: "家长端/体验主线与记录",
  tags: ["autodocs"],
  decorators: [
    (story) => `<main class="page" style="max-width:680px">${story()}</main>`,
  ],
};
const child = "storybook-child";
const completed = {
  id: "interest-1",
  child_id: child,
  purpose: "interest",
  title: "六岛兴趣探索",
  status: "completed",
  completed_at: "2026-10-01T02:00:00Z",
};
export const FirstExplore = {
  name: "首次：从兴趣开始",
  render: () => renderExperienceTask(nextExperience([], [], child)),
};
export const ResumeExplore = {
  name: "继续未完成探索",
  render: () =>
    renderExperienceTask(
      nextExperience([{ ...completed, status: "draft" }], [], child),
    ),
};
export const ResumeActivity = {
  name: "先继续活动",
  render: () =>
    renderExperienceTask(
      nextExperience(
        [completed],
        [
          {
            id: "activity",
            child_id: child,
            status: "active",
            activity: { title: "和孩子一起寻找秋天的树叶" },
          },
        ],
        child,
      ),
    ),
};
export const ChooseAction = {
  name: "探索后做个小行动",
  render: () => renderExperienceTask(nextExperience([completed], [], child)),
};
export const CompletedCycle = {
  name: "完成后回看与再出发",
  render: () =>
    renderExperienceTask(
      nextExperience(
        [completed],
        [
          {
            id: "activity",
            child_id: child,
            status: "completed",
            finished_at: "2026-10-01T03:00:00Z",
            activity: { title: "一起找树叶" },
          },
        ],
        child,
      ),
    ),
};
export const DatedHistory = {
  name: "同名体验按时间区分",
  render: () =>
    `<section class="panel"><h2>体验记录</h2>${renderExperienceRecords(experienceRecords([completed, { ...completed, id: "interest-2", completed_at: "2026-09-30T04:30:00Z" }, { ...completed, id: "questionnaire", purpose: "assessment", title: "日常情境问卷", report_id: "report" }], [{ id: "report", kind: "initial" }], [{ id: "activity", child_id: child, status: "completed", finished_at: "2026-10-01T03:00:00Z", activity: { title: "一次可以回看的亲子小活动" } }], child))}</section>`,
};
export const EmptyHistory = {
  name: "尚无体验记录",
  render: () =>
    `<section class="panel"><h2>体验记录</h2>${renderExperienceRecords([])}</section>`,
};
export const NarrowPhone = {
  ...DatedHistory,
  name: "320px记录与按钮",
  parameters: { viewport: { defaultViewport: "narrow" } },
};
