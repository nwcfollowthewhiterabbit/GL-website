import unittest

from ._probe_case import assert_operation_contract


class DeployFirstInstanceContractTests(unittest.TestCase):
    def test_isolated_first_deploy_contract(self) -> None:
        assert_operation_contract(self, "deploy_first_instance")
