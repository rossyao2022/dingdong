/**
 * 审计「对象」列不给运营看内部码（O-03）。
 *
 * 改前实测（本地合成库真实记录）：家长登录一条显示
 * 「未知（login_grant） login grant（parent-a4f7a336…）」；同一页还有
 * 「assessment session（…）」「consent grant（…）」这类英文模型名。
 * 改后对象列一律是中文词条，英文模型名不再出现。
 *
 * 前置：后端运行在 http://127.0.0.1:8017（config.settings.local，本地合成库）。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { shell } from "./support.js";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-014", "shots");
mkdirSync(shots, { recursive: true });

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";

function makeAdmin() {
  const username = `ops-audit-label-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  shell(
    `from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="对象词条验收")
u.groups.set(Group.objects.filter(name="account_admin"))`,
  );
  return { username, password };
}

/**
 * 造一条家长登录审计，复现线上那条记录的形状：走真实写入路径
 * （`core/api/common.audit` + 真 `LoginGrant`），家长没填姓名所以标签里是内部账号。
 * 返回家长用户名，供收尾清理。
 */
function seedParentLogin() {
  const username = `parent-audit-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  shell(
    `import uuid as _uuid
from django.contrib.auth import get_user_model
from django.utils import timezone
from dingdong_ca.core.api.common import audit
from dingdong_ca.core.models import LoginGrant
User = get_user_model()
u = User.objects.create(username=${JSON.stringify(username)}, account_kind="parent",
                        phone="+8613" + ${JSON.stringify(String(Date.now()).slice(-8))}, name="", is_staff=False)
u.set_unusable_password()
u.save(update_fields=["password"])
g = LoginGrant.objects.create(user=u, current_refresh_jti=_uuid.uuid4(),
                              expires_at=timezone.now() + timezone.timedelta(days=1))
audit(u, "auth.login", g)
print(u.username)`,
  );
  return username;
}

function dropParentLogin(username) {
  shell(
    `from django.contrib.auth import get_user_model
from dingdong_ca.core.models import AuditEvent, LoginGrant
for g in LoginGrant.objects.filter(user__username=${JSON.stringify(username)}):
    AuditEvent.objects.filter(target_kind="login_grant", target_id=g.pk).delete()
    g.delete()
get_user_model().objects.filter(username=${JSON.stringify(username)}).delete()`,
  );
}

test("运营审计页的对象列只出现中文词条", async ({ page }) => {
  const admin = makeAdmin();
  let parentUsername = "";
  try {
    await page.goto(`${BACKEND}/ops/login/`);
    await page.locator("#id_username").fill(admin.username);
    await page.locator("#id_password").fill(admin.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/ops/$"));

    // 登录本身也会写一条审计，等它写完再造要验收的那条，保证它排在表格第一行
    parentUsername = seedParentLogin();

    await page.goto(`${BACKEND}/ops/audit/`);
    const table = page.locator("table.ops-table");
    await expect(table).toBeVisible();

    // 刚写入的那条记录排在最前，验收的是它
    const firstCell = table.locator("tbody tr").first().locator("td").nth(3);
    await expect(firstCell).toContainText("登录凭据");
    expect(await firstCell.textContent()).not.toContain("login grant");

    // 整页：对象列不允许出现表名、英文模型名或「未知（…）」兜底
    const cells = await table.locator("tbody tr td:nth-child(4)").allTextContents();
    expect(cells.length).toBeGreaterThan(0);
    const leaked = cells.filter((text) => /未知（|[a-z][a-z_ ]*（/.test(text));
    expect(leaked, `对象列仍有内部码：${leaked.join(" | ")}`).toEqual([]);

    const body = await table.locator("tbody").textContent();
    for (const raw of ["login_grant", "login grant", "assessment session", "consent grant"]) {
      expect(body, `审计表格出现了内部码 ${raw}`).not.toContain(raw);
    }

    await page.screenshot({
      path: join(shots, "ops-audit-objects-desktop.png"),
      fullPage: true,
    });
    await page
      .locator("section.card", { hasText: "操作记录" })
      .screenshot({ path: join(shots, "ops-audit-objects-table.png") });

    // 同一份数据在首页「最近操作」也渲染，口径必须一致
    await page.goto(`${BACKEND}/ops/`);
    const recent = await page.locator("#recent-audit").textContent();
    for (const raw of ["login_grant", "login grant", "assessment session", "consent grant"]) {
      expect(recent, `首页最近操作出现了内部码 ${raw}`).not.toContain(raw);
    }
    await page.screenshot({
      path: join(shots, "ops-dashboard-recent-ops.png"),
      fullPage: true,
    });
  } finally {
    if (parentUsername) dropParentLogin(parentUsername);
    shell(
      `from django.contrib.auth import get_user_model
get_user_model().objects.filter(username=${JSON.stringify(admin.username)}).update(is_active=False)`,
    );
  }
});
