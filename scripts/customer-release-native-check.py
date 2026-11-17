#!/usr/bin/env python3
"""Target-guarded native stage fixture/cleanup. JSON stdin; secrets never accepted.

Run with the target bench Python, from its sites directory. Required environment:
CUSTOMER_NATIVE_SITE and CUSTOMER_NATIVE_DB_HOSTNAME (verified physical @@hostname).
Input: {action: fixture|cleanup, runId, owned:{accounts,quotations,salesOrders?,quoteRequestIds?}}.
quoteRequestIds maps an exact Quotation name to its captured browser GLQ-UUID id.
Output is a sanitized receipt. Does not submit documents or restore databases.
"""
import datetime
import json
import os
import re
import sys

import frappe

FINANCIAL = ("Sales Invoice", "Payment Entry", "GL Entry", "Stock Ledger Entry")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def exact_names(doctype, filters):
    return set(frappe.get_all(doctype, filters=filters, pluck="name"))


def financial_counts():
    return {doctype: frappe.db.count(doctype) for doctype in FINANCIAL}


def no_background_side_effect(*_args, **_kwargs):
    raise RuntimeError("Native fixture attempted mail/background work; transaction refused")


def validate_accounts(payload):
    run_id = payload["runId"]
    require(re.fullmatch(r"GL-WEB-E2E-[A-Za-z0-9-]{1,60}", run_id), "Invalid synthetic run id")
    accounts = payload["owned"]["accounts"]
    require(isinstance(accounts, list) and 1 <= len(accounts) <= 10, "Bounded account receipt required")
    seen = set()
    for account in accounts:
        customer = account.get("customer", "")
        email = account.get("email", "")
        require(customer and customer not in seen, "Unique exact Customer ids required")
        seen.add(customer)
        require(email.startswith(run_id.lower() + "-") and email.endswith("@example.invalid"), "Only this run's synthetic mailbox allowed")
        doc = frappe.get_doc("Customer", customer)
        require(doc.customer_name == account.get("company") and doc.customer_name.startswith(run_id + " "), "Customer marker mismatch")
        require((doc.email_id or "").strip().lower() == email, "Customer email mismatch")
        require(not exact_names("Sales Invoice", {"customer": customer}), "Customer has invoices; refusing mutation")
        require(not exact_names("Payment Entry", {"party_type": "Customer", "party": customer}), "Customer has payments; refusing mutation")
    return accounts


def validate_quote(name, accounts, run_id, quote_request_ids=None):
    quote = frappe.get_doc("Quotation", name)
    customers = {account["customer"]: account["email"] for account in accounts}
    require(quote.docstatus == 0 and quote.quotation_to == "Customer" and quote.party_name in customers, "Quotation is not an owned draft")
    request_id = quote.website_quote_id or ""
    captured_ids = quote_request_ids if quote_request_ids is not None else {}
    require(isinstance(captured_ids, dict), "Exact quotation request-id mapping required")
    generated_id = re.fullmatch(r"GLQ-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", request_id)
    captured_browser_id = bool(generated_id and captured_ids.get(name) == request_id)
    require(request_id.startswith(run_id + "-") or captured_browser_id, "Quotation run marker or exact captured browser id mismatch")
    require((quote.website_customer_email or "").lower() == customers[quote.party_name], "Quotation verified email mismatch")
    require(run_id in (quote.enq_det or ""), "Quotation notes marker mismatch")
    return quote


def validate_order(name, accounts, run_id):
    order = frappe.get_doc("Sales Order", name)
    require(order.docstatus == 0 and order.customer in {account["customer"] for account in accounts}, "Order is not an owned draft")
    require(order.po_no == run_id, "Order exact marker mismatch")
    return order


def remove_energy_logs(customer, expected_user):
    rows = frappe.get_all("Energy Point Log", filters={"reference_doctype": "Customer", "reference_name": customer},
                          fields=["name", "owner", "user", "type", "rule", "points", "reverted"])
    require(len(rows) <= 3, "Unexpected number of synthetic Customer energy logs")
    for row in rows:
        require(row.user == expected_user and row.type == "Auto" and row.rule == "On Customer Creation"
                and row.points == 5 and not row.reverted, "Unexpected energy log; refusing removal")
        frappe.delete_doc("Energy Point Log", row.name)
    if rows:
        frappe.cache.hdel("energy_points", expected_user)
    return len(rows)


def create_fixture(payload, accounts):
    run_id = payload["runId"]
    names = payload["owned"].get("quotations", [])
    require(isinstance(names, list) and 1 <= len(names) <= 20, "Bounded exact quotation receipt required")
    quotes = [validate_quote(name, accounts, run_id, payload["owned"].get("quoteRequestIds")) for name in names]
    customer = accounts[0]["customer"]
    quote = next((doc for doc in quotes if doc.party_name == customer), None)
    require(quote is not None, "First Customer has no owned quotation")
    existing = exact_names("Sales Order", {"customer": customer, "po_no": run_id})
    require(len(existing) <= 1, "Ambiguous native fixture marker")
    if existing:
        order = validate_order(next(iter(existing)), accounts, run_id)
        created = False
    else:
        today = frappe.utils.getdate(frappe.utils.nowdate())
        delivery = today + datetime.timedelta(days=14)
        order = frappe.get_doc({
            "doctype": "Sales Order", "customer": customer, "company": quote.company,
            "transaction_date": str(today), "delivery_date": str(delivery),
            "currency": quote.currency, "selling_price_list": quote.selling_price_list,
            "conversion_rate": quote.conversion_rate or 1,
            "order_type": "Sales", "po_no": run_id,
            "items": [{"item_code": item.item_code, "qty": item.qty, "rate": item.rate,
                       "uom": item.uom, "conversion_factor": item.conversion_factor or 1,
                       "delivery_date": str(delivery)} for item in quote.items],
        })
        order.insert()
        created = True
    require(order.docstatus == 0 and order.status == "Draft", "Fixture must remain draft")
    return {"created": created, "salesOrder": order.name, "status": order.status, "customer": customer,
            "owned": {**payload["owned"], "salesOrders": sorted(set(payload["owned"].get("salesOrders", []) + [order.name]))}}


def cleanup(payload, accounts):
    run_id = payload["runId"]
    quotes = set(payload["owned"].get("quotations", []))
    orders = set(payload["owned"].get("salesOrders", []))
    require(len(quotes) <= 20 and len(orders) <= 10, "Cleanup receipt exceeds bounds")
    for name in quotes:
        validate_quote(name, accounts, run_id, payload["owned"].get("quoteRequestIds"))
    for name in orders:
        validate_order(name, accounts, run_id)
    contacts = {}
    credential_names = []
    challenge_names = []
    owners = {}
    for account in accounts:
        customer, email = account["customer"], account["email"]
        require(exact_names("Quotation", {"party_name": customer, "quotation_to": "Customer"}) ==
                {name for name in quotes if frappe.db.get_value("Quotation", name, "party_name") == customer}, "Customer has unlisted quotations")
        require(exact_names("Sales Order", {"customer": customer}) ==
                {name for name in orders if frappe.db.get_value("Sales Order", name, "customer") == customer}, "Customer has unlisted orders")
        owners[customer] = frappe.db.get_value("Customer", customer, "owner")
        linked_contacts = exact_names("Dynamic Link", {"parenttype": "Contact", "link_doctype": "Customer", "link_name": customer})
        # Dynamic Link names are child-row ids; fetch their exact parent Contact ids.
        contact_names = {frappe.db.get_value("Dynamic Link", name, "parent") for name in linked_contacts}
        for name in contact_names:
            contact = frappe.get_doc("Contact", name)
            require(contact.links and all(link.link_doctype == "Customer" and link.link_name == customer for link in contact.links), "Contact links other business data")
            require(any((row.email_id or "").lower() == email for row in contact.email_ids), "Contact synthetic email mismatch")
        contacts[customer] = sorted(contact_names)
        credentials = frappe.db.sql("SELECT name,email FROM `tabWebsite Customer Credential` WHERE customer=%s", (customer,), as_dict=True)
        require(all(row.email == email for row in credentials), "Credential receipt mismatch")
        credential_names.extend(row.name for row in credentials)
        challenges = frappe.db.sql("SELECT name,email FROM `tabWebsite Account Challenge` WHERE BINARY email=BINARY %s", (email,), as_dict=True)
        require(all(row.email == email for row in challenges), "Challenge receipt mismatch")
        challenge_names.extend(row.name for row in challenges)
    removed_energy = 0
    for name in orders:
        frappe.delete_doc("Sales Order", name)
    for name in quotes:
        frappe.delete_doc("Quotation", name)
    for name in credential_names:
        frappe.db.sql("DELETE FROM `tabWebsite Customer Credential` WHERE name=%s", (name,))
    for name in challenge_names:
        frappe.db.sql("DELETE FROM `tabWebsite Account Challenge` WHERE name=%s", (name,))
    for account in accounts:
        customer = account["customer"]
        removed_energy += remove_energy_logs(customer, owners[customer])
        frappe.db.set_value("Customer", customer, "customer_primary_contact", None)
        for name in contacts[customer]:
            frappe.delete_doc("Contact", name)
        frappe.delete_doc("Customer", customer)
        # Customer on_change can create a fresh +5 EPS record during deletion.
        removed_energy += remove_energy_logs(customer, owners[customer])
        require(not frappe.db.exists("Customer", customer), "Customer cleanup failed")
        require(not frappe.db.sql("SELECT name FROM `tabWebsite Customer Credential` WHERE customer=%s", (customer,)), "Credential cleanup failed")
        require(not frappe.db.exists("Energy Point Log", {"reference_doctype": "Customer", "reference_name": customer}), "Energy cleanup failed")
    return {"deleted": {"customers": [account["customer"] for account in accounts], "quotations": sorted(quotes),
                        "salesOrders": sorted(orders), "contacts": contacts, "credentials": len(credential_names),
                        "challenges": len(challenge_names), "energyLogs": removed_energy}}


def main():
    payload = json.load(sys.stdin)
    require(payload.get("action") in ("fixture", "cleanup"), "Explicit fixture/cleanup action required")
    site = os.environ.get("CUSTOMER_NATIVE_SITE", "")
    expected_host = os.environ.get("CUSTOMER_NATIVE_DB_HOSTNAME", "")
    require(site and expected_host, "Verified site and physical database hostname required")
    frappe.init(site=site, sites_path=os.environ.get("CUSTOMER_NATIVE_SITES_PATH", "."))
    frappe.connect()
    old_sendmail, old_enqueue = frappe.sendmail, frappe.enqueue
    try:
        require(frappe.db.sql("SELECT @@hostname")[0][0] == expected_host, "Physical database target mismatch")
        frappe.set_user("Administrator")
        frappe.sendmail = no_background_side_effect
        frappe.enqueue = no_background_side_effect
        accounts = validate_accounts(payload)
        before = financial_counts()
        recipients = [account["email"] for account in accounts]
        mail_before = frappe.db.count("Email Queue Recipient", {"recipient": ["in", recipients]})
        result = create_fixture(payload, accounts) if payload["action"] == "fixture" else cleanup(payload, accounts)
        after = financial_counts()
        require(after == before, "Financial document counts changed")
        require(frappe.db.count("Email Queue Recipient", {"recipient": ["in", recipients]}) == mail_before, "Synthetic outgoing mail created")
        frappe.db.commit()
        print(json.dumps({"action": payload["action"], "runId": payload["runId"], "committed": True,
                          "completedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                          "financialCountsBefore": before, "financialCountsAfter": after,
                          "financialDocumentsUnchanged": True, "syntheticEmailRecipientsAdded": 0, **result}, default=str))
    finally:
        frappe.sendmail, frappe.enqueue = old_sendmail, old_enqueue
        frappe.db.rollback()
        frappe.destroy()


if __name__ == "__main__":
    main()
