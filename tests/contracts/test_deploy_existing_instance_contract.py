import unittest

from ._probe_case import assert_operation_contract


class DeployExistingInstanceContractTests(unittest.TestCase):
    def test_isolated_existing_deploy_contract(self) -> None:
        assert_operation_contract(self, "deploy_existing_instance")
