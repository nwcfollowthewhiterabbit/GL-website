#!/usr/bin/env python3
"""Validate runtime evidence with the stdlib-only authoritative contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from _contract import (
    EVIDENCE_REQUIRED_FIELDS,
    OPERATION_REQUIRED_EVIDENCE_FIELDS,
    REQUIRED_RUNTIME_OPERATIONS,
    RUNTIME_CONTRACT_VERSION,
    safe_relative_path,
    strict_json_object,
)


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "contracts" / "evidence.schema.json"
NONEMPTY_STRING_FIELDS = {
    "environment",
    "target",
    "source_revision",
    "backup_reference",
    "rollback_reference",
    "release_reference",
    "restore_plan_reference",
    "target_precondition_reference",
    "test_run_reference",
}
ALLOWED_FIELDS = {
    *EVIDENCE_REQUIRED_FIELDS,
    "artifact_digest",
    "artifacts",
    "backup_reference",
    "cleanup_status",
    "release_reference",
    "restore_plan_reference",
    "rollback_reference",
    "target_precondition_reference",
    "test_run_reference",
    "tested_roles",
}
CHECK_STATUSES = {"passed", "failed", "blocked", "skipped"}
RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
URL_CREDENTIALS = re.compile(
    r"\b[a-z][a-z0-9+.-]*://[^\s/@]+@",
    re.IGNORECASE,
)


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def parse_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed


def schema_contract_errors(schema: Any) -> list[str]:
    """Ensure the descriptive JSON Schema cannot silently weaken the contract."""

    if not isinstance(schema, dict):
        return ["evidence schema must be a JSON object"]
    errors = []
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        errors.append("evidence schema must use JSON Schema draft 2020-12")
    if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
        errors.append("evidence schema root must be a closed object")
    required = schema.get("required")
    if not isinstance(required, list) or not set(EVIDENCE_REQUIRED_FIELDS) <= set(
        item for item in required if isinstance(item, str)
    ):
        errors.append("evidence schema is missing required baseline fields")
    properties = schema.get("properties")
    if not isinstance(properties, dict):
        return errors + ["evidence schema properties must be an object"]
    operation = properties.get("operation", {})
    if tuple(operation.get("enum", ())) != REQUIRED_RUNTIME_OPERATIONS:
        errors.append("evidence schema operation enum must match the immutable baseline")
    checks = properties.get("checks", {})
    check_items = checks.get("items", {}) if isinstance(checks, dict) else {}
    if (
        checks.get("type") != "array"
        or checks.get("minItems", 0) < 1
        or check_items.get("additionalProperties") is not False
        or not {"name", "status"} <= set(check_items.get("required", ()))
    ):
        errors.append("evidence schema checks contract is incomplete")
    artifacts = properties.get("artifacts", {})
    artifact_items = artifacts.get("items", {}) if isinstance(artifacts, dict) else {}
    if (
        artifacts.get("type") != "array"
        or artifacts.get("minItems", 0) < 1
        or artifact_items.get("additionalProperties") is not False
        or not {
            "kind",
            "path",
            "sha256",
            "size_bytes",
            "contains_secrets",
            "restore_critical",
        }
        <= set(artifact_items.get("required", ()))
    ):
        errors.append("evidence schema artifact contract is incomplete")

    operation_requirements: dict[str, set[str]] = {}
    semantic_clauses: dict[str, dict[str, Any]] = {}
    for clause in schema.get("allOf", ()):
        if not isinstance(clause, dict):
            continue
        condition = clause.get("if", {}).get("properties", {})
        status = condition.get("status", {}).get("const")
        operation_name = condition.get("operation", {}).get("const")
        then = clause.get("then", {})
        if operation_name and status == "passed":
            operation_requirements[operation_name] = set(then.get("required", ()))
        elif status in {"passed", "failed", "blocked"}:
            semantic_clauses[status] = then
    if set(semantic_clauses) != {"passed", "failed", "blocked"}:
        errors.append("evidence schema status/check consistency clauses are incomplete")
    else:
        passed_status = (
            semantic_clauses["passed"]
            .get("properties", {})
            .get("checks", {})
            .get("items", {})
            .get("properties", {})
            .get("status", {})
            .get("const")
        )
        if passed_status != "passed":
            errors.append("evidence schema must require all checks for passed evidence")
        for status in ("failed", "blocked"):
            contained = (
                semantic_clauses[status]
                .get("properties", {})
                .get("checks", {})
                .get("contains", {})
                .get("properties", {})
                .get("status", {})
                .get("const")
            )
            if contained != status:
                errors.append(
                    f"evidence schema must require a {status} check for "
                    f"{status} evidence"
                )
    for operation_name, fields in OPERATION_REQUIRED_EVIDENCE_FIELDS.items():
        if operation_requirements.get(operation_name) != set(fields):
            errors.append(
                f"evidence schema fields for {operation_name} do not match the contract"
            )
    return errors


def check_check_items(value: Any) -> list[str]:
    if not isinstance(value, list) or not value:
        return ["checks must be a non-empty array"]
    errors = []
    names = []
    for index, item in enumerate(value):
        label = f"checks[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label} must be an object")
            continue
        allowed = {"name", "status", "detail"}
        unknown = sorted(set(item) - allowed)
        missing = sorted({"name", "status"} - set(item))
        if unknown:
            errors.append(f"{label} has unknown fields: {', '.join(unknown)}")
        if missing:
            errors.append(f"{label} is missing fields: {', '.join(missing)}")
        if not nonempty(item.get("name")):
            errors.append(f"{label}.name must be non-empty")
        else:
            names.append(item["name"])
        if item.get("status") not in CHECK_STATUSES:
            errors.append(f"{label}.status is invalid")
        if "detail" in item and not nonempty(item["detail"]):
            errors.append(f"{label}.detail must be non-empty when present")
    if len(names) != len(set(names)):
        errors.append("checks must have unique names")
    return errors


def check_artifacts(value: Any) -> list[str]:
    if not isinstance(value, list) or not value:
        return ["artifacts must be a non-empty array"]
    errors = []
    paths = []
    required = {
        "kind",
        "path",
        "sha256",
        "size_bytes",
        "contains_secrets",
        "restore_critical",
    }
    for index, item in enumerate(value):
        label = f"artifacts[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label} must be an object")
            continue
        unknown = sorted(set(item) - required)
        missing = sorted(required - set(item))
        if unknown:
            errors.append(f"{label} has unknown fields: {', '.join(unknown)}")
        if missing:
            errors.append(f"{label} is missing fields: {', '.join(missing)}")
        if not nonempty(item.get("kind")):
            errors.append(f"{label}.kind must be non-empty")
        path = item.get("path")
        if not safe_relative_path(path):
            errors.append(f"{label}.path must be a safe relative POSIX path")
        else:
            paths.append(path)
        if not isinstance(item.get("sha256"), str) or not SHA256.fullmatch(
            item["sha256"]
        ):
            errors.append(f"{label}.sha256 must be a lowercase SHA-256")
        if (
            type(item.get("size_bytes")) is not int
            or item["size_bytes"] < 0
        ):
            errors.append(f"{label}.size_bytes must be a non-negative integer")
        for field in ("contains_secrets", "restore_critical"):
            if type(item.get(field)) is not bool:
                errors.append(f"{label}.{field} must be a boolean")
    if len(paths) != len(set(paths)):
        errors.append("artifacts must have unique paths")
    return errors


def evidence_errors(payload: Any, expected_operation: Optional[str] = None) -> list[str]:
    if not isinstance(payload, dict):
        return ["evidence must be a JSON object"]
    errors = []
    unknown = sorted(set(payload) - ALLOWED_FIELDS)
    missing = sorted(set(EVIDENCE_REQUIRED_FIELDS) - set(payload))
    if unknown:
        errors.append(f"unknown evidence fields: {', '.join(unknown)}")
    if missing:
        errors.append(f"missing evidence fields: {', '.join(missing)}")
    if payload.get("contract_version") != RUNTIME_CONTRACT_VERSION:
        errors.append(f"contract_version must be {RUNTIME_CONTRACT_VERSION}")
    operation = payload.get("operation")
    if operation not in REQUIRED_RUNTIME_OPERATIONS:
        errors.append("operation is not part of the runtime contract")
    if expected_operation is not None and operation != expected_operation:
        errors.append(f"operation must be {expected_operation}")
    run_id = payload.get("run_id")
    if not isinstance(run_id, str) or not RUN_ID.fullmatch(run_id):
        errors.append("run_id must be 8-128 safe identifier characters")
    for field in NONEMPTY_STRING_FIELDS & set(payload):
        if not nonempty(payload[field]):
            errors.append(f"{field} must be non-empty")
        elif URL_CREDENTIALS.search(payload[field]):
            errors.append(f"{field} must not contain embedded credentials")
    status = payload.get("status")
    if status not in {"passed", "failed", "blocked"}:
        errors.append("status must be passed, failed or blocked")
    started = parse_timestamp(payload.get("started_at"))
    finished = parse_timestamp(payload.get("finished_at"))
    if started is None:
        errors.append("started_at must be a timezone-aware ISO 8601 timestamp")
    if finished is None:
        errors.append("finished_at must be a timezone-aware ISO 8601 timestamp")
    if started is not None and finished is not None and finished < started:
        errors.append("finished_at must not precede started_at")

    checks = payload.get("checks")
    errors.extend(check_check_items(checks))
    if isinstance(checks, list):
        statuses = {
            item.get("status") for item in checks if isinstance(item, dict)
        }
        if status == "passed" and statuses != {"passed"}:
            errors.append("passed evidence requires every check to pass")
        if status == "failed" and "failed" not in statuses:
            errors.append("failed evidence requires at least one failed check")
        if status == "blocked" and "blocked" not in statuses:
            errors.append("blocked evidence requires at least one blocked check")

    if "artifact_digest" in payload and (
        not isinstance(payload["artifact_digest"], str)
        or not DIGEST.fullmatch(payload["artifact_digest"])
    ):
        errors.append("artifact_digest must be sha256:<lowercase SHA-256>")
    if "cleanup_status" in payload and payload["cleanup_status"] not in {
        "completed",
        "not_applicable",
    }:
        errors.append("cleanup_status must be completed or not_applicable")
    if "tested_roles" in payload:
        roles = payload["tested_roles"]
        if (
            not isinstance(roles, list)
            or not roles
            or any(not nonempty(role) for role in roles)
        ):
            errors.append("tested_roles must be a non-empty string array")
        elif len(roles) != len(set(roles)):
            errors.append("tested_roles must be unique")
    if "artifacts" in payload:
        errors.extend(check_artifacts(payload["artifacts"]))

    if status == "passed" and operation in OPERATION_REQUIRED_EVIDENCE_FIELDS:
        for field in OPERATION_REQUIRED_EVIDENCE_FIELDS[operation]:
            if field not in payload:
                errors.append(f"{operation} passed evidence requires {field}")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", type=Path)
    parser.add_argument(
        "--operation",
        choices=REQUIRED_RUNTIME_OPERATIONS,
        help="require evidence for one exact operation",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        schema = strict_json_object(SCHEMA_PATH.read_text(encoding="utf-8"))
        payload = strict_json_object(
            args.evidence.expanduser().read_text(encoding="utf-8")
        )
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"Evidence validation failed: {exc}")
        return 1
    errors = schema_contract_errors(schema)
    errors.extend(evidence_errors(payload, args.operation))
    if errors:
        print("Evidence validation failed:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(
        f"Evidence is valid for {payload['operation']} "
        f"(run_id={payload['run_id']}, status={payload['status']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
