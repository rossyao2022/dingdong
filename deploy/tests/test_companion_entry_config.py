"""Dependency-free public URL configuration checks; no settings/.env import."""

import ast
import re
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
COMPANION_URL = "https://www.dingdongrobo.top/dingdong/companion/main"


def setting_expression(name):
    tree = ast.parse((ROOT / "backend/config/settings/base.py").read_text())
    return next(
        node.value
        for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == name for target in node.targets)
    )


class CompanionEntryConfigTests(unittest.TestCase):
    def test_public_default_and_explicit_override(self):
        expression = compile(
            ast.Expression(setting_expression("DINGDONG_PROTOTYPE_WEB_URL")),
            "public-url-setting",
            "eval",
        )
        self.assertEqual(eval(expression, {"env": lambda key, default: default}), COMPANION_URL)
        override = "https://supplier.example.test/custom-companion"
        self.assertEqual(eval(expression, {"env": lambda key, default: override}), override)
        self.assertEqual(eval(expression, {"env": lambda key, default: ""}), "")

    def test_compose_and_nonsecret_sample_use_same_destination(self):
        compose = (ROOT / "deploy/compose.yml").read_text()
        self.assertIn(
            "DINGDONG_PROTOTYPE_WEB_URL: ${DINGDONG_PROTOTYPE_WEB_URL:-" + COMPANION_URL + "}",
            compose,
        )
        sample = (ROOT / "backend/.env.example").read_text()
        self.assertRegex(
            sample,
            re.compile(r"^DINGDONG_PROTOTYPE_WEB_URL=" + re.escape(COMPANION_URL) + r"$", re.M),
        )
        self.assertRegex(sample, re.compile(r"^DINGDONG_BASE_URL=$", re.M))
        self.assertIn("DINGDONG_BASE_URL=https://www.dingdongrobo.top", sample)
        self.assertRegex(sample, re.compile(r"^DINGDONG_API_KEY=$", re.M))
        self.assertRegex(
            sample, re.compile(r"^DINGDONG_PROTOTYPE_DEMO_ENABLED=False$", re.M)
        )

    def test_api_connection_and_demo_switch_remain_opt_in(self):
        for name, expected in [
            ("DINGDONG_BASE_URL", ""),
            ("DINGDONG_API_KEY", ""),
            ("DINGDONG_PROTOTYPE_DEMO_ENABLED", False),
        ]:
            expression = setting_expression(name)
            default = next(
                keyword.value for keyword in expression.keywords if keyword.arg == "default"
            )
            self.assertEqual(ast.literal_eval(default), expected)

    def test_actual_url_helpers_preserve_demo_gate_and_safe_overrides(self):
        # Execute only these dependency-free production functions, not Django/.env imports.
        source = ROOT / "backend/dingdong_ca/core/services/ca_account.py"
        names = {"prototype_demo_enabled", "prototype_chat_url"}
        functions = [
            node for node in ast.parse(source.read_text()).body
            if isinstance(node, ast.FunctionDef) and node.name in names
        ]
        self.assertEqual({node.name for node in functions}, names)
        settings = SimpleNamespace(
            APP_ENV="demo", DINGDONG_PROTOTYPE_DEMO_ENABLED=True,
            DINGDONG_PROTOTYPE_WEB_URL=COMPANION_URL,
            DINGDONG_BASE_URL="https://supplier.example.test",
        )
        namespace = {"settings": settings}
        exec(compile(ast.Module(body=functions, type_ignores=[]), str(source), "exec"), namespace)
        chat_url = namespace["prototype_chat_url"]
        self.assertEqual(chat_url(), COMPANION_URL)
        for app_env, enabled in [("development", True), ("production", True), ("demo", False)]:
            settings.APP_ENV, settings.DINGDONG_PROTOTYPE_DEMO_ENABLED = app_env, enabled
            self.assertIsNone(chat_url())
        settings.APP_ENV, settings.DINGDONG_PROTOTYPE_DEMO_ENABLED = "demo", True
        settings.DINGDONG_PROTOTYPE_WEB_URL = "https://supplier.example.test/custom"
        self.assertEqual(chat_url(), settings.DINGDONG_PROTOTYPE_WEB_URL)
        settings.DINGDONG_PROTOTYPE_WEB_URL = ""
        self.assertEqual(chat_url(), settings.DINGDONG_BASE_URL)
        for unsafe in [
            COMPANION_URL + "?phone=synthetic", COMPANION_URL + "#nfc_token=synthetic",
            "https://user:password@supplier.example.test", "javascript:alert(1)",
        ]:
            settings.DINGDONG_PROTOTYPE_WEB_URL = unsafe
            self.assertIsNone(chat_url())


if __name__ == "__main__":
    unittest.main()
