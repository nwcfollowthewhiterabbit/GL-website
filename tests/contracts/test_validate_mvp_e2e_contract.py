import unittest

from ._probe_case import assert_operation_probe


class ValidateMvpE2eContractTests(unittest.TestCase):
    def test_non_mutating_contract_probe(self) -> None:
        assert_operation_probe(self, "validate_mvp_e2e")
