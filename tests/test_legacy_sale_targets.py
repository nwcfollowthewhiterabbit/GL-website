import json
import unittest
from pathlib import Path

API = Path(__file__).resolve().parents[1] / "api"


class ConditionalLegacyIdentityTests(unittest.TestCase):
    def test_conditional_targets_reference_existing_records_and_preserve_original_codes(self):
        records = {row[0]: row for row in json.loads((API / "legacy-public-catalog.json").read_text())["products"]}
        pairs = json.loads((API / "legacy-sale-targets.json").read_text())
        self.assertEqual(len({legacy_id for legacy_id, _ in pairs}), len(pairs))
        for legacy_id, current_code in pairs:
            with self.subTest(legacy_id=legacy_id):
                self.assertIn(legacy_id, records)
                self.assertNotEqual(current_code, records[legacy_id][1])
                self.assertTrue(current_code.strip())
                self.assertFalse(records[legacy_id][4:])
        self.assertEqual(dict(pairs)[48483], "WIN-902")
        # Different board sizes, waffle sections, and old mug packs/options
        # remain separate even though ERP retained a rename or SKU alias.
        for old_id in (95573, 106189, 105147, 105260):
            self.assertNotIn(old_id, dict(pairs))
