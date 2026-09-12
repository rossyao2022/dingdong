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
