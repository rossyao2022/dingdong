/**
 * 家长姓名为空时，5 处运营界面回落手机号，不显示内部账号 parent-<uuid>（O-02）。
 *
 * 5 处：家庭列表「家长」列、家庭详情「家长」字段、儿童详情「所属家庭」、
 * CA 账户页「绑定家长」列、操作审计「操作人」列与其「对象」列副行。
 *
 * 前置：后端运行在 http://127.0.0.1:8017（config.settings.local，本地合成库）。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { shell } from "./support.js";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-019", "shots");
mkdirSync(shots, { recursive: true });

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";

/** 造一个运营账号 + 一个没填姓名的家长家庭，含 CA 账户与一条家长登录审计。 */
function seed() {
  const username = `ops-parent-name-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  const parentUsername = `parent-name-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const phone = "+8613" + String(Date.now()).slice(-8);
  const output = shell(
    `import json, uuid as _uuid
from io import StringIO
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.utils import timezone
from dingdong_ca.core.api.common import audit
from dingdong_ca.core.models import Child, Family, FamilyMembership, LoginGrant
from dingdong_ca.core.services import ca_account as ca_service
call_command("seed_base", stdout=StringIO())
User = get_user_model()
staff = User.objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="家长回落验收")
staff.groups.set(Group.objects.filter(name="account_admin"))
p = User.objects.create(username=${JSON.stringify(parentUsername)}, account_kind="parent",
                        phone=${JSON.stringify(phone)}, name="", is_staff=False)
p.set_unusable_password()
p.save(update_fields=["password"])
f = Family.objects.create()
FamilyMembership.objects.create(family=f, user=p, role="owner")
c = Child.objects.create(family=f, created_by=p, create_request_key=_uuid.uuid4(), create_payload={}, name="小苗")
account, _created = ca_service.issue_account(
    child=c, user=p, request_id=_uuid.uuid4(),
    nfc_token="ROBOT-TOKEN-T019-" + _uuid.uuid4().hex, robot_ref="DD-ROBOT-T019")
g = LoginGrant.objects.create(user=p, current_refresh_jti=_uuid.uuid4(),
                              expires_at=timezone.now() + timezone.timedelta(days=1))
audit(p, "auth.login", g)
print("SEED:" + json.dumps({
    "family": str(f.pk),
    "child": str(c.pk),
    "caAccountId": account.ca_account_id,
}))`,
  );
  const line = output.split("\n").find((row) => row.startsWith("SEED:"));
  if (!line) throw new Error(`seed 未输出结果：${output}`);
  return { ...JSON.parse(line.slice("SEED:".length)), username, password, parentUsername, phone };
}

function cleanup(data) {
  shell(
    `from django.contrib.auth import get_user_model
from dingdong_ca.core.models import AuditEvent, CaAccount, Child, Family, FamilyMembership, LoginGrant
account = CaAccount.objects.filter(ca_account_id=${JSON.stringify(data.caAccountId)}).first()
if account is not None:
    AuditEvent.objects.filter(target_kind="ca_account", target_id=account.pk).delete()
    account.delete()
for g in LoginGrant.objects.filter(user__username=${JSON.stringify(data.parentUsername)}):
    AuditEvent.objects.filter(target_kind="login_grant", target_id=g.pk).delete()
    g.delete()
Child.objects.filter(pk=${JSON.stringify(data.child)}).delete()
FamilyMembership.objects.filter(family_id=${JSON.stringify(data.family)}).delete()
Family.objects.filter(pk=${JSON.stringify(data.family)}).delete()
get_user_model().objects.filter(username__in=${JSON.stringify([data.username, data.parentUsername])}).delete()`,
  );
}

async function login(page, data) {
  await page.goto(`${BACKEND}/ops/login/`);
  await page.locator("#id_username").fill(data.username);
  await page.locator("#id_password").fill(data.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/ops/$"));
}

test("家长没填姓名时五处界面都回落手机号，不出现内部账号", async ({ page }) => {
  const data = seed();
  try {
    await login(page, data);

    // 1. 家庭列表「家长」列
    await page.goto(`${BACKEND}/ops/families/`);
    const familiesTable = page.locator("table.ops-table");
    await expect(familiesTable).toContainText(data.phone);
    await expect(familiesTable).not.toContainText(data.parentUsername);
    await page.screenshot({ path: join(shots, "families.png"), fullPage: true });

    // 2. 家庭详情「家长」字段
    await page.goto(`${BACKEND}/ops/families/${data.family}/`);
    const familyKv = page.locator("dl.kv");
    await expect(familyKv).toContainText(data.phone);
    await expect(familyKv).not.toContainText(data.parentUsername);
    await page.screenshot({ path: join(shots, "family-detail.png"), fullPage: true });

    // 3. 儿童详情「所属家庭」
    await page.goto(`${BACKEND}/ops/children/${data.child}/`);
    const childBasics = page.locator("section.card", { hasText: "基本信息" }).locator("dl.kv");
    await expect(childBasics).toContainText(data.phone);
    await expect(childBasics).not.toContainText(data.parentUsername);
    await page.screenshot({ path: join(shots, "child-detail.png"), fullPage: true });

    // 4. CA 账户页「绑定家长」列
    await page.goto(`${BACKEND}/ops/ca-accounts/?q=${data.caAccountId}`);
    const caTable = page.locator("table.ops-table");
    await expect(caTable).toContainText(data.caAccountId);
    await expect(caTable).toContainText(data.phone);
    await expect(caTable).not.toContainText(data.parentUsername);
    await page.screenshot({ path: join(shots, "ca-accounts.png"), fullPage: true });

    // 5. 操作审计「操作人」列与「对象」列副行
    await page.goto(`${BACKEND}/ops/audit/`);
    const auditTable = page.locator("table.ops-table");
    await expect(auditTable).toBeVisible();
    await expect(auditTable).toContainText("登录凭据");
    await expect(auditTable).toContainText(data.phone);
    await expect(auditTable).not.toContainText(data.parentUsername);
    await page.screenshot({ path: join(shots, "audit.png"), fullPage: true });
  } finally {
    cleanup(data);
  }
});
