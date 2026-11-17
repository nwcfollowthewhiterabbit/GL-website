import copy
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preservation', ROOT / 'scripts/erpnext-preserve-website.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
boot_spec = importlib.util.spec_from_file_location('website_boot', ROOT / 'erpnext/app/greenleaf_website/greenleaf_website/boot.py')
boot = importlib.util.module_from_spec(boot_spec)
boot_spec.loader.exec_module(boot)


class PreservationTests(unittest.TestCase):
    def setUp(self):
        self.definitions, self.fields = migration.contracts(ROOT / 'erpnext')
        self.department = migration.canonical({
            'doctype': 'Website Department', 'name': 'kitchen-equipment',
            'department_id': 'kitchen-equipment', 'label': 'Kitchen', 'enabled': 1,
            'item_groups': [
                {'item_group': 'Kitchen'},
                {'item_group': 'Commercial kitchen equipment'},
                {'item_group': 'Furniture and fitouts'},
            ],
        }, self.definitions)

    def bundle(self, records=None, field_values=None):
        value = {'format': 1, 'contract_sha256': migration.digest({'definitions': self.definitions, 'fields': self.fields}),
                 'records': records or [self.department], 'field_values': field_values or []}
        value['sha256'] = migration.digest(value)
        return value

    def test_mapping_preserves_source_and_records_removal(self):
        before = copy.deepcopy(self.department)
        records, changes = migration.transform_records([self.department], {
            'Commercial kitchen equipment': None, 'Furniture and fitouts': 'Furniture and fitout'})
        self.assertEqual(self.department, before)
        self.assertEqual([r['item_group'] for r in records[0]['item_groups']], ['Kitchen', 'Furniture and fitout'])
        self.assertEqual(len(changes), 2)

    def test_bundle_rejects_business_documents_even_with_valid_checksum(self):
        with self.assertRaisesRegex(ValueError, 'non-website'):
            migration.validate_bundle(self.bundle([{'doctype': 'Customer', 'name': 'existing-customer'}]), self.definitions, self.fields)

    def test_child_injection_rejected(self):
        row = copy.deepcopy(self.department)
        row['item_groups'][0]['parent'] = 'another-parent'
        with self.assertRaisesRegex(ValueError, 'noncanonical'):
            migration.validate_bundle(self.bundle([row]), self.definitions, self.fields)

    def test_explicit_zero_is_preserved_but_business_fields_rejected(self):
        bundle = self.bundle(field_values=[{'doctype': 'Item', 'name': 'ITEM', 'values': {'website_show_on_storefront': 0}}])
        migration.validate_bundle(bundle, self.definitions, self.fields)
        bundle = self.bundle(field_values=[{'doctype': 'Item', 'name': 'ITEM', 'values': {'valuation_rate': 0}}])
        with self.assertRaisesRegex(ValueError, 'Non-website'):
            migration.validate_bundle(bundle, self.definitions, self.fields)

    def test_changed_bundle_rejected(self):
        bundle = self.bundle()
        bundle['records'][0]['enabled'] = 0
        with self.assertRaisesRegex(ValueError, 'checksum'):
            migration.validate_bundle(bundle, self.definitions, self.fields)

    def test_content_collision_changes_cas_plan(self):
        existing = {}
        class DB:
            def exists(_, dt, name):
                return (dt, name) in existing or dt in {'Item', 'Item Group'}
            def sql(_, *args):
                return [('isolated-db',)]
        class Frappe:
            db = DB()
            def get_doc(_, dt, name):
                return types.SimpleNamespace(as_dict=lambda: existing[(dt, name)])
        with patch.object(migration, 'schema_check', return_value={'conflicts': [], 'missing': []}):
            bundle = self.bundle()
            first = migration.make_plan(Frappe(), 'site', bundle, self.definitions, self.fields, {})
            existing[('Website Department', 'kitchen-equipment')] = copy.deepcopy(self.department)
            equal = migration.make_plan(Frappe(), 'site', bundle, self.definitions, self.fields, {})
            self.assertEqual(len(first['insert']), 1)
            self.assertEqual(len(equal['equal']), 1)
            self.assertNotEqual(first['sha256'], equal['sha256'])
            existing[('Website Department', 'kitchen-equipment')]['label'] = 'Changed by another operator'
            conflict = migration.make_plan(Frappe(), 'site', bundle, self.definitions, self.fields, {})
            self.assertEqual(len(conflict['conflicts']), 1)
            self.assertNotEqual(equal['sha256'], conflict['sha256'])

    def test_boot_does_not_expose_private_url_or_token(self):
        fake = types.SimpleNamespace(conf={'website_public_url': 'https://greenleafpacific.com',
                                          'website_api_url': 'http://website-api:3001',
                                          'website_admin_api_token': 'x' * 40},
                                     get_roles=lambda: ['System Manager'])
        info = types.SimpleNamespace()
        with patch.dict(sys.modules, {'frappe': fake}):
            boot.boot_session(info)
        self.assertEqual(info.greenleaf_website, {'public_url': 'https://greenleafpacific.com', 'customer_access_enabled': True})
        fake.get_roles = lambda: ['Sales User']
        with patch.dict(sys.modules, {'frappe': fake}):
            boot.boot_session(info)
        self.assertFalse(info.greenleaf_website['customer_access_enabled'])

    def test_public_and_internal_urls_fail_closed(self):
        self.assertEqual(boot.validated_public_url('http://greenleafpacific.com'), '')
        self.assertEqual(boot.validated_public_url('https://greenleafpacific.com/path'), '')
        self.assertEqual(boot.validated_api_url('http://169.254.169.254'), '')
        self.assertEqual(boot.validated_api_url('http://website-api:3001'), 'http://website-api:3001')
        self.assertEqual(boot.validated_api_url('https://greenleafpacific.com?q=example'), '')


if __name__ == '__main__':
    unittest.main()
