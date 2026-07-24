import unittest

from ._probe_case import assert_operation_contract


class RestoreContractTests(unittest.TestCase):
    def test_isolated_restore_contract(self) -> None:
        assert_operation_contract(self, "restore")
