from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from check_repository import (
    action_reference_is_pinned,
    check_workflows,
    forbidden_path_reason,
    secret_text_findings,
    workflow_yaml_syntax_errors,
)


class SecurityScannerTests(unittest.TestCase):
    def test_forbidden_secret_paths(self) -> None:
        for path in (
            Path(".env.production"),
            Path("config/.env.local"),
            Path("credentials/access.json"),
            Path("secrets/runtime.txt"),
            Path(".docker/config.json"),
            Path(".netrc"),
            Path("config/api-token.json"),
            Path("config/passwords.txt"),
            Path("config/tokens.yaml"),
            Path("keys/private.key"),
        ):
            with self.subTest(path=path):
                self.assertTrue(forbidden_path_reason(path))
        self.assertFalse(forbidden_path_reason(Path(".env.example")))
        self.assertFalse(forbidden_path_reason(Path("docs/token-policy.md")))

    def test_embedded_secret_shapes_are_detected(self) -> None:
        samples = (
            "database_password" + " = " + "actual-value-for-runtime",
            "api_token_value" + ": " + "actual-value-for-runtime",
            "- password" + ": " + "actual-secret-value",
            "runtime password" + "=" + "actual-secret-value",
            "https://" + "operator@" + "example.invalid/path",
            "-----BEGIN " + "PRIVATE KEY-----",
            "gh" + "p_" + "A" * 36,
            "gl" + "pat-" + "A" * 24,
            "AK" + "IA" + "A" * 16,
            "AS" + "IA" + "A" * 16,
            "xo" + "xb-" + "A" * 20,
            "sk_" + "live_" + "A" * 24,
            "rk_" + "live_" + "A" * 24,
            "eyJ" + "A" * 12 + "." + "B" * 12 + "." + "C" * 12,
            "https://example.invalid/path?access_token="
            + "correct-horse-battery",
            "//registry.example.invalid/:_authToken="
            + "correct-horse-battery",
            "machine example.invalid login demo password "
            + "correct-horse-battery",
            "runtime access uses password=" + "actual-secret",
            'password="' + "correct horse battery staple" + '"',
            "https://example.invalid/path?access_token=" + "hunter2",
        )
        for sample in samples:
            with self.subTest(sample=sample[:12]):
                self.assertTrue(
                    secret_text_findings(Path("temporary.txt"), sample)
                )

    def test_documented_placeholders_are_allowed(self) -> None:
        samples = (
            "password" + "=",
            "token" + "=<from-managed-store>",
            "secret" + "=${RUNTIME_SECRET}",
            "api_key" + "=CHANGEME",
            "credential" + "=<credential-reference>",
        )
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertEqual(
                    secret_text_findings(Path(".env.example"), sample),
                    [],
                )

    def test_external_actions_require_full_commit_sha(self) -> None:
        self.assertTrue(action_reference_is_pinned("./.github/actions/local"))
        self.assertTrue(
            action_reference_is_pinned("owner/action@" + "a" * 40)
        )
        self.assertFalse(action_reference_is_pinned("owner/action@v4"))
        self.assertFalse(action_reference_is_pinned("owner/action@main"))

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            workflows = root / ".github" / "workflows"
            workflows.mkdir(parents=True)
            (workflows / "unsafe.yaml").write_text(
                "name: Unsafe\n"
                "on: push\n"
                "permissions:\n"
                "  contents: read\n"
                "jobs:\n"
                "  test:\n"
                "    steps:\n"
                "      - uses: owner/action@main\n",
                encoding="utf-8",
            )
            self.assertTrue(check_workflows(root))

    def test_workflow_yaml_sanity_guard(self) -> None:
        self.assertEqual(
            workflow_yaml_syntax_errors(
                'matrix: ["3.9", "3.12"] # balanced flow sequence\n'
                "payload: {'closing': '] is quoted'}\n"
            ),
            [],
        )
        for text, expected in (
            ("broken: [\n", "unclosed flow ["),
            ("broken: {]\n", "does not match"),
            ("\tjobs:\n", "tab used for indentation"),
            ("broken: ]\n", "unexpected closing ]"),
        ):
            with self.subTest(text=text):
                self.assertTrue(
                    any(
                        expected in failure
                        for failure in workflow_yaml_syntax_errors(text)
                    )
                )

    def test_workflow_yaml_sanity_guard_checks_both_extensions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            workflows = root / ".github" / "workflows"
            workflows.mkdir(parents=True)
            valid_prefix = (
                "name: Syntax guard\n"
                "on: push\n"
                "permissions:\n"
                "  contents: read\n"
                "jobs:\n"
                "  test:\n"
            )
            for suffix in (".yml", ".yaml"):
                (workflows / f"broken{suffix}").write_text(
                    valid_prefix + "    broken: [\n",
                    encoding="utf-8",
                )

            failures = check_workflows(root)
            for suffix in (".yml", ".yaml"):
                with self.subTest(suffix=suffix):
                    self.assertTrue(
                        any(
                            f"broken{suffix}" in failure
                            and "unclosed flow [" in failure
                            for failure in failures
                        )
                    )


if __name__ == "__main__":
    unittest.main()
