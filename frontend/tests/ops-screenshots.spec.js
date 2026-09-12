/**
 * 运营后台页面走查与截图留档（真实 Chrome，不拦截任何接口响应）。
 *
 * 与 ops-console.spec.js 的区别：那份验证"某个流程能不能走通"，
 * 这份只做两件事：
 *   1. 用管理员账号把每个页面都打开一遍，确认没有脚本异常、没有空白页；
 *   2. 把页面截图存到 docs/ops/，作为交付留档。
 *
 * 前置：后端运行在 http://127.0.0.1:8017，且数据库里已有可展示的记录。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shell } from "./support.js";

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "docs", "ops");

/** 找一个可展示的对象 id，找不到就返回空串，让用例跳过对应截图。 */
function pickId(model, extra = "") {
  return shell(
    `from django.apps import apps
row = apps.get_model("core", ${JSON.stringify(model)}).objects${extra}.order_by("created_at").first()
print(row.pk if row else "")`,
  )
    .trim()
    .split("\n")
    .pop()
    .trim();
}

function makeAdmin() {
  const username = `ops-shot-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  shell(
    `from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="走查管理员")
u.groups.set(Group.objects.filter(name="account_admin"))`,
  );
  return { username, password };
}

test.describe("运营后台页面走查", () => {
  test("全部页面可打开并留档截图", async ({ page }) => {
    const admin = makeAdmin();
    const familyId = pickId("Family", '.filter(status="active")');
    const childId = pickId("Child", '.filter(status="active")');
    const reportId = pickId("ReportVersion");
    const requestId = pickId("DataRequest");
    const versionId = pickId("QuestionnaireVersion");
    const activityId = pickId("ActivityContentVersion");
    const scriptErrors = [];
    page.on("pageerror", (error) => scriptErrors.push(error.message));

    mkdirSync(shots, { recursive: true });
    const captured = [];

    async function visit(name, path, expectText) {
      await page.goto(`${BACKEND}${path}`);
      await expect(page.locator("main.ops-main, .ops-login")).toBeVisible();
      await expect(page.getByText("服务器内部错误")).toHaveCount(0);
      if (expectText) await expect(page.getByText(expectText).first()).toBeVisible();
      await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
      captured.push(name);
    }

    try {
      await page.goto(`${BACKEND}/ops/login/`);
      await page.screenshot({ path: join(shots, "00-登录.png"), fullPage: true });

      await page.locator("#id_username").fill(admin.username);
      await page.locator("#id_password").fill(admin.password);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/ops/$"));
      expect(await page.evaluate(() => typeof window.Ops)).toBe("object");

      await visit("01-工作首页", "/ops/", "待办清单");
      await visit("02-家庭查询", "/ops/families/", "查询结果");
      if (familyId) await visit("03-家庭详情", `/ops/families/${familyId}/`, "家庭信息");
      if (childId) await visit("04-儿童详情", `/ops/children/${childId}/`, "基本信息");
      await visit("05-题库管理", "/ops/questionnaires/", "题库版本");
      await visit("06-新建题库", "/ops/questionnaires/new/", "第一步");
      if (versionId) await visit("07-题库编辑", `/ops/questionnaires/${versionId}/`);
      if (versionId) await visit("08-题库预览", `/ops/questionnaires/${versionId}/preview/`);
      await visit("09-活动管理", "/ops/activities/", "活动版本");
      if (activityId) await visit("10-活动编辑", `/ops/activities/${activityId}/`);
      await visit("11-报告管理", "/ops/reports/", "已生成报告");
      if (reportId) await visit("12-报告详情", `/ops/reports/${reportId}/`, "生成状态");
      await visit("13-生成任务", "/ops/jobs/", "任务列表");
      await visit("14-服务事项", "/ops/services/", "事项列表");
      if (requestId) await visit("15-事项详情", `/ops/services/${requestId}/`, "事项信息");
      await visit("16-账号与权限", "/ops/accounts/", "后台账号");
      await visit("17-新建账号", "/ops/accounts/new/", "账号信息");
      await visit("18-操作审计", "/ops/audit/", "操作记录");
      await visit("19-修改密码", "/ops/password/", "修改我的密码");

      // 窄屏：导航折叠后仍要能打开页面
      await page.setViewportSize({ width: 390, height: 844 });
      await visit("20-窄屏工作首页", "/ops/", "待办清单");
      await visit("21-窄屏家庭查询", "/ops/families/", "查询结果");

      expect(scriptErrors, `页面脚本错误：${scriptErrors.join(" | ")}`).toEqual([]);
      // 留一份清单，方便核对截图与页面是否一一对应
      expect(captured.length).toBeGreaterThanOrEqual(18);
      console.log(`已留档 ${captured.length} 张截图：${captured.join(", ")}`);
    } finally {
      shell(
        `from django.contrib.auth import get_user_model
get_user_model().objects.filter(username=${JSON.stringify(admin.username)}).update(is_active=False)`,
      );
    }
  });
});
