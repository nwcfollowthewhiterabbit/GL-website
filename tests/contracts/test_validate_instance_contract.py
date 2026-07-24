import unittest

from ._probe_case import assert_operation_contract


class ValidateInstanceContractTests(unittest.TestCase):
    def test_isolated_instance_validation_contract(self) -> None:
        assert_operation_contract(self, "validate_instance")
