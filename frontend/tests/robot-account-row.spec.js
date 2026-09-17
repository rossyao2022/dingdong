/**
 * 儿童详情「机器人账户」一行（O-04）。
 *
 * 运营排查同步问题原先要切到 CA 账户页、按家长手机号搜；改后儿童详情直接给出
 * 账户号 + 绑定状态，并带上账户号跳到 CA 账户页筛选结果。
 *
 * 前置：后端运行在 http://127.0.0.1:8017（config.settings.local，本地合成库）。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { shell } from "./support.js";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-015", "shots");
mkdirSync(shots, { recursive: true });

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";

/** 造一个运营账号 + 一个家庭：第一个孩子有活跃账户，第二个孩子没有账户。 */
function seed() {
  const username = `ops-robot-row-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  const parent = `parent-robot-row-${crypto.randomUUID().slice(0, 8)}`;
  const output = shell(
    `import json, uuid
from io import StringIO
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from dingdong_ca.core.models import Child, Family, FamilyMembership
from dingdong_ca.core.services import ca_account as ca_service
call_command("seed_base", stdout=StringIO())
User = get_user_model()
staff = User.objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="机器人账户行验收")
staff.groups.set(Group.objects.filter(name="operations"))
p = User.objects.create(username=${JSON.stringify(parent)}, account_kind="parent",
                        phone="+8613" + ${JSON.stringify(String(Date.now()).slice(-8))}, name="家长甲", is_staff=False)
p.set_unusable_password()
p.save(update_fields=["password"])
f = Family.objects.create()
FamilyMembership.objects.create(family=f, user=p, role="owner")
with_account = Child.objects.create(family=f, created_by=p, create_request_key=uuid.uuid4(), create_payload={}, name="小芽")
without_account = Child.objects.create(family=f, created_by=p, create_request_key=uuid.uuid4(), create_payload={}, name="小禾")
account, _created = ca_service.issue_account(
    child=with_account, user=p, request_id=uuid.uuid4(),
    nfc_token="ROBOT-TOKEN-T015-" + uuid.uuid4().hex, robot_ref="DD-ROBOT-T015")
print("SEED:" + json.dumps({
    "family": str(f.pk),
    "childWith": str(with_account.pk),
    "childWithout": str(without_account.pk),
    "caAccountId": account.ca_account_id,
}))`,
  );
  const line = output.split("\n").find((row) => row.startsWith("SEED:"));
  if (!line) throw new Error(`seed 未输出结果：${output}`);
  return { ...JSON.parse(line.slice("SEED:".length)), username, password, parent };
}

function cleanup(data) {
  shell(
    `from django.contrib.auth import get_user_model
from dingdong_ca.core.models import AuditEvent, CaAccount, Child, Family, FamilyMembership
account = CaAccount.objects.filter(ca_account_id=${JSON.stringify(data.caAccountId)}).first()
if account is not None:
    AuditEvent.objects.filter(target_kind="ca_account", target_id=account.pk).delete()
    account.delete()
Child.objects.filter(pk__in=${JSON.stringify([data.childWith, data.childWithout])}).delete()
FamilyMembership.objects.filter(family_id=${JSON.stringify(data.family)}).delete()
Family.objects.filter(pk=${JSON.stringify(data.family)}).delete()
get_user_model().objects.filter(username__in=${JSON.stringify([data.username, data.parent])}).delete()`,
  );
}

async function login(page, data) {
  await page.goto(`${BACKEND}/ops/login/`);
  await page.locator("#id_username").fill(data.username);
  await page.locator("#id_password").fill(data.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/ops/$"));
}

test("儿童详情给出机器人账户号与绑定状态，并能跳到 CA 账户页", async ({ page }) => {
  const data = seed();
  try {
    await login(page, data);

    await page.goto(`${BACKEND}/ops/children/${data.childWith}/`);
    const basics = page.locator("section.card", { hasText: "基本信息" }).locator("dl.kv");
    await expect(basics).toContainText("机器人账户");
    await expect(basics).toContainText(data.caAccountId);
    // 显示的是词条，不是内部码 unbound / active
    await expect(basics).toContainText("待接通");
    await expect(basics).toContainText("使用中");
    await expect(basics).not.toContainText("unbound");

    await page.screenshot({ path: join(shots, "ops-child-detail-account-desktop.png"), fullPage: true });
    await page.locator("section.card", { hasText: "基本信息" }).screenshot({
      path: join(shots, "ops-child-detail-account-card.png"),
    });

    // 跳 CA 账户页：落点就是按这个账户号筛过的列表
    await page.getByRole("link", { name: "在 CA 账户页查看" }).click();
    await expect(page).toHaveURL(new RegExp(`/ops/ca-accounts/\\?q=${data.caAccountId}`));
    await expect(page.locator("#q")).toHaveValue(data.caAccountId);
    const table = page.locator("table.ops-table");
    await expect(table).toContainText(data.caAccountId);
    await expect(table).toContainText("小芽");
    await page.screenshot({ path: join(shots, "ops-ca-accounts-filtered.png"), fullPage: true });

    // 没有账户的孩子：空态说清"账户号什么时候才会有"，且不出现别人的账户号
    await page.goto(`${BACKEND}/ops/children/${data.childWithout}/`);
    const emptyBasics = page.locator("section.card", { hasText: "基本信息" }).locator("dl.kv");
    await expect(emptyBasics).toContainText("还没有机器人账户");
    await expect(emptyBasics).not.toContainText(data.caAccountId);
    await page.screenshot({ path: join(shots, "ops-child-detail-account-empty.png"), fullPage: true });

    // 窄屏同样可用（这一行是定义列表里新加的一项）
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BACKEND}/ops/children/${data.childWith}/`);
    await expect(
      page.locator("section.card", { hasText: "基本信息" }).locator("dl.kv"),
    ).toContainText(data.caAccountId);
    await page.screenshot({ path: join(shots, "ops-child-detail-account-mobile.png"), fullPage: true });
  } finally {
    cleanup(data);
  }
});
