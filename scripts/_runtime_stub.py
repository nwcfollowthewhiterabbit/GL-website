"""Fail-closed runtime operation shared by all unconfigured adapters."""

from __future__ import annotations

import json
import sys


EXIT_UNCONFIGURED = 78
CONTRACT_VERSION = "1.0"


def run_stub(operation: str) -> int:
    payload = {
        "contract_version": CONTRACT_VERSION,
        "operation": operation,
        "configured": False,
        "status": "blocked",
        "reason": (
            "runtime adapter is not configured; choose the runtime, record an ADR, "
            "implement the contract and add non-destructive contract tests"
        ),
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return EXIT_UNCONFIGURED


def main(operation: str) -> None:
    # --contract-probe and normal invocation are equally non-mutating. Unknown
    # arguments are deliberately ignored by the stub and can never enable work.
    raise SystemExit(run_stub(operation))
