/**
 * 浏览器验收用例共用的工具。
 *
 * Playwright 进程的 PATH 不一定包含 uv（例如从 IDE 或 GUI 启动时），
 * 所以这里显式解析 uv 可执行文件，避免出现 spawnSync uv ENOENT。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "../..");

export function uvBin() {
  if (process.env.UV_BIN) return process.env.UV_BIN;
  const candidates = [
    path.join(os.homedir(), ".local", "bin", "uv"),
    "/opt/homebrew/bin/uv",
    "/usr/local/bin/uv",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "uv";
}

/** 在项目根目录执行一段 Django shell 代码。 */
export function shell(source) {
  return execFileSync(
    uvBin(),
    [
      "run",
      "--no-sync",
      "--directory",
      path.join(root, "backend"),
      "python",
      "manage.py",
      "shell",
      "-c",
      source,
    ],
    { cwd: root, stdio: "pipe" },
  ).toString();
}

/** `shell()` 的 stdout 末行：manage.py shell 会先打印一行 "N objects imported automatically"。 */
function lastLine(output) {
  return output.trim().split("\n").pop().trim();
}

/** CLI 侧 Django 实际连的库标识（host port name），用于把"环境漂移"说清楚。 */
export function cliDatabaseIdentity() {
  return lastLine(
    shell(
      'from django.db import connection; s = connection.settings_dict; print(s["HOST"], s["PORT"], s["NAME"])',
    ),
  );
}

/**
 * CLI 侧读到的已发布「测评数据处理」用途说明 id。
 *
 * 浏览器那侧走 `server.cjs` 代理到 127.0.0.1:8017，CLI 侧走 `manage.py`；两边必须
 * 连同一个库，否则 `inject_fixture` 报「Child does not exist」。这条记录的主键由
 * 各自 seed 生成、逐库不同，所以两侧 id 一致即同一个库。
 */
export function cliPolicyVersionId() {
  return lastLine(
    shell(
      'from dingdong_ca.core.models import PolicyVersion; r = PolicyVersion.objects.filter(purpose="assessment_processing", status="published").first(); print(r.pk if r else "")',
    ),
  );
}
