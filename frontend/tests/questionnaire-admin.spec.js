import { test, expect } from "@playwright/test";
import { shell } from "./support.js";

test("后台可视化创建、预览、发布、复制新版本", async ({ page, browser }) => {
  const username = "question-editor-" + crypto.randomUUID(),
    password = crypto.randomUUID();
  const title =
    "一起观察叶子（体验测试）<b>文案</b>" + crypto.randomUUID().slice(0, 5);
  let family;
  let parent;
  let oldUrl;
  shell(
    `from django.contrib.auth import get_user_model; from django.contrib.auth.models import Group; u=get_user_model().objects.create_user(username=${JSON.stringify(username)},password=${JSON.stringify(password)},account_kind='staff',is_staff=True); u.groups.add(Group.objects.get(name='content'))`,
  );
  try {
    await page.goto("http://127.0.0.1:8017/admin/login/");
    await page.locator("#id_username").fill(username);
    await page.locator("#id_password").fill(password);
    await page.locator("input[type=submit]").click();
    await page.goto(
      "http://127.0.0.1:8017/admin/core/questionnaireversion/add/",
    );
    await page
      .getByLabel("题库标识:", { exact: true })
      .fill("browser-" + crypto.randomUUID().slice(0, 8));
    await page.getByLabel("版本号:", { exact: true }).fill("browser-v1");
    await page.getByLabel("题库名称:", { exact: true }).fill(title);
    await page.getByLabel("用途:", { exact: true }).selectOption("exploration");
    await page
      .getByLabel("给家长的用途说明:", { exact: true })
      .fill("非正式体验，只记录本次选择，不作能力评价。");
    await page.getByLabel("内容来源:", { exact: true }).fill("synthetic");
    await page.getByRole("button", { name: "添加题目", exact: true }).click();
    await page
      .getByLabel("题干", { exact: true })
      .fill("发现两片不同的叶子，你想怎样观察？");
    await page.getByLabel("选项 1", { exact: true }).fill("比较形状");
    await page.getByLabel("选项 2", { exact: true }).fill("看看纹路");
    await page
      .getByLabel("题型", { exact: true })
      .selectOption("multiple_choice");
    await page
      .getByRole("button", { name: "预览当前草稿", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "家长视角预览 · 未发布草稿" }),
    ).toBeVisible();
    await page.locator("input[name=_continue]").click();
    await expect(
      page.getByRole("button", { name: "发布此版本", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "发布此版本", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "复制为新版本", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "发布此版本", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "docs/m5-admin-published.png",
      fullPage: true,
    });
    family = await browser.newContext();
    parent = await family.newPage();
    await parent.goto("http://127.0.0.1:4173/");
    await parent
      .getByLabel("手机号", { exact: true })
      .fill("138" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
    await parent
      .getByRole("button", { name: "获取验证码", exact: true })
      .click();
    await parent.getByLabel("验证码", { exact: true }).fill("00000");
    await parent.getByRole("button", { name: "登录", exact: true }).click();
    await parent.getByLabel("姓名或称呼").fill("新题库测试小芽");
    await parent.getByRole("button", { name: "保存档案", exact: true }).click();
    await expect(
      parent.getByRole("heading", { name: "好奇心，准备出发！" }),
    ).toBeVisible();
    await parent.goto("http://127.0.0.1:4173/#reports");
    await parent
      .locator("section.panel")
      .filter({
        has: parent.getByRole("heading", { name: title, exact: true }),
      })
      .getByRole("button", { name: "开始这份问卷" })
      .click();
    await parent.getByLabel("我已阅读并同意本次测评用途").check();
    await parent
      .getByRole("button", { name: "同意并开始", exact: true })
      .click();
    await expect(
      parent.getByText("发现两片不同的叶子，你想怎样观察？", { exact: true }),
    ).toBeVisible();
    oldUrl = parent.url();
    await page
      .getByRole("button", { name: "复制为新版本", exact: true })
      .click();
    await expect(page.getByLabel("题干", { exact: true })).toHaveValue(
      "发现两片不同的叶子，你想怎样观察？",
    );
    await page
      .getByLabel("题干", { exact: true })
      .fill("和家人分享叶子时，你想怎样表达？");
    await page.locator("input[name=_continue]").click();
    await page.screenshot({ path: "docs/m5-admin-editor.png", fullPage: true });
    await page.getByRole("button", { name: "发布此版本", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "发布此版本", exact: true }),
    ).toHaveCount(0);
    await parent.reload();
    await expect(
      parent.getByText("发现两片不同的叶子，你想怎样观察？", { exact: true }),
    ).toBeVisible();
    await parent.getByRole("checkbox").first().check();
    await parent
      .getByRole("button", { name: "保存并继续", exact: true })
      .click();
    await parent
      .getByRole("button", { name: "完成探索体验", exact: true })
      .click();
    await expect(
      parent.getByRole("heading", { name: "这次，你这样选择" }),
    ).toBeVisible();
    await parent.goto("http://127.0.0.1:4173/#reports");
    await expect(
      parent.getByRole("button", { name: title + " · 查看选择", exact: true }),
    ).toBeVisible();
    await parent
      .locator("section.panel")
      .filter({
        has: parent.getByRole("heading", { name: title, exact: true }),
      })
      .getByRole("button", { name: "开始这份问卷" })
      .click();
    await expect(
      parent.getByText("和家人分享叶子时，你想怎样表达？", { exact: true }),
    ).toBeVisible();
    await parent.goto(oldUrl);
    await expect(
      parent.getByText("发现两片不同的叶子，你想怎样观察？", { exact: true }),
    ).toBeVisible();
    await parent.setViewportSize({ width: 390, height: 844 });
    await parent.screenshot({
      path: "docs/m5-version-isolation-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    if (family) await family.close();
    shell(
      `from dingdong_ca.core.models import QuestionnaireVersion; QuestionnaireVersion.objects.filter(published_by__username=${JSON.stringify(username)},status='published').update(status='retired')`,
    );
    // Published content keeps its author; deactivate this short-lived browser test account.
    shell(
      `from django.contrib.auth import get_user_model; get_user_model().objects.filter(username=${JSON.stringify(username)}).update(is_active=False)`,
    );
  }
});
