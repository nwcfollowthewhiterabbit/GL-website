from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    import tomllib
except ModuleNotFoundError:
    import _toml_compat as tomllib

from _project_config import project_config_errors


def valid_config() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "project": {
            "name": "Example Product",
            "goal": "Deliver a verified workflow",
            "stage": "MVP",
            "user_ui_language": "uk",
            "internal_doc_language": "ru",
            "test_data_prefix": "E2E",
            "scope": ["Confirmed workflow"],
            "out_of_scope": ["Deferred workflow"],
            "roles": ["Administrator", "Operational user"],
            "business_workflows": [
                "Input -> action -> state -> effect -> control -> correction"
            ],
        },
        "source": {
            "repository": "owner/repository",
            "branch": "main",
        },
        "runtime": {
            "kind": "UNCONFIGURED",
            "access_description": "UNCONFIGURED",
            "deployment_constraints": ["Runtime adapter is not configured"],
        },
        "acceptance": {
            "owner": "UNASSIGNED",
        },
        "automation": {
            "state": "scaffold",
            "runtime_ready": False,
        },
    }


class ProjectConfigurationTests(unittest.TestCase):
    def test_valid_scaffold_and_configured_states(self) -> None:
        scaffold = valid_config()
        self.assertEqual(project_config_errors(scaffold), [])

        configured = copy.deepcopy(scaffold)
        configured["automation"] = {
            "state": "configured",
            "runtime_ready": True,
        }
        self.assertEqual(project_config_errors(configured), [])

    def test_rendered_project_configuration_matches_contract(self) -> None:
        config = tomllib.loads(
            (ROOT / "project.toml").read_text(encoding="utf-8")
        )
        self.assertEqual(project_config_errors(config), [])

    def test_schema_version_requires_exact_integer(self) -> None:
        for invalid in (True, 2, "1"):
            with self.subTest(invalid=invalid):
                changed = valid_config()
                changed["schema_version"] = invalid
                self.assertTrue(project_config_errors(changed))

    def test_top_level_schema_is_exact(self) -> None:
        missing = valid_config()
        del missing["source"]
        self.assertTrue(project_config_errors(missing))

        unknown = valid_config()
        unknown["extra"] = {}
        self.assertTrue(project_config_errors(unknown))

    def test_tables_require_exact_keys_and_table_types(self) -> None:
        wrong_type = valid_config()
        wrong_type["runtime"] = []
        self.assertTrue(project_config_errors(wrong_type))

        missing = valid_config()
        del missing["project"]["roles"]
        self.assertTrue(project_config_errors(missing))

        unknown = valid_config()
        unknown["source"]["extra"] = "value"
        self.assertTrue(project_config_errors(unknown))

    def test_scalar_fields_require_non_empty_single_line_strings(self) -> None:
        cases = (
            ("project", "name", ""),
            ("project", "user_ui_language", 7),
            ("project", "internal_doc_language", "uk\nru"),
            ("source", "repository", "   "),
            ("acceptance", "owner", None),
        )
        for table, field, invalid in cases:
            with self.subTest(table=table, field=field, invalid=invalid):
                changed = valid_config()
                changed[table][field] = invalid
                self.assertTrue(project_config_errors(changed))

    def test_array_fields_require_non_empty_unique_single_line_strings(self) -> None:
        cases = (
            [],
            [""],
            ["first", 2],
            ["first\nsecond"],
            ["duplicate", "duplicate"],
        )
        for invalid in cases:
            with self.subTest(invalid=invalid):
                changed = valid_config()
                changed["project"]["scope"] = invalid
                self.assertTrue(project_config_errors(changed))

    def test_every_array_field_is_validated(self) -> None:
        array_fields = (
            ("project", "scope"),
            ("project", "out_of_scope"),
            ("project", "roles"),
            ("project", "business_workflows"),
            ("runtime", "deployment_constraints"),
        )
        for table, field in array_fields:
            with self.subTest(table=table, field=field):
                changed = valid_config()
                changed[table][field] = []
                self.assertTrue(project_config_errors(changed))

    def test_test_data_prefix_must_be_safe(self) -> None:
        for invalid in ("../unsafe", "-leading", "space value", "тест"):
            with self.subTest(invalid=invalid):
                changed = valid_config()
                changed["project"]["test_data_prefix"] = invalid
                self.assertTrue(project_config_errors(changed))

    def test_automation_state_and_runtime_flag_are_consistent(self) -> None:
        cases = (
            {"state": "ready", "runtime_ready": True},
            {"state": "configured", "runtime_ready": 1},
            {"state": "scaffold", "runtime_ready": True},
            {"state": "configured", "runtime_ready": False},
        )
        for invalid in cases:
            with self.subTest(invalid=invalid):
                changed = valid_config()
                changed["automation"] = invalid
                self.assertTrue(project_config_errors(changed))


if __name__ == "__main__":
    unittest.main()
