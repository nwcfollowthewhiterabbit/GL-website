from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    import tomllib
except ModuleNotFoundError:
    import _toml_compat as tomllib

from _contract import (
    MINIMUM_REQUIRED_PATHS,
    REQUIRED_RUNTIME_OPERATIONS,
    probe_errors,
    repository_contract_errors,
    template_contract_test_blocker,
)
from check_release_readiness import (
    configured_value_gates,
    contract_test_result_errors,
    is_canonical_readiness_document,
    is_placeholder_config_value,
    is_unchecked_release_task,
    marker_labels,
    release_task_issue,
    run_operation_contract_test,
)
from check_repository import manifest_data_errors


class ImmutableContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.contract = tomllib.loads(
            (ROOT / "repository-contract.toml").read_text(encoding="utf-8")
        )

    def test_runtime_operation_list_cannot_be_emptied(self) -> None:
        changed = copy.deepcopy(self.contract)
        changed["runtime_operations"] = []
        self.assertTrue(repository_contract_errors(changed))

    def test_runtime_operation_list_must_have_exact_order_and_members(self) -> None:
        changed = copy.deepcopy(self.contract)
        changed["runtime_operations"] = list(reversed(REQUIRED_RUNTIME_OPERATIONS))
        self.assertTrue(repository_contract_errors(changed))

    def test_required_paths_cannot_drop_runtime_script(self) -> None:
        changed = copy.deepcopy(self.contract)
        changed["required_paths"].remove("scripts/backup.py")
        self.assertTrue(repository_contract_errors(changed))

    def test_contract_rejects_duplicate_entries(self) -> None:
        changed = copy.deepcopy(self.contract)
        changed["required_paths"].append(changed["required_paths"][0])
        self.assertTrue(repository_contract_errors(changed))

    def test_manifest_requires_safe_baseline_snapshot(self) -> None:
        files = {
            path: "0" * 64
            for path in MINIMUM_REQUIRED_PATHS
            if path != ".template-manifest.json"
        }
        valid = {
            "schema_version": 1,
            "template_version": "1.0.0",
            "files": files,
        }
        self.assertEqual(manifest_data_errors(valid), [])
        unsafe = copy.deepcopy(valid)
        unsafe["files"]["../escape"] = "0" * 64
        self.assertTrue(manifest_data_errors(unsafe))
        invalid_hash = copy.deepcopy(valid)
        invalid_hash["files"]["README.md"] = "not-a-hash"
        self.assertTrue(manifest_data_errors(invalid_hash))


class ReadinessMarkerTests(unittest.TestCase):
    def test_all_blocking_marker_forms_are_recognized(self) -> None:
        samples = (
            "TODO(project)",
            "[ЗАПОЛНИТЬ]",
            "[ЗАПОЛНИТЬ: відповідального]",
            "[ЗАПОЛНИТЬ SLI]",
            "[ЗАПОЛНИТЬ без значений]",
            "[ЗАПОЛНИТЬ проверяемый результат]",
            "[ЗАПОЛНИТЬ способ без секретов]",
            "[ЗАПОЛНИТЬ только имя/путь]",
            "[НЕ ПРОВЕРЕНО]",
            "[НЕ ПРОВОДИЛСЯ]",
            "NOT CONFIGURED",
            "STATUS: TEMPLATE",
            "P0/P1/P2",
            "P0 / P1 / P2",
            "planned / partial / verified",
            "да/нет",
            "да / нет",
        )
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertTrue(marker_labels(sample))

    def test_canonical_scope_and_explicit_exclusions(self) -> None:
        included = (
            "README.md",
            "CHANGELOG.md",
            "docs/01-discovery/open-questions.md",
            "docs/01-discovery/sources/README.md",
            "docs/05-decisions/ADR-0001.md",
            "docs/07-quality/test-strategy.md",
            "infra/README.md",
            "src/README.md",
            "tests/ui/README.md",
        )
        excluded = (
            "AGENTS.md",
            "docs/01-discovery/sources/interview.md",
            "docs/templates/feature-spec.md",
            "docs/08-operations/releases.md",
        )
        for path in included:
            self.assertTrue(is_canonical_readiness_document(path), path)
        for path in excluded:
            self.assertFalse(is_canonical_readiness_document(path), path)

    def test_release_critical_documents_reject_open_task_boxes(self) -> None:
        critical_documents = (
            "docs/00-project/current-scope.md",
            "docs/02-processes/golden-path.md",
            "docs/07-quality/acceptance-guide.md",
            "docs/08-operations/release-checklist.md",
            "docs/user-manual.md",
        )
        for path in critical_documents:
            with self.subTest(path=path):
                self.assertTrue(
                    is_unchecked_release_task(path, "- [ ] Проверить результат.")
                )
                self.assertFalse(
                    is_unchecked_release_task(path, "- [x] Результат проверен.")
                )
                self.assertFalse(
                    is_unchecked_release_task(
                        path,
                        "- Не применяется: компонент отсутствует в этом релизе.",
                    )
                )
                self.assertIsNotNone(
                    release_task_issue(path, "- [x] N/A: не проверялось.")
                )
                self.assertIsNone(
                    release_task_issue(
                        path,
                        "- Не применяется: компонент отсутствует в этом релизе.",
                    )
                )
        self.assertFalse(
            is_unchecked_release_task(
                "docs/06-roadmap/backlog.md",
                "- [ ] Допустимая будущая задача.",
            )
        )

    def test_configured_strings_reject_placeholder_prefixes(self) -> None:
        placeholders = (
            "TODO later",
            "TBD: choose target",
            "UNASSIGNED owner",
            "UNCONFIGURED-runtime",
            "UNKNOWN...",
            "N/A",
            "N / A: not selected",
        )
        for value in placeholders:
            with self.subTest(value=value):
                self.assertTrue(is_placeholder_config_value(value))

        legitimate = (
            "Today Logistics",
            "Todoist integration",
            "TBDomain service",
            "Unknowns register",
            "Unassignedly named example",
            "Configured runtime",
        )
        for value in legitimate:
            with self.subTest(value=value):
                self.assertFalse(is_placeholder_config_value(value))

    def test_configured_value_gate_uses_prefix_detection(self) -> None:
        config = {
            "automation": {"state": "configured", "runtime_ready": True},
            "acceptance": {"owner": "TODO later"},
            "runtime": {
                "kind": "service",
                "access_description": "Private test environment",
            },
            "project": {"name": "Product", "goal": "Verified result"},
            "source": {"repository": "owner/product", "branch": "main"},
        }
        self.assertIn(
            "acceptance.owner must be configured",
            configured_value_gates(config),
        )

    def test_probe_protocol_rejects_extra_fields(self) -> None:
        payload = (
            '{"configured":false,"contract_version":"1.0","extra":true,'
            '"operation":"backup","reason":"not ready","status":"blocked"}'
        )
        self.assertTrue(
            probe_errors(
                "backup",
                78,
                payload,
                "",
                expected_configured=False,
            )
        )

    def test_generic_probe_wrapper_cannot_certify_configured_runtime(self) -> None:
        self.assertIn(
            "implementation-specific",
            template_contract_test_blocker("configured"),
        )
        self.assertEqual(template_contract_test_blocker("scaffold"), "")

    def test_trivial_or_empty_test_cannot_certify_without_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            evidence_path = Path(temporary) / "evidence.json"
            trivial = contract_test_result_errors(
                "backup",
                0,
                "Ran 1 test in 0.001s\n\nOK\n",
                evidence_path,
                "contract-backup-current",
            )
            self.assertTrue(trivial)
            self.assertTrue(
                any("FOUNDATION_CONTRACT_EVIDENCE_PATH" in item for item in trivial)
            )
            empty = contract_test_result_errors(
                "backup",
                0,
                "Ran 0 tests in 0.000s\n\nOK\n",
                evidence_path,
                "contract-backup-current",
            )
            self.assertTrue(any("did not execute any tests" in item for item in empty))

            evidence_path.write_text(
                json.dumps(
                    {
                        "contract_version": "1.0",
                        "operation": "validate_instance",
                        "run_id": "contract-validate-instance-current",
                        "environment": "isolated-contract-test",
                        "target": "temporary-instance",
                        "source_revision": "0123456789abcdef",
                        "status": "passed",
                        "started_at": "2026-07-23T10:00:00+00:00",
                        "finished_at": "2026-07-23T10:01:00+00:00",
                        "checks": [
                            {"name": "normal invocation", "status": "passed"}
                        ],
                        "test_run_reference": "isolated-RUN-20260723-001",
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(
                contract_test_result_errors(
                    "validate_instance",
                    0,
                    "Ran 1 test in 0.001s\n\nOK\n",
                    evidence_path,
                    "contract-validate-instance-current",
                ),
                [],
            )

    def test_contract_test_rejects_stale_run_id_and_nonexecuted_outcomes(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            evidence_path = Path(temporary) / "evidence.json"
            evidence_path.write_text(
                json.dumps(
                    {
                        "contract_version": "1.0",
                        "operation": "validate_instance",
                        "run_id": "contract-validate-instance-stale",
                        "environment": "isolated-contract-test",
                        "target": "temporary-instance",
                        "source_revision": "0123456789abcdef",
                        "status": "passed",
                        "started_at": "2026-07-23T10:00:00+00:00",
                        "finished_at": "2026-07-23T10:01:00+00:00",
                        "checks": [
                            {"name": "normal invocation", "status": "passed"}
                        ],
                        "test_run_reference": "isolated-current-run",
                    }
                ),
                encoding="utf-8",
            )
            for summary in (
                "OK (skipped=1)",
                "OK (expected failures=1)",
                "FAILED (unexpected successes=1)",
            ):
                with self.subTest(summary=summary):
                    failures = contract_test_result_errors(
                        "validate_instance",
                        0,
                        f"Ran 1 test in 0.001s\n\n{summary}\n",
                        evidence_path,
                        "contract-validate-instance-current",
                    )
                    self.assertTrue(
                        any("unittest reported" in item for item in failures)
                    )
                    self.assertTrue(
                        any("run_id does not match" in item for item in failures)
                    )

    def test_contract_test_receives_fresh_run_id_in_environment(self) -> None:
        entropy = "ab" * 16
        expected_run_id = f"contract-backup-{entropy}"
        completed = mock.Mock(
            returncode=0,
            stdout="Ran 1 test in 0.001s\n\nOK\n",
            stderr="",
        )
        with (
            mock.patch(
                "check_release_readiness.secrets.token_hex",
                return_value=entropy,
            ),
            mock.patch(
                "check_release_readiness.subprocess.run",
                return_value=completed,
            ) as runner,
            mock.patch(
                "check_release_readiness.contract_test_result_errors",
                return_value=[],
            ) as result_gate,
        ):
            self.assertEqual(run_operation_contract_test("backup"), [])

        environment = runner.call_args.kwargs["env"]
        self.assertEqual(
            environment["FOUNDATION_CONTRACT_RUN_ID"],
            expected_run_id,
        )
        self.assertEqual(
            result_gate.call_args.args[-1],
            expected_run_id,
        )


if __name__ == "__main__":
    unittest.main()
