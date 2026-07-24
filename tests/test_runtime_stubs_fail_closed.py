from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OPERATIONS = (
    "backup",
    "deploy_first_instance",
    "deploy_existing_instance",
    "restore",
    "validate_instance",
    "validate_domain",
    "validate_mvp_e2e",
    "validate_ui_e2e",
)


class RuntimeStubTests(unittest.TestCase):
    def test_probe_and_normal_invocation_fail_closed_without_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            working = Path(temporary)
            sentinel = working / "sentinel"
            sentinel.write_text("unchanged", encoding="utf-8")
            before = sorted(path.name for path in working.iterdir())
            for operation in OPERATIONS:
                for arguments in (("--contract-probe",), ()):
                    with self.subTest(operation=operation, arguments=arguments):
                        result = subprocess.run(
                            [
                                sys.executable,
                                str(ROOT / "scripts" / f"{operation}.py"),
                                *arguments,
                            ],
                            cwd=working,
                            capture_output=True,
                            text=True,
                            check=False,
                            timeout=30,
                        )
                        self.assertEqual(result.returncode, 78)
                        payload = json.loads(result.stdout)
                        self.assertEqual(payload["operation"], operation)
                        self.assertFalse(payload["configured"])
                        self.assertEqual(payload["status"], "blocked")
                        self.assertEqual(
                            sorted(path.name for path in working.iterdir()), before
                        )
                        self.assertEqual(
                            sentinel.read_text(encoding="utf-8"), "unchanged"
                        )


if __name__ == "__main__":
    unittest.main()
