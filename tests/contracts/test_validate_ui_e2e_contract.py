import unittest

from ._probe_case import assert_operation_contract


class ValidateUiE2eContractTests(unittest.TestCase):
    def test_isolated_ui_validation_contract(self) -> None:
        assert_operation_contract(self, "validate_ui_e2e")
