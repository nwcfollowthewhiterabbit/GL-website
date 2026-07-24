"""Authoritative structural and semantic validation for ``project.toml``.

This module deliberately validates only the project configuration contract.
Repository security scans and release-readiness evidence belong to their
respective validators.
"""

from __future__ import annotations

import re
from typing import Any


PROJECT_SCHEMA_VERSION = 1

_TABLE_KEYS = {
    "project": {
        "name",
        "goal",
        "stage",
        "user_ui_language",
        "internal_doc_language",
        "test_data_prefix",
        "scope",
        "out_of_scope",
        "roles",
        "business_workflows",
    },
    "source": {
        "repository",
        "branch",
    },
    "runtime": {
        "kind",
        "access_description",
        "deployment_constraints",
    },
    "acceptance": {
        "owner",
    },
    "automation": {
        "state",
        "runtime_ready",
    },
}

_STRING_FIELDS = {
    "project": {
        "name",
        "goal",
        "stage",
        "user_ui_language",
        "internal_doc_language",
        "test_data_prefix",
    },
    "source": {
        "repository",
        "branch",
    },
    "runtime": {
        "kind",
        "access_description",
    },
    "acceptance": {
        "owner",
    },
}

_STRING_ARRAY_FIELDS = {
    "project": {
        "scope",
        "out_of_scope",
        "roles",
        "business_workflows",
    },
    "runtime": {
        "deployment_constraints",
    },
}

_AUTOMATION_STATES = {
    "scaffold": False,
    "configured": True,
}

_SAFE_TEST_DATA_PREFIX = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")


def _single_line_string(value: Any) -> bool:
    return (
        type(value) is str
        and bool(value.strip())
        and "\n" not in value
        and "\r" not in value
    )


def _string_array_errors(path: str, value: Any) -> list[str]:
    if type(value) is not list or not value:
        return [f"{path} must be a non-empty array of strings"]

    errors = []
    invalid_indexes = [
        str(index)
        for index, item in enumerate(value)
        if not _single_line_string(item)
    ]
    if invalid_indexes:
        errors.append(
            f"{path} must contain only non-empty single-line strings; "
            f"invalid indexes: {', '.join(invalid_indexes)}"
        )

    string_items = [item for item in value if type(item) is str]
    if len(string_items) != len(set(string_items)):
        errors.append(f"{path} contains duplicate entries")
    return errors


def _table_shape_errors(name: str, table: dict[str, Any]) -> list[str]:
    expected = _TABLE_KEYS[name]
    actual = set(table)
    errors = []
    missing = sorted(expected - actual)
    unknown = sorted(actual - expected)
    if missing:
        errors.append(f"{name} is missing keys: {', '.join(missing)}")
    if unknown:
        errors.append(f"{name} has unknown keys: {', '.join(unknown)}")
    return errors


def project_config_errors(config: Any) -> list[str]:
    """Return deterministic errors for an invalid parsed ``project.toml``."""

    if type(config) is not dict:
        return ["project configuration must be a TOML table"]

    errors = []
    expected_top_level = {"schema_version", *_TABLE_KEYS}
    actual_top_level = set(config)
    missing = sorted(expected_top_level - actual_top_level)
    unknown = sorted(actual_top_level - expected_top_level)
    if missing:
        errors.append(
            f"project configuration is missing keys: {', '.join(missing)}"
        )
    if unknown:
        errors.append(
            f"project configuration has unknown keys: {', '.join(unknown)}"
        )

    if (
        type(config.get("schema_version")) is not int
        or config.get("schema_version") != PROJECT_SCHEMA_VERSION
    ):
        errors.append(
            f"schema_version must be integer {PROJECT_SCHEMA_VERSION}"
        )

    tables = {}
    for name in _TABLE_KEYS:
        if name not in config:
            continue
        value = config[name]
        if type(value) is not dict:
            errors.append(f"{name} must be a TOML table")
            continue
        tables[name] = value
        errors.extend(_table_shape_errors(name, value))

    for table_name, fields in _STRING_FIELDS.items():
        table = tables.get(table_name)
        if table is None:
            continue
        for field in sorted(fields):
            if field not in table:
                continue
            if not _single_line_string(table[field]):
                errors.append(
                    f"{table_name}.{field} must be a non-empty "
                    "single-line string"
                )

    for table_name, fields in _STRING_ARRAY_FIELDS.items():
        table = tables.get(table_name)
        if table is None:
            continue
        for field in sorted(fields):
            if field in table:
                errors.extend(
                    _string_array_errors(
                        f"{table_name}.{field}",
                        table[field],
                    )
                )

    project = tables.get("project")
    if project is not None and "test_data_prefix" in project:
        prefix = project["test_data_prefix"]
        if (
            _single_line_string(prefix)
            and _SAFE_TEST_DATA_PREFIX.fullmatch(prefix) is None
        ):
            errors.append(
                "project.test_data_prefix must match "
                "[A-Za-z0-9][A-Za-z0-9._-]*"
            )

    automation = tables.get("automation")
    if automation is not None:
        state = automation.get("state")
        runtime_ready = automation.get("runtime_ready")
        if state not in _AUTOMATION_STATES or type(state) is not str:
            errors.append(
                "automation.state must be exactly 'scaffold' or 'configured'"
            )
        if type(runtime_ready) is not bool:
            errors.append("automation.runtime_ready must be a boolean")
        if (
            type(state) is str
            and state in _AUTOMATION_STATES
            and type(runtime_ready) is bool
            and runtime_ready is not _AUTOMATION_STATES[state]
        ):
            expected = str(_AUTOMATION_STATES[state]).lower()
            errors.append(
                f"automation.runtime_ready must be {expected} "
                f"when automation.state is '{state}'"
            )

    return errors


__all__ = ["PROJECT_SCHEMA_VERSION", "project_config_errors"]
