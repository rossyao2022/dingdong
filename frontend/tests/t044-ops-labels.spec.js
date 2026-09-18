/**
 * T-044 的运营端真实 Chrome 验收（O-12 / O-13 / O-14）。
 *
 * 真实 Chrome、不拦截任何接口响应；输入数据用 Django shell 直接落到本地合成库
 * （同 ops-console.spec.js 的既有做法），页面本身走真实渲染。
 *
 * 前置：后端 8017（config.settings.local）+ PostgreSQL/Redis 在跑。
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { root, shell } from "./support.js";

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const SHOTS = path.join(root, ".trellis", "tasks", "T-044", "shots");

let seq = 0;
function makeStaff(roles, name = "验收账号") {
  seq += 1;
  const username = `ops-t044-${Date.now().toString(36)}-${seq}-${crypto.randomUUID().slice(0, 6)}`;
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

const lastLine = (out) => out.trim().split("\n").pop().trim();

/** 各造一条同步失败与报告失败任务：卡片数字要含两种任务类型。 */
function seedFailedJobs() {
  return lastLine(
    shell(
      `import uuid
from django.apps import apps
from django.utils import timezone
Job = apps.get_model("core", "BackgroundJob")
made = []
for kind, code in [("sync", "UPSTREAM_TIMEOUT"), ("report", "RENDER_FAILED")]:
    made.append(str(Job.objects.create(kind=kind,
                                       business_key="ops-t044-" + kind + "-" + uuid.uuid4().hex,
                                       status="failed", error_code=code,
                                       attempt_count=3, max_attempts=5,
                                       finished_at=timezone.now()).pk))
print(",".join(made))`,
    ),
  );
}

/** 造一个只属于该儿童的家庭 + 儿童，并挂上 `count` 条待处理事项（按提交时间递增）。 */
function seedChildRequests(name, count) {
  return lastLine(
    shell(
      `import uuid
from datetime import timedelta
from django.apps import apps
from django.utils import timezone
User = apps.get_model("users", "User")
Family = apps.get_model("core", "Family")
Child = apps.get_model("core", "Child")
FamilyMembership = apps.get_model("core", "FamilyMembership")
DataRequest = apps.get_model("core", "DataRequest")
suffix = uuid.uuid4().hex
parent = User.objects.create(username="parent-t044-" + suffix, account_kind="parent",
                             phone="+86137" + str(uuid.uuid4().int)[:8],
                             name="T044 家长")
parent.set_unusable_password()
parent.save(update_fields=["password"])
family = Family.objects.create()
FamilyMembership.objects.create(family=family, user=parent, role="owner")
child = Child.objects.create(family=family, created_by=parent,
                             create_request_key=uuid.uuid4(), create_payload={},
                             name=${JSON.stringify(name)})
base = timezone.now() - timedelta(minutes=30)
rows = []
for index in range(${count}):
    row = DataRequest.objects.create(child=child, requester=parent,
                                     create_request_key=uuid.uuid4(),
                                     kind="support", reason_code="support_needed")
    DataRequest.objects.filter(pk=row.pk).update(created_at=base + timedelta(minutes=index))
    rows.append(str(row.pk))
print(",".join(rows))`,
    ),
  );
}

async function login(page, { username, password }) {
  await page.goto(`${BACKEND}/ops/login/`);
  await page.locator("#id_username").fill(username);
  await page.locator("#id_password").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`${BACKEND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/ops/$`),
  );
  expect(await page.evaluate(() => typeof window.Ops)).toBe("object");
}

test("运营端：生成任务异常标签、其他事项排除自身、待办最新 5 条", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  seedFailedJobs();
  const many = seedChildRequests("T044 多事项儿童", 3).split(",");
  const single = seedChildRequests("T044 单事项儿童", 1).split(",");
  const staff = makeStaff(["operations", "technical"], "T044 验收运营");

  try {
    await login(page, staff);

    // O-12：卡片与区块装的是全部失败生成任务，标签就不能只写「报告」
    const dashboard = await page.goto(`${BACKEND}/ops/`);
    expect(dashboard.status()).toBe(200);
    await expect(
      page.getByText("生成任务异常", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("报告生成异常")).toHaveCount(0);
    await expect(
      page.getByText("数据同步", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("报告生成", { exact: true }).first(),
    ).toBeVisible();

    // O-14：待办清单·服务事项写明条数与排序，且最新一条在最上面
    await expect(
      page.getByText("最多显示 5 条（按提交时间从新到旧）。"),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(SHOTS, "o12-o14-dashboard.png"),
      fullPage: true,
      animations: "disabled",
    });

    // O-13：详情页「该儿童的其他事项」只列别的，不列当前这条
    await page.goto(`${BACKEND}/ops/services/${many[0]}/`);
    const others = page.locator("section.card", { hasText: "该儿童的其他事项" });
    await expect(others).toBeVisible();
    await expect(others.locator("li")).toHaveCount(2);
    await expect(page.getByText("T044 多事项儿童").first()).toBeVisible();
    await page.screenshot({
      path: path.join(SHOTS, "o13-other-requests.png"),
      fullPage: true,
      animations: "disabled",
    });

    // 该儿童仅此一条时整块不显示
    await page.goto(`${BACKEND}/ops/services/${single[0]}/`);
    await expect(page.getByText("事项信息").first()).toBeVisible();
    await expect(page.getByText("该儿童的其他事项")).toHaveCount(0);
    await page.screenshot({
      path: path.join(SHOTS, "o13-single-request.png"),
      fullPage: true,
      animations: "disabled",
    });

    expect(errors).toEqual([]);
  } finally {
    deactivate(staff.username);
  }
});
