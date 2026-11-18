import hashlib
import json
import sqlite3
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class VerifiedCatalogContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script = """
          import { reviewedImageSql, reviewedDescriptionSql } from './api/catalog-verified-content.mjs';
          console.log(JSON.stringify([reviewedImageSql('i'), reviewedDescriptionSql('i.description')]));
        """
        cls.image_sql, cls.description_sql = json.loads(subprocess.check_output(
            ["node", "--input-type=module", "-e", script], cwd=ROOT, text=True
        ))

    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.create_function("CONCAT_WS", -1, lambda separator, *parts: separator.join(parts))
        self.db.create_function("SHA2", 2, lambda text, bits: hashlib.sha256(text.encode()).hexdigest())
        self.db.execute("CREATE TABLE item(name, item_name, image, thumbnail, description, woocommerce_description)")

    def test_verified_photo_is_specific_to_the_product_and_current_erp_fields(self):
        values = ("WIN-MHH-5", 'Broom & Brush Organizer, 16" - 1/Case', "", "/files/winc-mhh-5-2_small.jpg")
        self.db.execute("INSERT INTO item VALUES (?, ?, ?, ?, '', '')", values)
        read = lambda: self.db.execute(f"SELECT {self.image_sql} FROM item i").fetchone()[0]
        self.assertEqual(read(), values[3])
        self.db.execute("UPDATE item SET thumbnail = '/files/unreviewed.jpg'")
        self.assertEqual(read(), "")
        self.db.execute("UPDATE item SET thumbnail = ?, item_name = 'New product'", (values[3],))
        self.assertEqual(read(), "")
        self.db.execute("UPDATE item SET name = 'Other', item_name = ?", (values[1],))
        self.assertEqual(read(), "")
        self.db.execute("UPDATE item SET name = ?, image = '/files/new-primary.jpg'", (values[0],))
        self.assertEqual(read(), "/files/new-primary.jpg")

    def test_unreviewed_commerce_description_never_overrides_the_primary(self):
        self.db.execute("INSERT INTO item VALUES ('ALT-AT-ADCF-3','Changed item','','','Main description','Unreviewed')")
        self.assertEqual(self.db.execute(f"SELECT {self.description_sql} FROM item i").fetchone()[0], "Main description")


if __name__ == "__main__":
    unittest.main()
