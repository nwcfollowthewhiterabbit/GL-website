import unittest

from ._probe_case import assert_operation_contract


class ValidateDomainContractTests(unittest.TestCase):
    def test_isolated_domain_validation_contract(self) -> None:
        assert_operation_contract(self, "validate_domain")
