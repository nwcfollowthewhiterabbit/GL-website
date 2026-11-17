"""Expose public storefront configuration; never expose the admin credential."""
from urllib.parse import urlsplit


def validated_public_url(value):
    value = str(value or '').strip().rstrip('/')
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or
            parsed.password or parsed.query or parsed.fragment or parsed.path):
        return ''
    return value


def validated_api_url(value):
    value = str(value or '').strip().rstrip('/')
    parsed = urlsplit(value)
    if (not parsed.hostname or parsed.username or parsed.password or parsed.query or
            parsed.fragment or parsed.path):
        return ''
    if parsed.scheme == 'https' or (parsed.scheme == 'http' and parsed.hostname in {'website-api', 'api'}):
        return value
    return ''


def boot_session(bootinfo):
    import frappe
    roles = set(frappe.get_roles())
    bootinfo.greenleaf_website = {
        'public_url': validated_public_url(frappe.conf.get('website_public_url')),
        'customer_access_enabled': bool('System Manager' in roles and
                                        frappe.conf.get('website_admin_api_token') and
                                        validated_api_url(frappe.conf.get('website_api_url'))),
    }
