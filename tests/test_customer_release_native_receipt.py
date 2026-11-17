"""The cleanup helper accepts browser IDs only with exact captured ownership evidence."""
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "customer-release-native-check.py"
RUN = "GL-WEB-E2E-receipt-test"
UUID = "GLQ-12345678-abcd-4321-abcd-123456789abc"


class NativeQuoteReceiptTests(unittest.TestCase):
    def setUp(self):
        self.quote = SimpleNamespace(docstatus=0, quotation_to="Customer", party_name="SYNTHETIC-CUSTOMER",
                                     website_quote_id=UUID, website_customer_email="synthetic@example.invalid", enq_det=RUN)
        self.frappe = SimpleNamespace(get_doc=lambda doctype, name: self.quote)
        spec = importlib.util.spec_from_file_location("native_receipt_contract", SOURCE)
        self.module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"frappe": self.frappe}):
            spec.loader.exec_module(self.module)
        self.accounts = [{"customer": "SYNTHETIC-CUSTOMER", "email": "synthetic@example.invalid"}]

    def validate(self, mapping=None):
        return self.module.validate_quote("QTN-EXACT", self.accounts, RUN, mapping)

    def test_run_marker_remains_accepted(self):
        self.quote.website_quote_id = RUN + "-q1"
        self.assertIs(self.validate(), self.quote)

    def test_exact_captured_browser_id_is_accepted(self):
        self.assertIs(self.validate({"QTN-EXACT": UUID}), self.quote)

    def test_browser_id_without_mapping_is_rejected(self):
        with self.assertRaises(RuntimeError):
            self.validate()

    def test_mapping_for_other_document_is_rejected(self):
        with self.assertRaises(RuntimeError):
            self.validate({"QTN-OTHER": UUID})

    def test_wrong_captured_id_is_rejected(self):
        with self.assertRaises(RuntimeError):
            self.validate({"QTN-EXACT": UUID[:-1] + "d"})

    def test_arbitrary_prefix_cannot_override_run_guard(self):
        self.quote.website_quote_id = "GLQ-arbitrary"
        with self.assertRaises(RuntimeError):
            self.validate({"QTN-EXACT": "GLQ-arbitrary"})

    def test_browser_mapping_does_not_bypass_notes_marker(self):
        self.quote.enq_det = "Unrelated browser request"
        with self.assertRaises(RuntimeError):
            self.validate({"QTN-EXACT": UUID})

    def test_browser_mapping_does_not_bypass_customer_or_status(self):
        for field, value in [("party_name", "FOREIGN"), ("website_customer_email", "foreign@example.invalid"), ("docstatus", 1)]:
            with self.subTest(field=field):
                original = getattr(self.quote, field)
                setattr(self.quote, field, value)
                with self.assertRaises(RuntimeError):
                    self.validate({"QTN-EXACT": UUID})
                setattr(self.quote, field, original)
