"""Immutable baseline for the generated repository contract.

Projects may add required paths and policy sections in repository-contract.toml,
but they cannot remove this foundation or narrow the runtime operation set.
"""

from __future__ import annotations

import json
from pathlib import PurePosixPath
from typing import Any, Optional


CONTRACT_SCHEMA_VERSION = 1
RUNTIME_CONTRACT_VERSION = "1.0"
EXIT_UNCONFIGURED = 78

REQUIRED_RUNTIME_OPERATIONS = (
    "backup",
    "deploy_first_instance",
    "deploy_existing_instance",
    "restore",
    "validate_instance",
    "validate_domain",
    "validate_mvp_e2e",
    "validate_ui_e2e",
)

RUNTIME_CONTRACT_TESTS = {
    operation: f"tests/contracts/test_{operation}_contract.py"
    for operation in REQUIRED_RUNTIME_OPERATIONS
}

REQUIRED_POLICY_SECTIONS = (
    "## Обязательный первый проход",
    "## Definition of Ready",
    "## Принципы реализации процессов",
    "## Классификация обратной связи",
    "## Документация и инструкция пользователя",
    "## Инженерный цикл изменения",
    "## Runtime, backup и миграции",
    "## Обязательные команды проверки",
    "## Definition of Done",
    "## Минимальные уровни проверки",
    "## Безопасность, Git и коммуникация",
)

MINIMUM_REQUIRED_PATHS = (
    ".env.example",
    ".gitignore",
    ".template-manifest.json",
    ".github/workflows/ci.yml",
    ".github/workflows/release-readiness.yml",
    "AGENTS.md",
    "CHANGELOG.md",
    "README.md",
    "project.toml",
    "repository-contract.toml",
    "contracts/README.md",
    "contracts/evidence.schema.json",
    "contracts/adapters/README.md",
    "contracts/adapters/backup.md",
    "contracts/adapters/deploy.md",
    "contracts/adapters/restore.md",
    "contracts/adapters/validation.md",
    "docs/README.md",
    "docs/00-project/context.md",
    "docs/00-project/current-scope.md",
    "docs/00-project/glossary.md",
    "docs/00-project/repository-policy.md",
    "docs/01-discovery/confirmed-requirements.md",
    "docs/01-discovery/open-questions.md",
    "docs/01-discovery/feedback-log.md",
    "docs/01-discovery/sources/README.md",
    "docs/02-processes/README.md",
    "docs/02-processes/golden-path.md",
    "docs/03-domain/README.md",
    "docs/03-domain/invariants.md",
    "docs/03-domain/data-lifecycle.md",
    "docs/04-architecture/README.md",
    "docs/04-architecture/access-control.md",
    "docs/04-architecture/integrations.md",
    "docs/04-architecture/security-boundaries.md",
    "docs/05-decisions/README.md",
    "docs/05-decisions/ADR-0001-repository-source-of-truth.md",
    "docs/06-roadmap/backlog.md",
    "docs/06-roadmap/implementation-plan.md",
    "docs/07-quality/test-strategy.md",
    "docs/07-quality/acceptance-guide.md",
    "docs/07-quality/traceability.md",
    "docs/07-quality/test-data-and-cleanup.md",
    "docs/08-operations/README.md",
    "docs/08-operations/environments.md",
    "docs/08-operations/deployment.md",
    "docs/08-operations/operational-names.md",
    "docs/08-operations/backup-and-restore.md",
    "docs/08-operations/observability.md",
    "docs/08-operations/incident-runbook.md",
    "docs/08-operations/release-checklist.md",
    "docs/08-operations/releases.md",
    "docs/09-communications/README.md",
    "docs/templates/README.md",
    "docs/templates/feature-spec.md",
    "docs/templates/process-spec.md",
    "docs/templates/adr-template.md",
    "docs/templates/feedback-entry.md",
    "docs/templates/release-record.md",
    "docs/templates/customer-status.md",
    "docs/templates/meeting-note.md",
    "docs/roadmap.md",
    "docs/user-manual.md",
    "infra/README.md",
    "scripts/_contract.py",
    "scripts/_project_config.py",
    "scripts/_runtime_stub.py",
    "scripts/_toml_compat.py",
    "scripts/check_repository.py",
    "scripts/check_release_readiness.py",
    "scripts/validate_evidence.py",
    "src/README.md",
    "tests/__init__.py",
    "tests/contracts/__init__.py",
    "tests/contracts/_probe_case.py",
    "tests/e2e/README.md",
    "tests/integration/README.md",
    "tests/ui/README.md",
    "tests/test_evidence_validation.py",
    "tests/test_project_config.py",
    "tests/test_readiness_contract.py",
    "tests/test_repository_contract.py",
    "tests/test_runtime_stubs_fail_closed.py",
    "tests/test_security_scanner.py",
    *(
        f"scripts/{operation}.py"
        for operation in REQUIRED_RUNTIME_OPERATIONS
    ),
    *RUNTIME_CONTRACT_TESTS.values(),
)

EVIDENCE_REQUIRED_FIELDS = (
    "contract_version",
    "operation",
    "run_id",
    "environment",
    "target",
    "source_revision",
    "status",
    "started_at",
    "finished_at",
    "checks",
)

# These fields are required only when an operation reports status="passed".
OPERATION_REQUIRED_EVIDENCE_FIELDS = {
    "backup": ("backup_reference", "artifacts"),
    "deploy_first_instance": (
        "artifact_digest",
        "release_reference",
        "target_precondition_reference",
        "rollback_reference",
    ),
    "deploy_existing_instance": (
        "artifact_digest",
        "release_reference",
        "backup_reference",
        "rollback_reference",
    ),
    "restore": (
        "backup_reference",
        "restore_plan_reference",
        "rollback_reference",
    ),
    "validate_instance": ("test_run_reference",),
    "validate_domain": ("test_run_reference", "cleanup_status"),
    "validate_mvp_e2e": ("test_run_reference", "cleanup_status"),
    "validate_ui_e2e": (
        "test_run_reference",
        "tested_roles",
        "cleanup_status",
    ),
}


def safe_relative_path(value: Any) -> bool:
    """Return whether value is a normalized repository-relative POSIX path."""

    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = PurePosixPath(value)
    return (
        not path.is_absolute()
        and path.as_posix() == value
        and all(part not in {"", ".", ".."} for part in path.parts)
    )


def _list_errors(
    contract: dict[str, Any],
    key: str,
    *,
    exact: Optional[tuple[str, ...]] = None,
    minimum: tuple[str, ...] = (),
) -> list[str]:
    value = contract.get(key)
    if not isinstance(value, list) or any(
        not isinstance(item, str) or not item.strip() for item in value
    ):
        return [f"{key} must be an array of non-empty strings"]
    errors = []
    if len(value) != len(set(value)):
        errors.append(f"{key} contains duplicate entries")
    unsafe = [item for item in value if not safe_relative_path(item)] if key == "required_paths" else []
    if unsafe:
        errors.append(f"{key} contains unsafe paths: {', '.join(sorted(unsafe))}")
    if exact is not None and tuple(value) != exact:
        errors.append(f"{key} must exactly match the immutable baseline")
    missing = sorted(set(minimum) - set(value))
    if missing:
        errors.append(f"{key} is missing baseline entries: {', '.join(missing)}")
    return errors


def repository_contract_errors(contract: Any) -> list[str]:
    """Validate contract shape and its non-removable baseline."""

    if not isinstance(contract, dict):
        return ["repository contract must be a TOML table"]
    errors = []
    expected_keys = {
        "schema_version",
        "required_paths",
        "required_policy_sections",
        "runtime_operations",
    }
    unknown = sorted(set(contract) - expected_keys)
    missing = sorted(expected_keys - set(contract))
    if unknown:
        errors.append(f"unknown repository contract keys: {', '.join(unknown)}")
    if missing:
        errors.append(f"missing repository contract keys: {', '.join(missing)}")
    if (
        type(contract.get("schema_version")) is not int
        or contract.get("schema_version") != CONTRACT_SCHEMA_VERSION
    ):
        errors.append(
            f"schema_version must be integer {CONTRACT_SCHEMA_VERSION}"
        )
    errors.extend(
        _list_errors(
            contract,
            "required_paths",
            minimum=MINIMUM_REQUIRED_PATHS,
        )
    )
    errors.extend(
        _list_errors(
            contract,
            "required_policy_sections",
            minimum=REQUIRED_POLICY_SECTIONS,
        )
    )
    errors.extend(
        _list_errors(
            contract,
            "runtime_operations",
            exact=REQUIRED_RUNTIME_OPERATIONS,
        )
    )
    return errors


def strict_json_object(text: str) -> dict[str, Any]:
    """Load one JSON object and reject duplicate keys."""

    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    value = json.loads(text, object_pairs_hook=reject_duplicates)
    if not isinstance(value, dict):
        raise ValueError("JSON payload must be an object")
    return value


def probe_errors(
    operation: str,
    returncode: int,
    stdout: str,
    stderr: str,
    *,
    expected_configured: bool,
) -> list[str]:
    """Validate the exact non-mutating probe protocol for one operation."""

    if operation not in REQUIRED_RUNTIME_OPERATIONS:
        return [f"unknown runtime operation: {operation}"]
    try:
        payload = strict_json_object(stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        return [f"{operation}: probe did not return one strict JSON object: {exc}"]

    errors = []
    if stderr.strip():
        errors.append(f"{operation}: probe wrote to stderr")
    expected_keys = {
        "contract_version",
        "operation",
        "configured",
        "status",
    }
    if not expected_configured:
        expected_keys.add("reason")
    if set(payload) != expected_keys:
        errors.append(
            f"{operation}: probe keys must be exactly "
            f"{', '.join(sorted(expected_keys))}"
        )
    if payload.get("contract_version") != RUNTIME_CONTRACT_VERSION:
        errors.append(f"{operation}: contract_version mismatch")
    if payload.get("operation") != operation:
        errors.append(f"{operation}: operation mismatch")
    if type(payload.get("configured")) is not bool:
        errors.append(f"{operation}: configured must be a boolean")
    elif payload["configured"] is not expected_configured:
        errors.append(f"{operation}: configured state mismatch")
    expected_status = "ready" if expected_configured else "blocked"
    if payload.get("status") != expected_status:
        errors.append(f"{operation}: status must be {expected_status}")
    expected_code = 0 if expected_configured else EXIT_UNCONFIGURED
    if returncode != expected_code:
        errors.append(f"{operation}: probe exit code must be {expected_code}")
    if not expected_configured and (
        not isinstance(payload.get("reason"), str)
        or not payload["reason"].strip()
    ):
        errors.append(f"{operation}: blocked probe must contain a reason")
    return errors


def template_contract_test_blocker(state: str) -> str:
    """Prevent generic probe-only wrappers from certifying configured runtime."""

    if state != "configured":
        return ""
    return (
        "template probe-only contract test is not valid for configured "
        "automation; replace this operation wrapper with an "
        "implementation-specific isolated normal-invocation test that "
        "validates evidence and proves the operation safety contract"
    )
