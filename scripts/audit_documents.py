"""Rebuild current code-derived documentation and audit local archived materials. No business writes."""

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
DATE = datetime.now().astimezone().date().isoformat()
SKIP = {".git", ".venv", "node_modules", "staticfiles", "test-results", "参考代码"}


def put(path, value):
    (ROOT / path).write_text(value.replace("2026-09-12", DATE), encoding="utf-8")


def cell(value):
    return str(value).replace("|", "\\|").replace("\n", " ")


def schema_name(schema):
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    if schema.get("type") == "array":
        return "array[" + schema_name(schema.get("items", {})) + "]"
    return str(
        schema.get(
            "type", " / ".join(k for k in ["oneOf", "anyOf", "allOf"] if k in schema) or "object"
        )
    )


def generate():
    spec = json.loads((ROOT / "设计/API/openapi.json").read_text())
    out = [
        "# 当前 API 请求响应与字段字典",
        "",
        "由 scripts/audit_documents.py 从当前 OpenAPI 生成（2026-09-12）。以实际代码及通过的契约测试核验实现；本文件不把内部接口称为 DingDong 已确认协议。所有路径前缀为 `/api/v1`。",
        "",
        "## 接口目录",
        "",
        "| 方法 | 路径 | 用途 |",
        "| --- | --- | --- |",
    ]
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if method not in {"get", "post", "patch", "put", "delete", "options", "head"}:
                continue
            out.append(f"| {method.upper()} | `{path}` | {cell(op.get('summary', ''))} |")
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if method not in {"get", "post", "patch", "put", "delete", "options", "head"}:
                continue
            out += [
                "",
                f"## {method.upper()} {path}",
                "",
                op.get("summary", ""),
                "",
                f"operationId：`{op.get('operationId', '')}`。",
                "",
            ]
            for param in op.get("parameters", []):
                out.append(
                    f"- 参数 `{param.get('name')}`（{param.get('in')}，{'必填' if param.get('required') else '选填'}）：{schema_name(param.get('schema', {}))}。{param.get('description', '')}"
                )
            for media, body in op.get("requestBody", {}).get("content", {}).items():
                out.append(f"- 请求 `{media}`：`{schema_name(body.get('schema', {}))}`。")
                if "$ref" not in body.get("schema", {}):
                    out += [
                        "",
                        "```json",
                        json.dumps(body.get("schema", {}), ensure_ascii=False, indent=2),
                        "```",
                    ]
            out += ["", "| 响应状态 | 说明 | 内容 |", "| --- | --- | --- |"]
            for status, res in op.get("responses", {}).items():
                detail = "；".join(
                    f"{media}: {schema_name(body.get('schema', {}))}"
                    for media, body in res.get("content", {}).items()
                )
                out.append(f"| {status} | {cell(res.get('description', ''))} | {cell(detail)} |")
    for name, schema in spec["components"]["schemas"].items():
        out += [
            "",
            f"## Schema：{name}",
            "",
            schema.get("description", ""),
            "",
            "| 字段 | 类型 | 必填 | 说明 |",
            "| --- | --- | --- | --- |",
        ]
        for field, definition in schema.get("properties", {}).items():
            desc = definition.get("description", "")
            if "enum" in definition:
                desc += " 可选值：" + json.dumps(definition["enum"], ensure_ascii=False)
            out.append(
                f"| `{field}` | {cell(schema_name(definition))} | {'是' if field in schema.get('required', []) else '否'} | {cell(desc)} |"
            )
    put("设计/API/请求响应与字段字典_V0.1.md", "\n".join(out) + "\n")
    sys.path.insert(0, str(ROOT / "backend"))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    import django

    django.setup()
    from django.apps import apps

    out = [
        "# 当前数据库模型字段清单",
        "",
        "由 scripts/audit_documents.py 根据 Django 模型元数据生成（2026-09-12），不读取家庭业务数据。以迁移文件为数据库落地依据；跨家庭鉴权、发布冻结和任务状态转换还由服务层负责。早期逻辑设计中的 content_digest、provider 等字段不能视为已落库字段。",
        "",
    ]
    for model in sorted(
        (m for m in apps.get_models() if m._meta.app_label in {"core", "users", "testsupport"}),
        key=lambda m: m._meta.db_table,
    ):
        out += [
            f"## {model._meta.db_table}（{model.__name__}）",
            "",
            "| 字段 | 类型 | 允许 NULL | 关联 |",
            "| --- | --- | --- | --- |",
        ]
        for field in model._meta.local_fields:
            typ = field.get_internal_type() + (f"({field.max_length})" if field.max_length else "")
            rel = field.related_model._meta.db_table if field.is_relation else ""
            out.append(f"| `{field.column}` | {typ} | {'是' if field.null else '否'} | {rel} |")
        out += [
            "",
            "模型约束："
            + (
                "；".join(f"`{c.name}`：{cell(str(c))}" for c in model._meta.constraints)
                or "见字段唯一性与迁移。"
            ),
            "",
        ]
    put("设计/数据库实际字段_M5.md", "\n".join(out) + "\n")


def audit():
    errors = []
    docs = []
    links = 0
    for path in ROOT.rglob("*.md"):
        if any(x in SKIP for x in path.relative_to(ROOT).parts):
            continue
        docs.append(str(path.relative_to(ROOT)))
        for target in re.findall(r"(?<!!)\[[^\]\n]*\]\(([^\n]+?)\)", path.read_text()):
            target = unquote(target.strip().strip("<>"))
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            target = target.split("#")[0]
            target = re.sub(r":\d+$", "", target)
            dest = Path(target) if target.startswith("/") else path.parent / target
            links += 1
            if not dest.exists():
                errors.append(
                    {"kind": "local_link", "file": str(path.relative_to(ROOT)), "target": target}
                )
    manifest = json.loads((ROOT / "材料/原始数据/归档校验.json").read_text())
    attachments = []
    for row in manifest["attachments"]:
        path = ROOT / "材料/附件" / row["name"]
        good = (
            path.exists()
            and hashlib.sha256(path.read_bytes()).hexdigest() == row["sha256"]
            and path.stat().st_size == row["bytes"]
        )
        zip_ok = False
        if good:
            with zipfile.ZipFile(path) as z:
                zip_ok = z.testzip() is None
        attachments.append({"name": row["name"], "hash_and_size_match": good, "zip_ok": zip_ok})
        if not good or not zip_ok:
            errors.append({"kind": "attachment", "file": row["name"]})
    archived = 0
    for row in manifest.get("files", []):
        path = ROOT / row["path"]
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != row["sha256"]:
            errors.append({"kind": "archive_hash", "file": row["path"]})
        archived += 1
    sheets = []
    for book, rows in manifest["workbooks"].items():
        for row in rows:
            path = ROOT / "材料/可检索文本" / Path(book).stem / (row["name"] + ".csv")
            ok = path.exists() and path.stat().st_size > 0
            dimensions = False
            if ok:
                with path.open() as stream:
                    csv_rows = list(csv.reader(stream))
                dimensions = (
                    len(csv_rows) == row["rows"]
                    and max(map(len, csv_rows), default=0) == row["columns"]
                )
            sheets.append(
                {
                    "workbook": book,
                    "sheet": row["name"],
                    "csv_exists": ok,
                    "dimensions_match": dimensions,
                }
            )
            if not dimensions:
                errors.append({"kind": "worksheet_dimensions", "file": str(path.relative_to(ROOT))})
            if not ok:
                errors.append({"kind": "worksheet", "file": str(path)})
    extracted = []
    for row in manifest["attachments"]:
        path = ROOT / "材料/可检索文本" / (Path(row["name"]).stem + ".md")
        ok = path.exists() and path.stat().st_size > 0
        result = {"source": row["name"], "text_exists": ok}
        if ok and row["name"].endswith(".docx"):
            with zipfile.ZipFile(ROOT / "材料/附件" / row["name"]) as archive:
                xml = ET.fromstring(archive.read("word/document.xml"))
            pieces = [
                node.text
                for node in xml.iter(
                    "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"
                )
                if node.text and node.text.strip()
            ]

            def normalize(text):
                return re.sub(r"\s+", "", text.replace("\\|", "|"))

            corpus = normalize(path.read_text())
            missing = sum(normalize(piece) not in corpus for piece in pieces)
            result.update(word_text_segments=len(pieces), missing_segments=missing)
            if missing:
                errors.append(
                    {
                        "kind": "word_text_segments",
                        "file": str(path.relative_to(ROOT)),
                        "missing": missing,
                    }
                )
        extracted.append(result)
        if not ok:
            errors.append({"kind": "extracted_text", "file": str(path)})
    spec = json.loads((ROOT / "设计/API/openapi.json").read_text())
    ops = []
    refs = []

    def walk(value):
        if isinstance(value, dict):
            if "$ref" in value:
                refs.append(value["$ref"])
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for v in value:
                walk(v)

    walk(spec)
    for ref in refs:
        if ref.startswith("#/"):
            value = spec
            try:
                for part in ref[2:].split("/"):
                    value = value[part.replace("~1", "/").replace("~0", "~")]
            except KeyError, TypeError:
                errors.append({"kind": "schema_ref", "ref": ref})
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if method not in {"get", "post", "patch", "put", "delete", "options", "head"}:
                continue
            ident = op.get("operationId")
            if not ident or ident in ops:
                errors.append({"kind": "operation_id", "id": ident})
            ops.append(ident)
            expected = set(re.findall(r"\{([^}]+)\}", path))
            actual = {
                p["name"]
                for p in op.get("parameters", [])
                if p.get("in") == "path" and p.get("required")
            }
            if expected != actual:
                errors.append({"kind": "path_parameters", "path": path})
    result = {
        "date": "2026-09-12",
        "scope": "本地文档链接、原始归档哈希/ZIP、提取产物、OpenAPI 引用与 operationId/路径参数；不验证远端链接、Office 版式或真实供应商协议。",
        "markdown_files": len(docs),
        "local_links_checked": links,
        "archived_files_checked": archived,
        "attachments": attachments,
        "worksheets": sheets,
        "extracted_texts": extracted,
        "operations": len(ops),
        "schemas": len(spec["components"]["schemas"]),
        "errors": errors,
        "documents": docs,
    }
    put("文档/文档校验结果.json", json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    put(
        "设计/API/契约检查结果.json",
        json.dumps(
            {k: result[k] for k in ["date", "scope", "operations", "schemas"]}
            | {
                "errors": [
                    e
                    for e in errors
                    if e["kind"] in {"schema_ref", "operation_id", "path_parameters"}
                ]
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
    )
    print(
        json.dumps(
            {
                k: result[k]
                for k in [
                    "markdown_files",
                    "local_links_checked",
                    "archived_files_checked",
                    "operations",
                    "schemas",
                    "errors",
                ]
            },
            ensure_ascii=False,
        )
    )
    return bool(errors)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    args = parser.parse_args()
    if args.generate:
        generate()
    sys.exit(audit())
