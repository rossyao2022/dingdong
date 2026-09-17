"""运营后台的模板公共上下文。

**为什么需要文件版本号**：`collectstatic` 用的是 Django 默认存储，静态文件 URL
不带内容哈希，`/static/ops/ops.css` 这个地址在改版前后完全一样。浏览器会按缓存
策略继续用旧文件，运营上线后看到的还是改版前的界面——这是"改完看不见效果"最
常见的原因。

这里把版本号拼到静态资源的查询串上（`ops.css?v=0.3.6`），版本一变 URL 就变，
缓存自然击穿。查询串不影响 WhiteNoise 对文件的匹配。
"""

import os
from pathlib import Path

_FALLBACK = "dev"


def _app_version() -> str:
    version = os.environ.get("APP_VERSION", "").strip()
    if version:
        return version
    # 本地源码运行（runserver）时没有 compose 注入的 APP_VERSION，回退读仓库 VERSION。
    try:
        text = (Path(__file__).resolve().parents[3] / "VERSION").read_text(encoding="utf-8")
    except OSError:
        return _FALLBACK
    return text.strip() or _FALLBACK


ASSET_VERSION = _app_version()


def ops_assets(request):
    """给所有模板提供静态资源版本号与应用版本号。"""
    return {"ops_asset_version": ASSET_VERSION, "ops_app_version": ASSET_VERSION}
