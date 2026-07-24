from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from _contract import (
    OPERATION_REQUIRED_EVIDENCE_FIELDS,
    REQUIRED_RUNTIME_OPERATIONS,
    strict_json_object,
)
from validate_evidence import evidence_errors, schema_contract_errors


def valid_evidence(operation: str) -> dict:
    payload = {
        "contract_version": "1.0",
        "operation": operation,
        "run_id": "RUN-20260723-001",
        "environment": "staging",
        "target": "application-instance",
        "source_revision": "0123456789abcdef",
        "status": "passed",
        "started_at": "2026-07-23T10:00:00+00:00",
        "finished_at": "2026-07-23T10:01:00+00:00",
        "checks": [{"name": "contract", "status": "passed"}],
    }
    values = {
        "artifact_digest": "sha256:" + "1" * 64,
        "artifacts": [
            {
                "kind": "database",
                "path": ".evidence/backup/database.bin",
                "sha256": "2" * 64,
                "size_bytes": 1024,
                "contains_secrets": True,
                "restore_critical": True,
            }
        ],
        "backup_reference": "backup-RUN-20260723-001",
        "cleanup_status": "completed",
        "release_reference": "release-0123456789abcdef",
        "restore_plan_reference": "restore-plan-RUN-20260723-001",
        "rollback_reference": "rollback-0123456789abcdef",
        "target_precondition_reference": "target-check-RUN-20260723-001",
        "test_run_reference": "test-RUN-20260723-001",
        "tested_roles": ["operator", "supervisor"],
    }
    for field in OPERATION_REQUIRED_EVIDENCE_FIELDS[operation]:
        payload[field] = copy.deepcopy(values[field])
    return payload


class EvidenceValidationTests(unittest.TestCase):
    def test_each_operation_has_valid_passed_evidence(self) -> None:
        for operation in REQUIRED_RUNTIME_OPERATIONS:
            with self.subTest(operation=operation):
                self.assertEqual(evidence_errors(valid_evidence(operation)), [])

    def test_passed_requires_every_check_to_pass(self) -> None:
        payload = valid_evidence("validate_instance")
        payload["checks"].append({"name": "health", "status": "failed"})
        self.assertTrue(evidence_errors(payload))

    def test_operation_specific_fields_are_required(self) -> None:
        for operation in REQUIRED_RUNTIME_OPERATIONS:
            payload = valid_evidence(operation)
            field = OPERATION_REQUIRED_EVIDENCE_FIELDS[operation][0]
            del payload[field]
            with self.subTest(operation=operation, field=field):
                self.assertTrue(evidence_errors(payload))

    def test_whitespace_timestamps_and_unsafe_artifacts_are_rejected(self) -> None:
        payload = valid_evidence("backup")
        payload["target"] = "   "
        payload["finished_at"] = "2026-07-23T09:59:00+00:00"
        payload["artifacts"][0]["path"] = "../outside"
        self.assertGreaterEqual(len(evidence_errors(payload)), 3)

    def test_strict_json_rejects_duplicate_keys(self) -> None:
        duplicate = '{"status":"passed","status":"failed"}'
        with self.assertRaises(ValueError):
            strict_json_object(duplicate)

    def test_schema_itself_matches_authoritative_contract(self) -> None:
        schema = json.loads(
            (ROOT / "contracts" / "evidence.schema.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(schema_contract_errors(schema), [])

    def test_cli_rejects_invalid_evidence_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "evidence.json"
            path.write_text('{"status":"passed"}', encoding="utf-8")
            before = path.read_bytes()
            import subprocess

            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "validate_evidence.py"), str(path)],
                cwd=temporary,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
