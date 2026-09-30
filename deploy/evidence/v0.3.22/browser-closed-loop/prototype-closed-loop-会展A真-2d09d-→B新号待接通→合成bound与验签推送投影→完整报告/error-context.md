# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: prototype-closed-loop.spec.js >> 会展A真实解绑保留CA记录→B新号待接通→合成bound与验签推送投影→完整报告
- Location: tests/prototype-closed-loop.spec.js:132:1

# Error details

```
Error: locator.click: Test ended.
Call log:
  - waiting for getByRole('button', { name: '同意并开始', exact: true })

```

# Test source

```ts
  54  |   page,
  55  | }) => {
  56  |   const childA = await login(page);
  57  |   const token = "closed-loop-" + Date.now();
  58  |   const first = await (await bind(page, token)).json();
  59  |   await expect(page.locator(".account-row")).toHaveCount(1);
  60  |   await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  61  |   await page.getByLabel("姓名或称呼").fill("另一合成儿童");
  62  |   await page.getByRole("button", { name: "保存档案", exact: true }).click();
  63  |   await expect(page.locator(".six-islands")).toBeVisible();
  64  |   const childB = await page.locator("#child-select").inputValue();
  65  |   const conflict = await bind(page, token);
  66  |   expect(conflict.status()).toBe(409);
  67  |   await expect(page.locator("#dialog .form-error")).toContainText(
  68  |     "机器人已被其他孩子绑定，请原绑定家长先解绑，再重新绑定。",
  69  |   );
  70  |   await expect(page.locator("#dialog [data-action=refresh]")).toHaveCount(0);
  71  |   await page.setViewportSize({ width: 390, height: 844 });
  72  |   await shot(page, "occupied-robot-390");
  73  |   await page.getByRole("button", { name: "关闭对话框", exact: true }).click();
  74  |   await page.locator("#child-select").selectOption(childA);
  75  |   await expect(page.locator(".six-islands")).toBeVisible();
  76  |   await page.goto(base + "/#settings");
  77  |   await expect(page.locator(".account-row")).toContainText(first.ca_account_id);
  78  |   await page.locator("[data-action=retire-account]").click();
  79  |   await page.locator("[data-action=confirm-retire]").click();
  80  |   await expect(page.locator(".account-row")).toContainText("已归档");
  81  |   await page.locator("#child-select").selectOption(childB);
  82  |   await expect(page.locator(".six-islands")).toBeVisible();
  83  |   const second = await (await bind(page, token)).json();
  84  |   expect(second.ca_account_id).not.toBe(first.ca_account_id);
  85  |   expect(second.bind_state).toBe("unbound");
  86  |   expect(
  87  |     (await api(page, `/children/${childA}/ca-accounts`)).items[0].status,
  88  |   ).toBe("retired");
  89  | });
  90  | test("真实儿童资料revision冲突仍能载入最新并重新保存", async ({ page }) => {
  91  |   const child = await login(page, "旧版称呼");
  92  |   await page.goto(base + "/#settings");
  93  |   await page.getByRole("button", { name: "编辑档案", exact: true }).click();
  94  |   await page.locator("#edit-child-form [name=name]").fill("本页修改");
  95  |   const row = await api(page, "/children/" + child);
  96  |   await api(page, "/children/" + child, {
  97  |     method: "PATCH",
  98  |     body: {
  99  |       name: "另一页面保存",
  100 |       gender: row.gender,
  101 |       birth_date: row.birth_date,
  102 |       revision: row.revision,
  103 |     },
  104 |   });
  105 |   const pending = page.waitForResponse(
  106 |     (r) =>
  107 |       r.url().endsWith("/children/" + child) &&
  108 |       r.request().method() === "PATCH",
  109 |   );
  110 |   await page.getByRole("button", { name: "保存修改", exact: true }).click();
  111 |   const conflict = await pending;
  112 |   expect(conflict.status()).toBe(409);
  113 |   expect((await conflict.json()).code).toBe("EDIT_CONFLICT");
  114 |   await expect(page.locator("#child-conflict")).toBeVisible();
  115 |   await page.locator("[data-action=child-conflict-load]").click();
  116 |   await page.locator("[data-action=child-conflict-load-confirm]").click();
  117 |   await expect(page.locator("#edit-child-form [name=name]")).toHaveValue(
  118 |     "另一页面保存",
  119 |   );
  120 |   await page.locator("#edit-child-form [name=name]").fill("最终修改");
  121 |   await page.getByRole("button", { name: "保存修改", exact: true }).click();
  122 |   await expect(page.locator("#dialog")).not.toBeVisible();
  123 |   expect((await api(page, "/children/" + child)).name).toBe("最终修改");
  124 | });
  125 | test("普通新用户无设备无预置输入，真实22题经Worker生成CA报告", async ({
  126 |   page,
  127 | }) => {
  128 |   test.setTimeout(240000);
  129 |   const child = await login(page, "新家长报告合成儿童");
  130 |   await page.goto(base + "/#reports");
  131 |   await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  132 |   await page.getByRole("button", { name: "开始测评", exact: true }).click();
  133 |   await page.getByLabel("我已阅读并同意本次测评用途").check();
  134 |   await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  135 |   for (let i = 1; i <= 22; i++) {
  136 |     await expect(
  137 |       page.getByText(new RegExp("第 " + i + " / 22 题")),
  138 |     ).toBeVisible();
  139 |     await page.getByRole("radio").first().check();
  140 |     await page
  141 |       .getByRole("button", {
  142 |         name: i === 22 ? "保存并完成" : "保存并下一题",
  143 |         exact: true,
  144 |       })
  145 |       .click();
  146 |   }
  147 |   await expect(
  148 |     page.getByRole("button", { name: "生成演示报告", exact: true }),
  149 |   ).toBeVisible();
  150 |   await page.getByRole("button", { name: "生成演示报告", exact: true }).click();
  151 |   await expect(
  152 |     page.getByRole("button", { name: "查看初始报告", exact: true }),
  153 |   ).toBeVisible({ timeout: 180000 });
> 154 |   await page.getByRole("button", { name: "查看初始报告", exact: true }).click();
      |                                                            ^ Error: locator.click: Test ended.
  155 |   await expect(
  156 |     page.getByRole("heading", { name: "初始报告", exact: true }),
  157 |   ).toBeVisible();
  158 |   const reports = await api(page, `/children/${child}/reports`);
  159 |   expect(reports.items.length).toBeGreaterThan(0);
  160 |   const generated = await api(page, "/reports/" + reports.items[0].id);
  161 |   expect(generated.child_id).toBe(child);
  162 |   expect(generated.sections.length).toBeGreaterThan(0);
  163 |   await page.setViewportSize({ width: 390, height: 844 });
  164 |   await shot(page, "new-parent-real-ca-report-390");
  165 | });
  166 | 
  167 | async function signedPush(page, weekly = 7, value = 6) {
  168 |   const data = JSON.parse(
  169 |     readFileSync("../backend/tests/fixtures/prototype-insights.json", "utf8"),
  170 |   );
  171 |   data.growth.weekly_turns = weekly;
  172 |   data.companion.value = value;
  173 |   data.companion.effective_turns = 24;
  174 |   data.companion.updated_at = new Date().toISOString();
  175 |   const envelope = {
  176 |     event_type: "dingdong.prototype.companion_milestone",
  177 |     occurred_at: data.companion.updated_at,
  178 |     milestone: { interval: 3, completed_turns: 24 },
  179 |     data,
  180 |   };
  181 |   const raw = JSON.stringify(envelope),
  182 |     stamp = String(Math.floor(Date.now() / 1000));
  183 |   const signature =
  184 |     "sha256=" +
  185 |     createHmac("sha256", "synthetic-only-signing-secret")
  186 |       .update(stamp + "." + raw)
  187 |       .digest("hex");
  188 |   const response = await page.request.post(
  189 |     (process.env.E2E_BACKEND_URL || "http://127.0.0.1:8020") +
  190 |       "/api/dingdong/prototype/events",
  191 |     {
  192 |       data: raw,
  193 |       headers: {
  194 |         "Content-Type": "application/json",
  195 |         "X-Dingdong-Timestamp": stamp,
  196 |         "X-Dingdong-Signature": signature,
  197 |         "X-Dingdong-Event-ID": "synthetic-browser-" + randomUUID(),
  198 |         "X-Dingdong-Event-Type": envelope.event_type,
  199 |       },
  200 |     },
  201 |   );
  202 |   expect(response.status()).toBe(201);
  203 |   expect((await response.json()).duplicate).toBe(false);
  204 |   return data;
  205 | }
  206 | function boundFixture(child, id) {
  207 |   // Explicit local-only fixture changes solely the newly issued synthetic device row.
  208 |   // It does not claim a supplier binding acknowledgement or sender delivery.
  209 |   expect(child).toMatch(/^[a-f0-9-]{36}$/);
  210 |   expect(id).toMatch(/^ca_[a-zA-Z0-9]+$/);
  211 |   shell(
  212 |     `from django.conf import settings; from dingdong_ca.core.models import CaAccount; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; row=CaAccount.objects.get(child_id='${child}',ca_account_id='${id}',status='active'); assert row.prototype_demo; row.bind_state='bound'; row.save(update_fields=['bind_state'])`,
  213 |   );
  214 | }
  215 | async function grantRobot(page, child) {
  216 |   const policy = await api(page, "/policies/current?purpose=dingdong_sync", {
  217 |     auth: false,
  218 |   });
  219 |   return api(page, `/children/${child}/consents`, {
  220 |     method: "POST",
  221 |     body: { request_id: randomUUID(), policy_version_id: policy.id },
  222 |   });
  223 | }
  224 | test("会展A真实解绑保留CA记录→B新号待接通→合成bound与验签推送投影→完整报告", async ({
  225 |   page,
  226 |   browser,
  227 | }) => {
  228 |   test.setTimeout(180000);
  229 |   const errors = [];
  230 |   page.on("pageerror", (e) => errors.push(e.message));
  231 |   const childA = await login(page, "会展家长A合成儿童");
  232 |   await page.goto(base + "/#companion");
  233 |   await page.locator("[data-action=companion-exploration]").click();
  234 |   await expect(page.locator("#consent-check")).toBeVisible();
  235 |   await page.locator("#consent-check").check();
  236 |   await page.locator("[data-action=agree-assessment]").click();
  237 |   await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
  238 |   const savedSession = page.url().split("/").pop();
  239 |   for (let i = 1; i <= 4; i++) {
  240 |     await expect(
  241 |       page.getByText(`第 ${i} / 4 题`, { exact: false }),
  242 |     ).toBeVisible();
  243 |     await page.locator("#answer-form input[name=answer]").first().check();
  244 |     await page.locator("#answer-form button[type=submit]").click();
  245 |   }
  246 |   await page.locator("[data-action=complete-exploration]").click();
  247 |   await expect(page.locator(".guidance-summary")).toBeVisible();
  248 |   // A owns a real CA report, generated by the worker before any robot binding.
  249 |   await page.goto(base + "/#reports");
  250 |   await page.getByRole("button", { name: "开始测评", exact: true }).click();
  251 |   await page.getByLabel("我已阅读并同意本次测评用途").check();
  252 |   await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  253 |   for (let i = 1; i <= 22; i++) {
  254 |     await expect(
```