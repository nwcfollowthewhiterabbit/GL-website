from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class RepositoryContractTests(unittest.TestCase):
    def test_repository_validator_passes_for_configured_project(self) -> None:
        result = subprocess.run(
            [sys.executable, "scripts/check_repository.py"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_release_readiness_passes_for_configured_runtime(self) -> None:
        result = subprocess.run(
            [sys.executable, "scripts/check_release_readiness.py"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Release readiness checks passed", result.stdout)


if __name__ == "__main__":
    unittest.main()
