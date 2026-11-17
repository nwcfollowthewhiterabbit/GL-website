#!/usr/bin/env python3
"""Export only website content, then plan/apply a collision-rejecting import.

Runs with the target bench Python. Default action is a read-only plan. Native
app installation/migrate is a separate step; this script never executes DDL,
creates business records, imports credentials, or calls external services.
"""
import argparse
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path

PARENTS = (
    'Website Department', 'Website Banner', 'Website Catalog',
    'Website Featured Product', 'Website Customer Corner Settings',
    'Website Manufacturer',
)
CHILD = 'Website Department Item Group'
AUDIT_FIELDS = {'name', 'doctype', 'creation', 'modified', 'modified_by', 'owner',
                'docstatus', 'idx', 'parent', 'parenttype', 'parentfield'}
VALUE_TYPES = {'Check', 'Int', 'Float', 'Currency', 'Percent'}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False, default=str).encode()).hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Private exclusive output; a failed write is never reused or overwritten.
    data = (json.dumps(value, indent=2, ensure_ascii=False, default=str) + '\n').encode()
    if path.exists():
        if path.read_bytes() == data:
            return
        raise ValueError('Output already exists with different content: ' + str(path))
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def contracts(root):
    root = Path(root)
    manifest = json.loads((root / 'website-layer.json').read_text())
    definitions = {}
    for file in manifest['fixtureFiles']:
        for doc in json.loads((root / file).read_text()):
            if doc['doctype'] == 'DocType':
                definitions[doc['name']] = doc
    fields = json.loads((root / 'fixtures/custom_fields.json').read_text())
    if set(definitions) != set(PARENTS) | {CHILD} or len(fields) != 19:
        raise ValueError('Unexpected website package contract')
    return definitions, fields


def normalize(value, field):
    if field.get('fieldtype') in VALUE_TYPES:
        return float(value or 0) if field['fieldtype'] not in {'Check', 'Int'} else int(value or 0)
    return '' if value is None else value


def canonical(doc, definitions):
    dt = doc['doctype']
    if dt not in definitions:
        raise ValueError('Disallowed document type: ' + str(dt))
    result = {'doctype': dt}
    if dt != CHILD:
        result['name'] = doc['name']
    for field in definitions[dt]['fields']:
        key = field['fieldname']
        if field['fieldtype'] == 'Table':
            result[key] = [canonical(dict(row, doctype=field['options']), definitions)
                           for row in doc.get(key, [])]
        else:
            result[key] = normalize(doc.get(key), field)
    return result


def transform_records(records, mappings):
    result = copy.deepcopy(records)
    changes = []
    for doc in result:
        if doc['doctype'] != 'Website Department':
            continue
        rows = []
        seen = set()
        for row in doc.get('item_groups', []):
            old = row['item_group']
            new = mappings.get(old, old)
            if new is None:
                changes.append({'department': doc['name'], 'from': old, 'to': None})
                continue
            if new in seen:
                raise ValueError('Mapping creates duplicate Item Group: ' + new)
            seen.add(new)
            row['item_group'] = new
            rows.append(row)
            if old != new:
                changes.append({'department': doc['name'], 'from': old, 'to': new})
        doc['item_groups'] = rows
    return result, changes


def validate_bundle(bundle, definitions, fields):
    if bundle.get('format') != 1:
        raise ValueError('Unsupported bundle version')
    payload = {k: v for k, v in bundle.items() if k != 'sha256'}
    if digest(payload) != bundle.get('sha256'):
        raise ValueError('Bundle checksum mismatch')
    if bundle.get('contract_sha256') != digest({'definitions': definitions, 'fields': fields}):
        raise ValueError('Source bundle/package contract mismatch')
    seen = set()
    for row in bundle['records']:
        if row.get('doctype') not in PARENTS or not row.get('name'):
            raise ValueError('Bundle contains a non-website document')
        key = (row['doctype'], row['name'])
        if key in seen:
            raise ValueError('Duplicate website document')
        seen.add(key)
        if canonical(row, definitions) != row:
            raise ValueError('Unexpected or noncanonical record/child fields')
    allowed_fields = {dt: {f['fieldname'] for f in fields if f['dt'] == dt}
                      for dt in ('Item', 'Item Group')}
    for row in bundle['field_values']:
        if row.get('doctype') not in allowed_fields or not row.get('name'):
            raise ValueError('Business document import is forbidden')
        if set(row['values']) - allowed_fields[row['doctype']]:
            raise ValueError('Non-website field import is forbidden')
        if not row['values'] or any(v is None for v in row['values'].values()):
            raise ValueError('Only explicit website values belong in sparse overlay')


def identity(frappe, site):
    host = frappe.db.sql('SELECT @@hostname')[0][0]
    return {'site': site, 'database_host': host}


def schema_check(frappe, definitions, fields, require_installed=False):
    conflicts, missing = [], []
    for dt, expected in definitions.items():
        if not frappe.db.exists('DocType', dt):
            missing.append(dt)
            continue
        actual = frappe.get_meta(dt)
        if require_installed and actual.module != 'Green Leaf Website':
            conflicts.append({'doctype': dt, 'reason': 'wrong_module', 'actual': actual.module})
        expected_names = {field['fieldname'] for field in expected['fields']}
        if {field.fieldname for field in actual.fields} != expected_names:
            conflicts.append({'doctype': dt, 'reason': 'unexpected_schema_fields'})
        for field in expected['fields']:
            current = actual.get_field(field['fieldname'])
            if not current:
                conflicts.append({'doctype': dt, 'field': field['fieldname'], 'reason': 'missing_field'})
                continue
            for key, wanted in field.items():
                got = current.get(key)
                if key in {'reqd', 'unique', 'read_only', 'no_copy', 'hidden', 'permlevel'}:
                    got, wanted = int(got or 0), int(wanted or 0)
                if ('' if got is None else got) != ('' if wanted is None else wanted):
                    conflicts.append({'doctype': dt, 'field': field['fieldname'],
                                      'property': key, 'reason': 'schema_diff'})
    for field in fields:
        name = field.get('name') or field['dt'] + '-' + field['fieldname']
        if not frappe.db.exists('Custom Field', name):
            if frappe.get_meta(field['dt']).has_field(field['fieldname']):
                conflicts.append({'field': name, 'reason': 'standard_field_collision'})
            missing.append(name)
            continue
        actual = frappe.get_doc('Custom Field', name)
        # Compare every package-owned behavior, so native fixture import cannot
        # silently widen rights/change defaults in a same-name existing field.
        for key, value in field.items():
            if key in {'doctype', 'name'}:
                continue
            current = actual.get(key)
            if key in {'reqd', 'unique', 'read_only', 'no_copy', 'hidden', 'permlevel'}:
                current, value = int(current or 0), int(value or 0)
            if ('' if current is None else current) != ('' if value is None else value):
                conflicts.append({'field': name, 'property': key, 'reason': 'fixture_diff'})
    return {'conflicts': conflicts, 'missing': missing}


def export_bundle(frappe, site, definitions, fields):
    records = []
    source_schema = {}
    for dt in (*PARENTS, CHILD):
        if not frappe.db.exists('DocType', dt):
            raise ValueError('Missing source DocType: ' + dt)
        meta = frappe.get_meta(dt)
        expected = {f['fieldname']: f for f in definitions[dt]['fields']}
        if {f.fieldname for f in meta.fields} != set(expected):
            raise ValueError('Source has unreviewed Website schema fields: ' + dt)
        for f in meta.fields:
            if f.fieldtype != expected[f.fieldname]['fieldtype'] or (f.options or '') != (expected[f.fieldname].get('options') or ''):
                raise ValueError('Source schema differs from package: ' + dt + '.' + f.fieldname)
        source_schema[dt] = {'module': meta.module, 'custom': meta.custom,
                            'fields': [{'fieldname': f.fieldname, 'fieldtype': f.fieldtype,
                                        'options': f.options} for f in meta.fields]}
    for dt in PARENTS:
        for row in frappe.get_all(dt, fields=['name'], order_by='name asc'):
            records.append(canonical(frappe.get_doc(dt, row.name).as_dict(), definitions))
    sparse, null_counts = [], {}
    for dt in ('Item', 'Item Group'):
        names = [f['fieldname'] for f in fields if f['dt'] == dt]
        rows = frappe.get_all(dt, fields=['name', *names], order_by='name asc')
        null_counts[dt] = {key: sum(row.get(key) is None for row in rows) for key in names}
        for row in rows:
            values = {key: row[key] for key in names if row.get(key) is not None}
            if values:
                sparse.append({'doctype': dt, 'name': row.name, 'values': values})
    result = {'format': 1, 'exported_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'source': identity(frappe, site),
              'contract_sha256': digest({'definitions': definitions, 'fields': fields}),
              'source_schema': source_schema,
              'source_custom_fields': [frappe.get_doc('Custom Field', f.get('name') or f['dt'] + '-' + f['fieldname']).as_dict() for f in fields],
              'records': records, 'field_values': sparse, 'inherited_null_counts': null_counts,
              'excluded': ['Customer documents', 'Quotation documents', 'website credentials',
                           'payment events', 'DB users/grants', 'secrets', 'ERP files']}
    result['sha256'] = digest(result)
    return result


def make_plan(frappe, site, bundle, definitions, fields, mappings, lock=False):
    schema = schema_check(frappe, definitions, fields, require_installed=True)
    if schema['conflicts'] or schema['missing']:
        raise ValueError('Install reviewed app/schema first: ' + json.dumps(schema))
    desired, remapped = transform_records(bundle['records'], mappings)
    plan = {'format': 1, 'target': identity(frappe, site), 'bundle_sha256': bundle['sha256'],
            'mapping_sha256': digest(mappings), 'remapped': remapped,
            'insert': [], 'equal': [], 'field_updates': [], 'conflicts': [], 'missing_links': []}
    defaults = {(f['dt'], f['fieldname']): normalize(f.get('default'), f) for f in fields}
    field_contracts = {(f['dt'], f['fieldname']): f for f in fields}
    for doc in desired:
        dt, name = doc['doctype'], doc['name']
        if lock:
            frappe.db.sql('SELECT name FROM `tab' + dt + '` WHERE name=%s FOR UPDATE', name)
        links = ([('Item Group', r['item_group']) for r in doc.get('item_groups', [])]
                 if dt == 'Website Department' else
                 [('Item', doc['item_code'])] if dt == 'Website Featured Product' else [])
        for link_dt, link_name in links:
            if not frappe.db.exists(link_dt, link_name):
                plan['missing_links'].append({'doctype': link_dt, 'name': link_name, 'source': name})
        if not frappe.db.exists(dt, name):
            plan['insert'].append(doc)
            continue
        current = canonical(frappe.get_doc(dt, name).as_dict(), definitions)
        if current == doc:
            plan['equal'].append({'doctype': dt, 'name': name, 'sha256': digest(current)})
        else:
            plan['conflicts'].append({'doctype': dt, 'name': name,
                                      'actual_sha256': digest(current), 'desired_sha256': digest(doc)})
    for row in bundle['field_values']:
        dt, name = row['doctype'], row['name']
        if not frappe.db.exists(dt, name):
            plan['missing_links'].append({'doctype': dt, 'name': name, 'source': 'field_values'})
            continue
        if lock:
            frappe.db.sql('SELECT name FROM `tab' + dt + '` WHERE name=%s FOR UPDATE', name)
        current = frappe.db.get_value(dt, name, list(row['values']), as_dict=True)
        changes = {}
        for key, wanted in row['values'].items():
            contract = field_contracts[(dt, key)]
            actual = normalize(current[key], contract)
            wanted = normalize(wanted, contract)
            if contract['fieldtype'] == 'Link' and wanted and not frappe.db.exists(contract['options'], wanted):
                plan['missing_links'].append({'doctype': contract['options'], 'name': wanted,
                                              'source': dt + '.' + key})
            if actual == wanted:
                continue
            if actual != defaults[(dt, key)]:
                plan['conflicts'].append({'doctype': dt, 'name': name, 'field': key,
                                          'reason': 'nondefault_target_value'})
            else:
                changes[key] = {'before': current[key], 'after': wanted}
        if changes:
            plan['field_updates'].append({'doctype': dt, 'name': name, 'changes': changes})
    plan['sha256'] = digest(plan)
    return plan


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--action', choices=['export', 'schema', 'plan', 'apply'], default='plan')
    parser.add_argument('--site', required=True)
    parser.add_argument('--sites-path', default='.')
    parser.add_argument('--schema-root', required=True)
    parser.add_argument('--bundle')
    parser.add_argument('--output', required=True)
    parser.add_argument('--mapping')
    parser.add_argument('--expect-database-host', required=True)
    parser.add_argument('--expect-plan-sha256')
    args = parser.parse_args(argv)
    definitions, fields = contracts(args.schema_root)
    mappings = json.loads(Path(args.mapping).read_text())['mappings'] if args.mapping else {}
    bundle = None
    if args.action in {'plan', 'apply'}:
        if not args.bundle:
            parser.error('--bundle is required')
        bundle = json.loads(Path(args.bundle).read_text())
        validate_bundle(bundle, definitions, fields)
    if args.action == 'apply' and not args.expect_plan_sha256:
        parser.error('--expect-plan-sha256 from a reviewed plan is required')
    if Path(args.output).exists():
        raise ValueError('Choose a new output receipt path')
    import frappe
    frappe.init(site=args.site, sites_path=args.sites_path)
    frappe.connect()
    try:
        target = identity(frappe, args.site)
        if target['database_host'] != args.expect_database_host:
            raise ValueError('Database host identity mismatch')
        frappe.set_user('Administrator')
        frappe.db.rollback()
        if args.action != 'apply':
            frappe.db.sql('START TRANSACTION READ ONLY')
        else:
            frappe.db.begin()
        if args.action == 'export':
            result = export_bundle(frappe, args.site, definitions, fields)
        elif args.action == 'schema':
            result = dict(schema_check(frappe, definitions, fields), target=target)
            result['sha256'] = digest(result)
        else:
            result = make_plan(frappe, args.site, bundle, definitions, fields, mappings,
                               lock=args.action == 'apply')
            if args.action == 'apply':
                if result['sha256'] != args.expect_plan_sha256:
                    raise ValueError('Compare-and-swap failed: target changed after plan')
                if result['conflicts'] or result['missing_links']:
                    raise ValueError('Import conflicts or broken links; nothing committed')
                for row in result['insert']:
                    doc = frappe.get_doc(row).insert()
                    if doc.name != row['name']:
                        raise ValueError('Unexpected native document name')
                    if canonical(doc.as_dict(), definitions) != row:
                        raise ValueError('Native insert changed intended content')
                for row in result['field_updates']:
                    frappe.db.set_value(row['doctype'], row['name'],
                                        {k: v['after'] for k, v in row['changes'].items()},
                                        update_modified=False)
                # No writes are committed if the receipt cannot first be saved.
                write_json(args.output, {'status': 'prepared', 'plan': result})
                frappe.db.commit()
                committed = {'status': 'committed', 'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                             'target': target, 'plan_sha256': result['sha256'],
                             'inserted': len(result['insert']), 'field_updates': len(result['field_updates']),
                             'equal': len(result['equal'])}
                write_json(args.output + '.committed.json', committed)
                print(json.dumps(committed))
                return
        write_json(args.output, result)
        print(json.dumps({'action': args.action, 'output': args.output, 'sha256': result.get('sha256'),
                          'conflicts': len(result.get('conflicts', [])), 'missing_links': len(result.get('missing_links', [])),
                          'insert': len(result.get('insert', [])), 'equal': len(result.get('equal', []))}))
        if result.get('conflicts') or result.get('missing_links'):
            raise SystemExit(2)
    finally:
        frappe.db.rollback()
        frappe.destroy()


if __name__ == '__main__':
    main()
