/**
 * 内部版本 code 不给家长看（P-04）。
 *
 * 改前实测：家长端答题页写「必填 · 单选 · 题库版本 readable-v2」，运营端儿童详情的答卷区
 * 写「· 版本 readable-v2」。家长看不懂这串内部标识。改后两处都显示题库中文名 + 版本号
 * （「四个小情境：探索偏好体验（v2）」），原始 code 收进 `title` 属性，悬停才出现。
 *
 * 前置：后端 127.0.0.1:8017（本地合成库）、家长端 127.0.0.1:4173。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { shell } from "./support.js";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-013", "shots");
mkdirSync(shots, { recursive: true });

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const RAW_VERSION = "readable-v2";
// 第三份已发布题库：本地合成库只有两份（探索 / 初始测评，都不走题库卡片分支），
// 而题库卡片是同一份版本字段的第三个渲染点，所以验收时临时建一份、结束时删掉。
const EXTRA_CODE = "e2e-version-label";
const EXTRA_VERSION = "draft-v7";

const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

function seedExtraBank() {
  shell(
    `from django.apps import apps
Q = apps.get_model("core", "QuestionnaireVersion")
Q.objects.filter(code=${JSON.stringify(EXTRA_CODE)}).delete()
Q.objects.create(code=${JSON.stringify(EXTRA_CODE)}, version=${JSON.stringify(EXTRA_VERSION)},
                 title="合成额外题库", description="仅用于验收版本号展示，验收后删除。",
                 purpose="assessment", data_origin="synthetic", status="published",
                 questions=[{"code": "q1", "title": "合成题目", "type": "single_choice",
                             "options": [{"code": "a", "label": "选项甲"}]}])`,
  );
}

function dropExtraBank() {
  shell(
    `from django.apps import apps
apps.get_model("core", "QuestionnaireVersion").objects.filter(code=${JSON.stringify(EXTRA_CODE)}).delete()`,
  );
}

function makeStaff(roles, name = "版本文案验收") {
  const username = `ops-version-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  shell(
    `from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name=${JSON.stringify(name)})
u.groups.set(Group.objects.filter(name__in=${JSON.stringify(roles)}))`,
  );
  return { username, password };
}

function deactivate(username) {
  shell(
    `from django.contrib.auth import get_user_model
get_user_model().objects.filter(username=${JSON.stringify(username)}).update(is_active=False)`,
  );
}

/** 取一条真实存在 readable-v2 答卷的儿童：`儿童 id|题库中文名`。 */
function readableSessionFixture() {
  return shell(
    `from django.apps import apps
Session = apps.get_model("core", "AssessmentSession")
row = (Session.objects.filter(questionnaire_version__version=${JSON.stringify(RAW_VERSION)})
       .exclude(status="cancelled").order_by("created_at").first())
print(f"{row.child_id}|{row.questionnaire_version.title}" if row else "|")`,
  )
    .trim()
    .split("\n")
    .pop()
    .trim();
}

test("家长端答题页显示题库中文名与版本号，不把内部 code 写进正文", async ({
  page,
}) => {
  seedExtraBank();
  try {
    await page.goto("/");
    await page.getByLabel("手机号", { exact: true }).fill(phone());
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.getByLabel("验证码", { exact: true }).fill("00000");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "建立儿童档案" }),
    ).toBeVisible();
    await page.getByLabel("姓名或称呼").fill("版本文案合成儿童");
    await page.getByRole("button", { name: "保存档案", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "好奇心，准备出发！" }),
    ).toBeVisible();

    await page
      .locator("#main-nav")
      .getByRole("link", { name: "测评与报告" })
      .click();

    // 题库卡片：卡片标题已经是中文名，这里只给版本号。
    const card = page.locator(".panel", { hasText: "合成额外题库" });
    await expect(card.locator("p.note")).toContainText("版本 v7");
    expect(await card.textContent()).not.toContain(EXTRA_VERSION);
    await expect(card.locator(`[title="${EXTRA_VERSION}"]`)).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(shots, "parent-bank-card-desktop.png"),
    });

    await page.getByRole("button", { name: "开始探索体验", exact: true }).click();
    await page.getByLabel("我已阅读并同意本次测评用途").check();
    await page.getByRole("button", { name: "同意并开始", exact: true }).click();

    const note = page.locator(".question p.note").nth(1);
    await expect(note).toContainText("题库「四个小情境：探索偏好体验」（v2）");
    // 正文（textContent 不含属性）里不该再有内部 code；它只活在 title 里。
    expect(await page.locator("body").textContent()).not.toContain(RAW_VERSION);
    await expect(page.locator(`.question [title="${RAW_VERSION}"]`)).toHaveCount(
      1,
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(shots, "parent-quiz-desktop.png"),
      fullPage: true,
    });

    // 文案变长了，窄屏确认没撑出横向滚动条。
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: join(shots, "parent-quiz-mobile.png"),
      fullPage: true,
    });
  } finally {
    dropExtraBank();
  }
});

test("运营端儿童详情的答卷区显示版本号，不把内部 code 写进正文", async ({
  page,
}) => {
  const [childId, title] = readableSessionFixture().split("|");
  expect(childId, "本地合成库里应有 readable-v2 答卷").not.toBe("");
  const staff = makeStaff(["operations"]);
  try {
    await page.goto(`${BACKEND}/ops/login/`);
    await page.locator("#id_username").fill(staff.username);
    await page.locator("#id_password").fill(staff.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${BACKEND}/ops/$`));

    await page.goto(`${BACKEND}/ops/children/${childId}/`);
    const summary = page.locator(".question-card summary").first();
    await expect(summary).toContainText(title);
    await expect(summary).toContainText("版本 v2");
    expect(await page.locator("body").textContent()).not.toContain(RAW_VERSION);
    await expect(page.locator(`[title="${RAW_VERSION}"]`).first()).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(shots, "ops-child-detail-desktop.png"),
      fullPage: true,
    });
  } finally {
    deactivate(staff.username);
  }
});
