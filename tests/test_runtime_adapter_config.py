from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from _runtime_adapter import (  # noqa: E402
    DEPLOY_SCRIPT,
    OPERATIONS,
    RESTORE_EXECUTE_SCRIPT,
    backup_reference_for,
    contract_test_evidence,
    load_config,
    restore_plan_reference_for,
    utc_now,
    verify_ci,
)
from validate_evidence import evidence_errors  # noqa: E402


class RuntimeAdapterConfigurationTests(unittest.TestCase):
    def test_config_is_pinned_to_testing_target(self) -> None:
        config = load_config()
        self.assertEqual(config["environment"], "testing")
        self.assertEqual(config["target"], "testing.greenleafpacific.com")
        self.assertEqual(config["branch"], "main")
        self.assertNotIn("erp", " ".join(config["compose_services"]).lower())

    def test_every_operation_contract_evidence_is_valid(self) -> None:
        config = load_config()
        for operation in sorted(OPERATIONS):
            with self.subTest(operation=operation):
                payload = contract_test_evidence(
                    operation,
                    config,
                    f"GL-WEB-CONTRACT-{operation}",
                    utc_now(),
                )
                self.assertEqual(evidence_errors(payload, operation), [])

    def test_restore_script_enforces_backup_root_and_one_time_plan(self) -> None:
        self.assertIn('case "$plan" in "$backup_root"/restore-plans/*)', RESTORE_EXECUTE_SCRIPT)
        self.assertIn('plan.get("used")', RESTORE_EXECUTE_SCRIPT)
        self.assertIn('sha256sum "$archive"', RESTORE_EXECUTE_SCRIPT)
        self.assertIn('member.name.startswith("public/uploads/")', RESTORE_EXECUTE_SCRIPT)
        self.assertIn("member.issym()", RESTORE_EXECUTE_SCRIPT)
        self.assertIn('rm -f "$repo/.env"', RESTORE_EXECUTE_SCRIPT)

    def test_deploy_builds_then_migrates_then_starts_containers(self) -> None:
        build = DEPLOY_SCRIPT.index('"$compose" -f "$repo/docker-compose.yml" build')
        migrate = DEPLOY_SCRIPT.index("npm run erpnext:migrate-website")
        start = DEPLOY_SCRIPT.index('"$compose" -f "$repo/docker-compose.yml" up -d --no-build')
        self.assertIn("run --rm -T api", DEPLOY_SCRIPT)
        self.assertIn('npm run erpnext:migrate-website >&2', DEPLOY_SCRIPT)
        self.assertLess(build, migrate)
        self.assertLess(migrate, start)

    def test_ci_verification_requires_exact_successful_sha(self) -> None:
        sha = "a" * 40
        with patch(
            "_runtime_adapter.run",
            return_value=(
                f'[{{"status":"completed","conclusion":"success",'
                f'"headSha":"{sha}","url":"https://example.test/run"}}]'
            ),
        ):
            self.assertEqual(verify_ci(sha), "https://example.test/run")
        with patch("_runtime_adapter.run", return_value="[]"):
            with self.assertRaises(RuntimeError):
                verify_ci(sha)

    def test_runtime_references_cannot_escape_configured_roots(self) -> None:
        config = load_config()
        backup = f"{config['backup_root']}/GL-WEB-20260724T120000Z"
        plan = f"{config['backup_root']}/restore-plans/GL-WEB-20260724T120000Z.json"
        self.assertEqual(backup_reference_for(config, backup), backup)
        self.assertEqual(restore_plan_reference_for(config, plan), plan)
        with self.assertRaises(ValueError):
            backup_reference_for(config, f"{config['backup_root']}/../erp")
        with self.assertRaises(ValueError):
            restore_plan_reference_for(config, f"{config['backup_root']}/restore-plans/a;touch-x.json")


if __name__ == "__main__":
    unittest.main()
