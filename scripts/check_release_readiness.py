#!/usr/bin/env python3
"""Fail closed until canonical docs and runtime contracts are configured."""

from __future__ import annotations

import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable, Optional

try:
    import tomllib
except ModuleNotFoundError:
    import _toml_compat as tomllib

from _contract import (
    MINIMUM_REQUIRED_PATHS,
    REQUIRED_RUNTIME_OPERATIONS,
    RUNTIME_CONTRACT_TESTS,
    probe_errors,
    repository_contract_errors,
    strict_json_object,
)
from _project_config import project_config_errors
from validate_evidence import evidence_errors, schema_contract_errors


ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDERS = {
    "",
    "unassigned",
    "unconfigured",
    "tbd",
    "todo",
    "example product",
    "owner/repository",
    "describe the operational problem solved by the product",
}
BLOCKING_MARKERS = (
    ("TODO(project)", re.compile(r"TODO\s*\(\s*project\s*\)", re.IGNORECASE)),
    (
        "[ЗАПОЛНИТЬ…]",
        re.compile(
            r"\[ЗАПОЛНИТЬ(?=\s|:|\])(?:[^\]\r\n]*)\]",
            re.IGNORECASE,
        ),
    ),
    (
        "[НЕ ПРОВЕРЕНО]",
        re.compile(r"\[НЕ\s+ПРОВЕРЕНО\]", re.IGNORECASE),
    ),
    (
        "[НЕ ПРОВОДИЛСЯ]",
        re.compile(r"\[НЕ\s+ПРОВОДИЛСЯ\]", re.IGNORECASE),
    ),
    ("NOT CONFIGURED", re.compile(r"\bNOT\s+CONFIGURED\b", re.IGNORECASE)),
    ("STATUS: TEMPLATE", re.compile(r"\bSTATUS\s*:\s*TEMPLATE\b", re.IGNORECASE)),
    (
        "P0/P1/P2",
        re.compile(r"\bP0\s*/\s*P1\s*/\s*P2\b", re.IGNORECASE),
    ),
    (
        "planned / partial / verified",
        re.compile(
            r"\bplanned\s*/\s*partial\s*/\s*verified\b",
            re.IGNORECASE,
        ),
    ),
    (
        "да/нет",
        re.compile(r"\bда\s*/\s*нет\b", re.IGNORECASE),
    ),
)
CONFIG_PLACEHOLDER_PREFIX = re.compile(
    r"^\s*(?:todo|tbd|unassigned|unconfigured|unknown)"
    r"(?=$|[\s:;,.!?/()[\]{}—-])",
    re.IGNORECASE,
)
CONFIG_NA_PREFIX = re.compile(
    r"^\s*n\s*/\s*a(?=$|[\s:;,.!?()[\]{}—-])",
    re.IGNORECASE,
)
UNCHECKED_TASK_BOX = re.compile(
    r"^\s*(?:[-+*]|\d+[.)])\s+\[\s\](?=\s|$)",
)
TASK_BOX_WITH_NA = re.compile(
    r"^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s+"
    r"n\s*/\s*a(?=$|[\s:;,.!?()[\]{}—-])",
    re.IGNORECASE,
)
RELEASE_READINESS_TASK_DOCUMENTS = frozenset(
    {
        "docs/00-project/current-scope.md",
        "docs/02-processes/golden-path.md",
        "docs/07-quality/acceptance-guide.md",
        "docs/08-operations/release-checklist.md",
        "docs/user-manual.md",
    }
)
CANONICAL_ROOT_DOCUMENTS = ("README.md", "CHANGELOG.md")
CANONICAL_TREES = ("docs", "contracts", "infra", "src", "tests")
EXCLUDED_DOCUMENTS = {
    "docs/08-operations/releases.md",
}
EXCLUDED_PREFIXES = (
    "docs/01-discovery/sources/",
    "docs/templates/",
)
INCLUDED_PREFIX_EXCEPTIONS = {
    "docs/01-discovery/sources/README.md",
}


def load_toml(path: Path) -> dict[str, Any]:
    return tomllib.loads(path.read_text(encoding="utf-8"))


def is_canonical_readiness_document(relative: str) -> bool:
    if relative in CANONICAL_ROOT_DOCUMENTS:
        return True
    if relative in INCLUDED_PREFIX_EXCEPTIONS:
        return True
    if relative in EXCLUDED_DOCUMENTS or any(
        relative.startswith(prefix) for prefix in EXCLUDED_PREFIXES
    ):
        return False
    return relative.endswith(".md") and any(
        relative.startswith(f"{tree}/") for tree in CANONICAL_TREES
    )


def canonical_readiness_documents(root: Path = ROOT) -> Iterable[Path]:
    for relative in CANONICAL_ROOT_DOCUMENTS:
        path = root / relative
        if path.is_file():
            yield path
    for tree in CANONICAL_TREES:
        base = root / tree
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            relative = path.relative_to(root).as_posix()
            if is_canonical_readiness_document(relative):
                yield path


def marker_labels(text: str) -> list[str]:
    return [label for label, pattern in BLOCKING_MARKERS if pattern.search(text)]


def is_unchecked_release_task(relative: str, line: str) -> bool:
    """Return whether a required completion document has an open task box."""

    return (
        relative in RELEASE_READINESS_TASK_DOCUMENTS
        and UNCHECKED_TASK_BOX.search(line) is not None
    )


def release_task_issue(relative: str, line: str) -> Optional[str]:
    """Return a release-task failure; N/A must be reasoned prose, not a box."""

    if relative not in RELEASE_READINESS_TASK_DOCUMENTS:
        return None
    if UNCHECKED_TASK_BOX.search(line) is not None:
        return "unchecked release task"
    if TASK_BOX_WITH_NA.search(line) is not None:
        return "N/A release task must be replaced with prose and a reason"
    return None


def unresolved_document_markers() -> list[str]:
    failures = []
    for path in canonical_readiness_documents():
        relative = path.relative_to(ROOT)
        relative_string = relative.as_posix()
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), 1
        ):
            for label, pattern in BLOCKING_MARKERS:
                if pattern.search(line):
                    failures.append(f"{relative}:{line_number}: {label}")
            task_issue = release_task_issue(relative_string, line)
            if task_issue is not None:
                failures.append(f"{relative}:{line_number}: {task_issue}")
    return failures


def probe(operation: str) -> list[str]:
    script = ROOT / "scripts" / f"{operation}.py"
    if not script.is_file() or script.is_symlink():
        return [f"{operation}: runtime adapter is missing or is a symlink"]
    try:
        result = subprocess.run(
            [sys.executable, str(script), "--contract-probe"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return [f"{operation}: probe failed to execute: {exc}"]
    return probe_errors(
        operation,
        result.returncode,
        result.stdout,
        result.stderr,
        expected_configured=True,
    )


def run_operation_contract_test(operation: str) -> list[str]:
    relative = RUNTIME_CONTRACT_TESTS[operation]
    path = ROOT / relative
    if not path.is_file() or path.is_symlink():
        return [f"{operation}: required contract test is missing or is a symlink"]
    module = Path(relative).with_suffix("").as_posix().replace("/", ".")
    with tempfile.TemporaryDirectory(prefix=f"contract-{operation}-") as temporary:
        evidence_path = Path(temporary) / "evidence.json"
        contract_run_id = f"contract-{operation}-{secrets.token_hex(16)}"
        environment = os.environ.copy()
        environment["FOUNDATION_CONTRACT_EVIDENCE_PATH"] = str(evidence_path)
        environment["FOUNDATION_CONTRACT_OPERATION"] = operation
        environment["FOUNDATION_CONTRACT_RUN_ID"] = contract_run_id
        try:
            result = subprocess.run(
                [sys.executable, "-m", "unittest", "-v", module],
                cwd=ROOT,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
                timeout=60,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return [f"{operation}: contract test failed to execute: {exc}"]
        failures = contract_test_result_errors(
            operation,
            result.returncode,
            result.stdout + result.stderr,
            evidence_path,
            contract_run_id,
        )
    return failures


def contract_test_result_errors(
    operation: str,
    returncode: int,
    runner_output: str,
    evidence_path: Path,
    expected_run_id: str,
) -> list[str]:
    """Require a non-empty test run and strict operation-specific evidence."""

    failures = []
    count_match = re.search(r"\bRan\s+(\d+)\s+tests?\b", runner_output)
    if returncode != 0:
        failures.append("unittest returned a non-zero exit code")
    if count_match is None or int(count_match.group(1)) < 1:
        failures.append("unittest did not execute any tests")
    for label, raw_count in re.findall(
        r"\b(skipped|expected failures?|unexpected successes?)\s*=\s*(\d+)\b",
        runner_output,
        re.IGNORECASE,
    ):
        if int(raw_count) > 0:
            failures.append(
                f"unittest reported {raw_count} {label.casefold()}"
            )
    if not evidence_path.is_file() or evidence_path.is_symlink():
        failures.append(
            "contract test did not write FOUNDATION_CONTRACT_EVIDENCE_PATH"
        )
    else:
        try:
            payload = strict_json_object(evidence_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
            failures.append(f"contract-test evidence is invalid JSON: {exc}")
        else:
            failures.extend(
                f"contract-test evidence: {error}"
                for error in evidence_errors(payload, operation)
            )
            if payload.get("run_id") != expected_run_id:
                failures.append(
                    "contract-test evidence run_id does not match "
                    "FOUNDATION_CONTRACT_RUN_ID"
                )
            if payload.get("status") != "passed":
                failures.append("contract-test evidence status must be passed")
    if not failures:
        return []
    detail = " ".join(runner_output.strip().split())
    if len(detail) > 300:
        detail = detail[:297] + "..."
    if detail:
        failures.append(f"runner summary: {detail}")
    return [f"{operation}: contract test failed: {failure}" for failure in failures]


def is_placeholder_config_value(value: str) -> bool:
    normalized = value.strip().casefold()
    return (
        normalized in PLACEHOLDERS
        or CONFIG_PLACEHOLDER_PREFIX.search(value) is not None
        or CONFIG_NA_PREFIX.search(value) is not None
    )


def configured_value_gates(config: Any) -> list[str]:
    if not isinstance(config, dict):
        return ["project.toml must contain TOML tables"]
    gates = []
    automation = config.get("automation", {})
    if not isinstance(automation, dict):
        return ["[automation] table is missing"]
    if automation.get("state") != "configured":
        gates.append("automation.state must be configured")
    if automation.get("runtime_ready") is not True:
        gates.append("automation.runtime_ready must be true")
    for section, key in (
        ("acceptance", "owner"),
        ("runtime", "kind"),
        ("runtime", "access_description"),
        ("project", "name"),
        ("project", "goal"),
        ("source", "repository"),
        ("source", "branch"),
    ):
        table = config.get(section, {})
        value = table.get(key, "") if isinstance(table, dict) else ""
        if not isinstance(value, str) or is_placeholder_config_value(value):
            gates.append(f"{section}.{key} must be configured")
    return gates


def main() -> int:
    gates = []
    try:
        config = load_toml(ROOT / "project.toml")
        contract = load_toml(ROOT / "repository-contract.toml")
        schema = strict_json_object(
            (ROOT / "contracts" / "evidence.schema.json").read_text(
                encoding="utf-8"
            )
        )
    except (
        OSError,
        UnicodeError,
        ValueError,
        json.JSONDecodeError,
        tomllib.TOMLDecodeError,
    ) as exc:
        print(f"Release readiness blocked:\n  - contract cannot be loaded: {exc}")
        return 1

    gates.extend(repository_contract_errors(contract))
    gates.extend(
        f"project configuration: {failure}"
        for failure in project_config_errors(config)
    )
    gates.extend(schema_contract_errors(schema))
    gates.extend(
        f"required path is missing: {path}"
        for path in MINIMUM_REQUIRED_PATHS
        if not (ROOT / path).is_file()
    )
    gates.extend(configured_value_gates(config))
    gates.extend(
        f"unresolved readiness marker: {failure}"
        for failure in unresolved_document_markers()
    )

    automation = config.get("automation", {})
    if isinstance(automation, dict) and automation.get("state") == "configured":
        for operation in REQUIRED_RUNTIME_OPERATIONS:
            gates.extend(probe(operation))
            gates.extend(run_operation_contract_test(operation))

    if gates:
        print("Release readiness blocked:")
        for gate in gates:
            print(f"  - {gate}")
        return 1
    print("Release readiness checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
