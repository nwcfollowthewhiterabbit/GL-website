"""Narrow ERP-admin bridge; website bearer credential stays on the server."""
import frappe
import requests
from greenleaf_website.boot import validated_api_url


@frappe.whitelist()
def customer_access(action='list', payload=None):
    frappe.only_for('System Manager')
    routes = {'list': ('GET', '/api/admin/customer-access'),
              'link': ('POST', '/api/admin/customer-access/link'),
              'disable': ('POST', '/api/admin/customer-access/disable')}
    if action not in routes:
        frappe.throw('Unsupported website action', frappe.PermissionError)
    if action != 'list' and frappe.request.method != 'POST':
        frappe.throw('POST required', frappe.PermissionError)
    url = validated_api_url(frappe.conf.get('website_api_url'))
    token = str(frappe.conf.get('website_admin_api_token') or '')
    if not url or len(token) < 32:
        frappe.throw('Website customer access is not configured')
    payload = frappe.parse_json(payload) if isinstance(payload, str) else (payload or {})
    allowed = {'list': {'q', 'limit'}, 'link': {'customer', 'email', 'firstName', 'lastName'},
               'disable': {'email'}}[action]
    if not isinstance(payload, dict) or set(payload) - allowed:
        frappe.throw('Invalid website action payload')
    if action == 'list':
        payload['limit'] = min(max(int(payload.get('limit') or 12), 1), 100)
    method, path = routes[action]
    try:
        response = requests.request(method, url + path,
                                    headers={'Authorization': 'Bearer ' + token},
                                    params=payload if method == 'GET' else None,
                                    json=payload if method == 'POST' else None,
                                    timeout=15, allow_redirects=False)
        if response.status_code != 200:
            frappe.throw('Website customer access request failed')
        result = response.json()
    except (requests.RequestException, ValueError):
        frappe.throw('Website customer access is temporarily unavailable')
    return result
