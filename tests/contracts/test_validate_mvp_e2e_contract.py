import unittest

from ._probe_case import assert_operation_contract


class ValidateMvpE2eContractTests(unittest.TestCase):
    def test_isolated_mvp_validation_contract(self) -> None:
        assert_operation_contract(self, "validate_mvp_e2e")
