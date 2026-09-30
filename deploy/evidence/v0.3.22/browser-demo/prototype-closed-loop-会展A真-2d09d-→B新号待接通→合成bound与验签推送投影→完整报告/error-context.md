# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: prototype-closed-loop.spec.js >> 会展A真实解绑保留CA记录→B新号待接通→合成bound与验签推送投影→完整报告
- Location: tests/prototype-closed-loop.spec.js:227:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - link "跳到主要内容" [ref=f1e2] [cursor=pointer]:
    - /url: "#main"
  - complementary "主导航" [ref=f1e3]:
    - link "DingDong 天赋成长伙伴" [ref=f1e4] [cursor=pointer]:
      - /url: "#explore"
      - generic [ref=f1e5]:
        - text: DingDong
        - generic [ref=f1e6]: 天赋成长伙伴
    - generic [ref=f1e7]: CAREER ACADEMY × DINGDONG
    - paragraph [ref=f1e8]: 一起，发现更多可能
    - navigation [ref=f1e9]:
      - link "天赋探索" [ref=f1e10] [cursor=pointer]:
        - /url: "#explore"
        - generic [aria-hidden] [ref=f1e11]: ✧
      - link "今日陪伴" [ref=f1e13] [cursor=pointer]:
        - /url: "#home"
        - generic [aria-hidden] [ref=f1e14]: ⌂
      - link "成长旅程" [ref=f1e16] [cursor=pointer]:
        - /url: "#journey"
        - generic [aria-hidden] [ref=f1e17]: ◷
      - link "测评与报告" [ref=f1e19] [cursor=pointer]:
        - /url: "#reports"
        - generic [aria-hidden] [ref=f1e20]: ▥
      - link "我的 DingDong" [ref=f1e22] [cursor=pointer]:
        - /url: "#companion"
        - generic [aria-hidden] [ref=f1e23]: ♧
      - link "账户与关联" [ref=f1e25] [cursor=pointer]:
        - /url: "#settings"
        - generic [aria-hidden] [ref=f1e26]: ⚙
      - link "家长支持" [ref=f1e28] [cursor=pointer]:
        - /url: "#services"
        - generic [aria-hidden] [ref=f1e29]: ♡
    - generic [ref=f1e31]:
      - generic [ref=f1e32]:
        - text: 每一小步，都算数。
        - paragraph [ref=f1e33]: 陪孩子探索，也把小小的发现留下来。
      - link "账户与关联" [ref=f1e34] [cursor=pointer]:
        - /url: "#settings"
  - generic [ref=f1e35]:
    - banner [ref=f1e36]:
      - generic [ref=f1e37]: 账户与关联
      - generic [ref=f1e39]:
        - generic [ref=f1e40]:
          - text: 当前儿童
          - combobox "切换儿童" [ref=f1e41]:
            - option "会展家长A合成儿童" [selected]
        - button "退出登录" [ref=f1e42] [cursor=pointer]
    - main [ref=f1e43]:
      - generic [ref=f1e44]:
        - generic [ref=f1e45]:
          - generic [ref=f1e46]:
            - text: 会展家长A合成儿童 · 成长空间
            - heading "账户与关联" [level=1] [ref=f1e47]
            - paragraph [ref=f1e48]: 管理孩子的资料和机器人。
          - generic [ref=f1e49]:
            - link "伙伴引导" [ref=f1e50] [cursor=pointer]:
              - /url: "#companion"
            - link "家长支持" [ref=f1e51] [cursor=pointer]:
              - /url: "#services"
        - generic [ref=f1e52]:
          - generic [ref=f1e53]:
            - heading "儿童档案" [level=2] [ref=f1e54]
            - paragraph [ref=f1e55]: 会展家长A合成儿童
            - paragraph [ref=f1e56]: 性别未填写 · 出生日期未填写
            - generic [ref=f1e57]:
              - button "编辑档案" [ref=f1e58] [cursor=pointer]
              - button "添加儿童档案" [ref=f1e59] [cursor=pointer]
          - generic [ref=f1e60]:
            - heading "家长账户" [level=2] [ref=f1e61]
            - paragraph [ref=f1e62]: 139****9667
            - button "退出登录" [ref=f1e63] [cursor=pointer]
          - generic [ref=f1e64]:
            - heading "用途授权" [level=2] [ref=f1e65]
            - generic [ref=f1e66]:
              - generic [ref=f1e67]: 测评记录
              - generic [ref=f1e68]:
                - text: 已同意
                - button "撤回授权" [ref=f1e69] [cursor=pointer]
            - generic [ref=f1e70]:
              - generic [ref=f1e71]: 机器人记录
              - generic [ref=f1e72]: 尚未授权
            - paragraph [ref=f1e73]: 撤回会阻止后续处理；如果需要清除已有数据，请提交删除事项。
          - generic [ref=f1e74]:
            - heading "我的机器人" [level=2] [ref=f1e76]
            - generic [ref=f1e77]:
              - text: 发现一台待绑定的机器人
              - generic [ref=f1e78]:
                - button "绑定这台机器人" [ref=f1e79] [cursor=pointer]
                - button "这次不绑" [ref=f1e80] [cursor=pointer]
            - paragraph [ref=f1e81]: 还没有为 会展家长A合成儿童 绑定机器人。
            - button "绑定机器人" [ref=f1e82] [cursor=pointer]
          - generic [ref=f1e83]:
            - heading "机器人记录" [level=2] [ref=f1e84]
            - paragraph [ref=f1e85]: 连接后可查看孩子与机器人的互动记录。
            - button "连接互动记录" [ref=f1e86] [cursor=pointer]
        - generic [ref=f1e87]:
          - heading "帮助与资料" [level=2] [ref=f1e88]
          - paragraph [ref=f1e89]: 需要帮助，或想申请修改、删除孩子的资料，可以从这里提交。
          - generic [ref=f1e90]:
            - button "需要帮助" [ref=f1e91] [cursor=pointer]
            - button "申请修改资料" [ref=f1e92] [cursor=pointer]
            - button "申请删除儿童数据" [ref=f1e93] [cursor=pointer]
          - heading "申请进度" [level=3] [ref=f1e94]
          - paragraph [ref=f1e95]: 还没有申请记录。
        - generic [ref=f1e96]:
          - heading "留下探索的小发现" [level=2] [ref=f1e97]
          - paragraph [ref=f1e98]: 下载当前孩子的探索回答、结果与亲子活动记录。
          - button "导出成长记录" [ref=f1e100] [cursor=pointer]
    - contentinfo [ref=f1e101]:
      - generic [ref=f1e102]: CA × DingDong · 每一小步，都算数。
  - dialog [ref=f1e103]:
    - generic [ref=f1e105]:
      - generic [ref=f1e106]:
        - heading "绑定机器人" [level=2] [ref=f1e107]
        - button "关闭对话框" [ref=f1e108] [cursor=pointer]: 关闭
      - paragraph [ref=f1e109]: 用手机碰一下机器人上的标签，信息会自动填入；也可以手动输入。一台机器人只能绑定一个孩子。
      - generic [ref=f1e110]:
        - generic [ref=f1e111]:
          - text: 这台机器人服务的孩子
          - combobox "这台机器人服务的孩子" [ref=f1e112]:
            - option "会展家长A合成儿童" [selected]
        - generic [ref=f1e113]:
          - text: 机器人凭据
          - textbox "机器人凭据" [ref=f1e114]:
            - /placeholder: 从机器人标签上取得
            - text: SYNTHETIC-CLOSED-LOOP-NFC
        - button "确认绑定" [ref=f1e115] [cursor=pointer]
      - alert [ref=f1e116]: 机器人已被其他孩子绑定，请原绑定家长先解绑，再重新绑定。
```

# Test source

```ts
  179 |     event_type: "dingdong.prototype.companion_milestone",
  180 |     occurred_at: data.companion.updated_at,
  181 |     milestone: { interval: 3, completed_turns: 24 },
  182 |     data,
  183 |   };
  184 |   const raw = JSON.stringify(envelope),
  185 |     stamp = String(Math.floor(Date.now() / 1000));
  186 |   const signature =
  187 |     "sha256=" +
  188 |     createHmac("sha256", "synthetic-only-signing-secret")
  189 |       .update(stamp + "." + raw)
  190 |       .digest("hex");
  191 |   const response = await page.request.post(
  192 |     (process.env.E2E_BACKEND_URL || "http://127.0.0.1:8020") +
  193 |       "/api/dingdong/prototype/events",
  194 |     {
  195 |       data: raw,
  196 |       headers: {
  197 |         "Content-Type": "application/json",
  198 |         "X-Dingdong-Timestamp": stamp,
  199 |         "X-Dingdong-Signature": signature,
  200 |         "X-Dingdong-Event-ID": "synthetic-browser-" + randomUUID(),
  201 |         "X-Dingdong-Event-Type": envelope.event_type,
  202 |       },
  203 |     },
  204 |   );
  205 |   expect(response.status()).toBe(201);
  206 |   expect((await response.json()).duplicate).toBe(false);
  207 |   return data;
  208 | }
  209 | function boundFixture(child, id) {
  210 |   // Explicit local-only fixture changes solely the newly issued synthetic device row.
  211 |   // It does not claim a supplier binding acknowledgement or sender delivery.
  212 |   expect(child).toMatch(/^[a-f0-9-]{36}$/);
  213 |   expect(id).toMatch(/^ca_[a-zA-Z0-9]+$/);
  214 |   shell(
  215 |     `from django.conf import settings; from dingdong_ca.core.models import CaAccount; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; row=CaAccount.objects.get(child_id='${child}',ca_account_id='${id}',status='active'); assert row.prototype_demo; row.bind_state='bound'; row.save(update_fields=['bind_state'])`,
  216 |   );
  217 | }
  218 | async function grantRobot(page, child) {
  219 |   const policy = await api(page, "/policies/current?purpose=dingdong_sync", {
  220 |     auth: false,
  221 |   });
  222 |   return api(page, `/children/${child}/consents`, {
  223 |     method: "POST",
  224 |     body: { request_id: randomUUID(), policy_version_id: policy.id },
  225 |   });
  226 | }
  227 | test("会展A真实解绑保留CA记录→B新号待接通→合成bound与验签推送投影→完整报告", async ({
  228 |   page,
  229 |   browser,
  230 | }) => {
  231 |   test.setTimeout(180000);
  232 |   const errors = [];
  233 |   page.on("pageerror", (e) => errors.push(e.message));
  234 |   const childA = await login(page, "会展家长A合成儿童");
  235 |   await page.goto(base + "/#companion");
  236 |   await page.locator("[data-action=companion-exploration]").click();
  237 |   await expect(page.locator("#consent-check")).toBeVisible();
  238 |   await page.locator("#consent-check").check();
  239 |   await page.locator("[data-action=agree-assessment]").click();
  240 |   await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
  241 |   const savedSession = page.url().split("/").pop();
  242 |   for (let i = 1; i <= 4; i++) {
  243 |     await expect(
  244 |       page.getByText(`第 ${i} / 4 题`, { exact: false }),
  245 |     ).toBeVisible();
  246 |     await page.locator("#answer-form input[name=answer]").first().check();
  247 |     await page.locator("#answer-form button[type=submit]").click();
  248 |   }
  249 |   await page.locator("[data-action=complete-exploration]").click();
  250 |   await expect(page.locator(".guidance-summary")).toBeVisible();
  251 |   // A owns a real CA report, generated by the worker before any robot binding.
  252 |   await page.goto(base + "/#reports");
  253 |   await page.getByRole("button", { name: "开始测评", exact: true }).click();
  254 |   await expect(page.locator("#consent-check:visible, #answer-form:visible")).toBeVisible();
  255 |   if (await page.locator("#consent-check").isVisible()) {
  256 |     await page.getByLabel("我已阅读并同意本次测评用途").check();
  257 |     await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  258 |   }
  259 |   for (let i = 1; i <= 22; i++) {
  260 |     await expect(
  261 |       page.getByText(new RegExp("第 " + i + " / 22 题")),
  262 |     ).toBeVisible();
  263 |     await page.getByRole("radio").first().check();
  264 |     await page
  265 |       .getByRole("button", {
  266 |         name: i === 22 ? "保存并完成" : "保存并下一题",
  267 |         exact: true,
  268 |       })
  269 |       .click();
  270 |   }
  271 |   await page.getByRole("button", { name: "生成演示报告", exact: true }).click();
  272 |   await expect(
  273 |     page.getByRole("button", { name: "查看初始报告", exact: true }),
  274 |   ).toBeVisible({ timeout: 180000 });
  275 |   const caReportId = (await api(page, `/children/${childA}/reports`)).items[0]
  276 |     .id;
  277 |   const token = "SYNTHETIC-CLOSED-LOOP-NFC";
  278 |   const firstResponse = await bind(page, token);
> 279 |   expect(firstResponse.status()).toBe(201);
      |                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  280 |   const first = await firstResponse.json();
  281 |   expect(first.is_prototype_demo).toBe(true);
  282 |   expect(first.bind_state).toBe("unbound");
  283 |   await expect(page.locator(".account-row")).toContainText("待接通");
  284 |   await page.goto(base + "/#reports");
  285 |   await expect(page.locator("#dingdong-growth-report")).toContainText(
  286 |     "等待连接",
  287 |   );
  288 |   boundFixture(childA, first.ca_account_id);
  289 |   await page.reload();
  290 |   await expect(page.locator("#dingdong-growth-report")).toContainText(
  291 |     "同意查看机器人记录",
  292 |   );
  293 |   await grantRobot(page, childA);
  294 |   await page.reload();
  295 |   await expect(page.locator("#dingdong-growth-report")).toContainText(
  296 |     "暂时无法读取",
  297 |   );
  298 |   await expect(
  299 |     page.getByRole("button", { name: "开始测评", exact: true }),
  300 |   ).toBeVisible();
  301 |   for (const weekly of [3, 7, 14, 21]) await signedPush(page, weekly, 6);
  302 |   await page.locator("[data-action=dingdong-report-refresh]").click();
  303 |   await expect(page.locator(".dd-report-summary")).toContainText("6");
  304 |   for (const weekly of [3, 14, 21, 7]) {
  305 |     await page
  306 |       .locator(`[data-action=dingdong-weekly-turns][data-value="${weekly}"]`)
  307 |       .click();
  308 |     await expect(
  309 |       page.locator(
  310 |         `[data-action=dingdong-weekly-turns][data-value="${weekly}"]`,
  311 |       ),
  312 |     ).toHaveAttribute("aria-pressed", "true");
  313 |     const view = await api(
  314 |       page,
  315 |       `/children/${childA}/prototype-demo?weekly_turns=${weekly}`,
  316 |     );
  317 |     expect(view.weekly_turns).toBe(weekly);
  318 |     expect(view.sync_source).toBe("push");
  319 |   }
  320 |   for (const width of [320, 390, 768, 1280]) {
  321 |     await page.setViewportSize({ width, height: 900 });
  322 |     await page.locator("#dingdong-growth-report").scrollIntoViewIfNeeded();
  323 |     expect(
  324 |       await page.evaluate(
  325 |         () => document.documentElement.scrollWidth - innerWidth,
  326 |       ),
  327 |     ).toBeLessThanOrEqual(1);
  328 |     await shot(page, "dingdong-report-" + width);
  329 |   }
  330 |   await page.setViewportSize({ width: 390, height: 844 });
  331 |   await page.locator(".dd-report-trend").scrollIntoViewIfNeeded();
  332 |   await shot(page, "dingdong-curve-390");
  333 |   await signedPush(page, 7, 33);
  334 |   await page.locator("[data-action=dingdong-report-refresh]").click();
  335 |   await expect(page.locator(".dd-report-summary")).toContainText("33");
  336 |   const ctx = await browser.newContext();
  337 |   const other = await ctx.newPage();
  338 |   try {
  339 |     const childB = await login(other, "会展家长B合成儿童");
  340 |     const occupied = await bind(other, token);
  341 |     expect(occupied.status()).toBe(409);
  342 |     await expect(other.locator("#dialog .form-error")).toContainText(
  343 |       "原绑定家长先解绑",
  344 |     );
  345 |     await expect(other.locator("#dialog [data-action=refresh]")).toHaveCount(0);
  346 |     await page.goto(base + "/#settings");
  347 |     await expect(page.locator("[data-action=retire-account]")).toHaveText(
  348 |       "解绑机器人",
  349 |     );
  350 |     await page.locator("[data-action=retire-account]").click();
  351 |     await expect(page.locator("#dialog")).toContainText(
  352 |       "探索、活动和测评报告会保留",
  353 |     );
  354 |     await shot(page, "demo-unbind-confirm-390");
  355 |     await page.getByRole("button", { name: "确认解绑", exact: true }).click();
  356 |     await expect(page.locator(".account-row")).toContainText("已归档");
  357 |     await page.goto(base + "/#reports");
  358 |     await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
  359 |     expect((await api(page, "/assessments/" + savedSession)).status).toBe(
  360 |       "completed",
  361 |     );
  362 |     expect((await api(page, "/reports/" + caReportId)).child_id).toBe(childA);
  363 |     const lost = await page.evaluate(async (child) => {
  364 |       const api = await import("./api.js");
  365 |       try {
  366 |         await api.request(`/children/${child}/prototype-demo`);
  367 |         return 200;
  368 |       } catch (e) {
  369 |         return e.status;
  370 |       }
  371 |     }, childA);
  372 |     expect(lost).toBe(404);
  373 |     await other.getByRole("button", { name: "确认绑定", exact: true }).click();
  374 |     await expect(other.locator(".account-row")).toContainText("待接通");
  375 |     const second = (await api(other, `/children/${childB}/ca-accounts`))
  376 |       .items[0];
  377 |     expect(second.ca_account_id).not.toBe(first.ca_account_id);
  378 |     expect(second.is_prototype_demo).toBe(true);
  379 |     expect(second.bind_state).toBe("unbound");
```