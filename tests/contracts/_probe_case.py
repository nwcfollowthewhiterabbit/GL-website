from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    import tomllib
except ModuleNotFoundError:
    import _toml_compat as tomllib

from _contract import probe_errors, template_contract_test_blocker


def assert_operation_probe(
    testcase: unittest.TestCase,
    operation: str,
) -> None:
    config = tomllib.loads((ROOT / "project.toml").read_text(encoding="utf-8"))
    state = config.get("automation", {}).get("state")
    testcase.assertIn(state, {"scaffold", "configured"})
    blocker = template_contract_test_blocker(state)
    if blocker:
        testcase.fail(blocker)
    with tempfile.TemporaryDirectory() as temporary:
        working = Path(temporary)
        sentinel = working / "sentinel"
        sentinel.write_text("unchanged", encoding="utf-8")
        before = sorted(path.name for path in working.iterdir())
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / f"{operation}.py"),
                "--contract-probe",
            ],
            cwd=working,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
        testcase.assertEqual(
            probe_errors(
                operation,
                result.returncode,
                result.stdout,
                result.stderr,
                expected_configured=state == "configured",
            ),
            [],
        )
        testcase.assertEqual(
            sorted(path.name for path in working.iterdir()),
            before,
        )
        testcase.assertEqual(sentinel.read_text(encoding="utf-8"), "unchanged")
