# ERPNext Patches

Production ERPNext changes should be added here as repeatable patch notes or scripts.

Preferred order:

1. Export fixtures from staging after review.
2. Apply to a fresh ERPNext copy.
3. Run `npm run erpnext:validate`.
4. Run website `npm run smoke` with the website containers attached to the ERPNext network.
5. Apply the same fixtures to production during a maintenance window.

Avoid editing ERPNext core or forking ERPNext unless a standard fixture, server script, custom app hook, or permission change cannot solve the problem.
