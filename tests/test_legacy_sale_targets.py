import json
import unittest
from pathlib import Path

API = Path(__file__).resolve().parents[1] / "api"


class ConditionalLegacyIdentityTests(unittest.TestCase):
    def test_conditional_targets_reference_existing_records_and_preserve_original_codes(self):
        records = {row[0]: row for row in json.loads((API / "legacy-public-catalog.json").read_text())["products"]}
        pairs = json.loads((API / "legacy-sale-targets.json").read_text())
        self.assertEqual(len({row[0] for row in pairs}), len(pairs))
        targets = {legacy_id: (current_code, unit) for legacy_id, current_code, unit in pairs}
        for legacy_id, current_code, unit in pairs:
            with self.subTest(legacy_id=legacy_id):
                self.assertIn(legacy_id, records)
                self.assertNotEqual(current_code, records[legacy_id][1])
                self.assertTrue(current_code.strip())
                if unit is not None:
                    self.assertRegex(unit, r"^(Each|[1-9][0-9]*/Case)$")
                self.assertFalse(records[legacy_id][4:])
        self.assertEqual(targets[48483], ("WIN-902", "1/Case"))
        self.assertEqual(targets[71041], ("AMC-SHSP-40", "48/Case"))
        # Different board sizes, waffle sections, and old mug packs/options
        # remain separate even though ERP retained a rename or SKU alias.
        for old_id in (95573, 106189, 105147, 105260):
            self.assertNotIn(old_id, targets)
