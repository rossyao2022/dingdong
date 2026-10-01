# Adapt CA companion entry contract

## Approved scope

2026-10-01: CA implements the other DINGDONG team's fixed-account prototype change. User approved the minimal integration adaptation with “可以，那你改吧”. Baseline: ca-main / c688e29 / VERSION 0.3.26 in the dot cloud checkout only.

## Requirements

- All existing companion entry points say `进入 DINGDONG 天赋陪伴空间` and navigate in a new tab to the configured safe URL, whose supplied default is `https://www.dingdongrobo.top/dingdong/companion/main`.
- No iframe, phone, CA cookie, NFC token, JWT, or launch code is sent in the navigation. Supplier owns its shared `ca_dingdong` web session.
- Backend insights remain GET `/api/v1/ca/prototype/insights`, fixed `ca_account_id=ca_dingdong`, default `weekly_turns=7`, existing `X-API-Key` from backend `DINGDONG_API_KEY`.
- Preserve explicit URL overrides, demo gating, login/family/NFC/consent protections, bound/unbound entry visibility, 3/7/14/21 selection and cached-first/manual-refresh report behavior.
- No external vendor calls, credentials access, commits, remotes/hooks changes, pushes, merges, production writes or deployment.

## Acceptance

- Regression tests prove exact label, URL safety and unchanged visibility; configuration tests prove defaults and overrides.
- Frontend syntax and complete unit suite pass; run feasible backend/config checks and distinguish any unrun checks.
- Real local Chromium component verification covers desktop, mobile and tablet, complete link text and safe destination, bound/unbound/pending/unknown, and existing report rendering. It is not authenticated API E2E or real vendor acceptance.
- Document changed files, evidence and production configuration that remains to be applied separately.

## Verified environment limit

No backend virtualenv, Django/pytest, PostgreSQL/Redis or frontend node_modules exists here. Python is 3.12, whereas the project requires 3.14. Existing Python Playwright and Chromium are available. Parent approved continuing available checks and component browser acceptance without installing a full backend stack.

## Change boundary

Only entry labels, the public web URL default/sample, related regression tests, and integration documentation change. API base remains explicitly configured. Existing explicit old web URLs are not silently overwritten: production operators must set the supplied new URL during a separately authorized rollout. No version/release packaging is performed.

## Mac端到端发布授权（2026-10-01）

用户本轮批准接收、验证、提交、推送origin发布分支和main、同步upstream/ca-main、备份生产部署、上线验收和必要回滚，替代上方dot阶段的未授权发布边界。保留Commander两提交、原未提交审计JSON和非Git材料。完整后端、前端、正常文档门禁及真实Chrome验收均为本轮要求。
