from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_evidence import evidence_errors


def assert_operation_contract(
    testcase: unittest.TestCase,
    operation: str,
) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        working = Path(temporary)
        sentinel = working / "sentinel"
        evidence_path = Path(
            os.environ.get(
                "FOUNDATION_CONTRACT_EVIDENCE_PATH",
                str(working / "evidence.json"),
            )
        )
        run_id = os.environ.get(
            "FOUNDATION_CONTRACT_RUN_ID",
            f"contract-{operation.replace('_', '-')}-01234567",
        )
        sentinel.write_text("unchanged", encoding="utf-8")
        environment = os.environ.copy()
        environment.update(
            {
                "FOUNDATION_CONTRACT_EVIDENCE_PATH": str(evidence_path),
                "FOUNDATION_CONTRACT_OPERATION": operation,
                "FOUNDATION_CONTRACT_RUN_ID": run_id,
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / f"{operation}.py"),
                "--contract-test",
            ],
            cwd=working,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
        testcase.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        testcase.assertTrue(evidence_path.is_file())
        payload = json.loads(evidence_path.read_text(encoding="utf-8"))
        testcase.assertEqual(evidence_errors(payload, operation), [])
        testcase.assertEqual(payload["run_id"], run_id)
        testcase.assertEqual(payload["status"], "passed")
        testcase.assertEqual(sentinel.read_text(encoding="utf-8"), "unchanged")
