# PCI DSS v4.0.1 SAQ A-EP working paper

Status: pre-assessment draft, not for submission or signature.

Source: `PCI-DSS-v4-0-1-SAQ-A-EP (E-Commerce).pdf`, supplied by Westpac.
Assessment target: the future production e-commerce payment environment.
Testing-site evidence is preparatory evidence only.

## Mandatory pre-submission reminder

Westpac stated that Windcave covers vulnerability scanning when HPP is used.
However, the supplied SAQ A-EP Requirement 11.3.2 requires passing external
vulnerability scans by a PCI SSC Approved Scanning Vendor at least once every
three months.

Before Requirement 11 is completed or the AOC is signed:

1. Remind the team of this conflict.
2. Obtain written confirmation from Westpac identifying who performs the
   merchant-side ASV scan.
3. Obtain the required passing report or written submission instruction.
4. Do not infer that Windcave's HPP compliance satisfies the merchant web
   server requirement without that confirmation.

## Current scope boundary

- Card entry is planned on Windcave Hosted Payment Page.
- The merchant website must not receive, store, process, or transmit PAN, CVV,
  PIN data, or full track data.
- The website creates a payment request and redirects the browser to Windcave.
- The callback stores provider reference, status, amount, and payable document
  linkage only.
- Payment activation, callback UAT, Payment Entry creation, and reconciliation
  are not yet complete.
- Production ERPNext upgrade is intentionally deferred until the final
  infrastructure stage and remains a production launch gate.

## Section 1 draft data

### Part 1a: Assessed Merchant

| Field | Draft value | Status |
| --- | --- | --- |
| Company name | Green Leaf Ltd / Green Leaf Pte Ltd | Must be confirmed against Westpac merchant records |
| DBA | Green Leaf Pacific | Confirm |
| Mailing address | 4 Nippon Complex, Nadi Backroad, Nadi, Fiji; P.O. Box 11994 Nadi Airport | Confirm official format |
| Main website | `https://greenleafpacific.com` | Confirm production URL |
| Contact name | TBD | Required from team |
| Contact title | TBD | Required from team |
| Contact phone | +679 670 2222 | Confirm official PCI contact number |
| Contact email | `buy@greenleafpacific.com` | Confirm official PCI contact email |

### Part 1b: Assessor

No QSA or ISA has been identified. Enter `Not Applicable` only after the
merchant confirms the assessment is being completed without QSA/ISA
involvement.

## Section 2 Executive Summary draft

### Part 2a: Payment channels

- Include: E-Commerce.
- MOTO and card-present status: team must identify whether these channels exist
  and whether they are excluded from this assessment.

### Part 2b: Role with payment cards

Draft wording, to verify after Windcave UAT:

> E-Commerce: The merchant website prepares an approved payable transaction
> and redirects the customer's browser to the Windcave Hosted Payment Page.
> Customers enter cardholder data only on Windcave systems. Merchant website
> and ERP systems do not receive, store, process, or transmit PAN, CVV, PIN
> data, or full track data.

### Part 2c: Payment card environment

Draft wording, to verify against the final production architecture:

> The in-scope environment consists of the merchant-managed public website,
> website API, deployment pipeline, hosting platform, administrative access,
> and the redirect/callback integration with Windcave. The website validates
> the payable ERP document, creates a Windcave HPP session, and redirects the
> customer's browser to Windcave for card entry. Windcave returns an
> authenticated payment result. Merchant systems retain order, invoice,
> payment status, amount, and provider reference data only and do not retain
> account data.

Do not select segmentation until the final hosting network diagram and shared
host isolation have been reviewed.

### Part 2d: In-scope locations

Still required:

- Merchant office/location involved in payment administration.
- Hosting/data-center provider and location.
- Any support or operations location with administrative access.

### Part 2e: PCI SSC validated products

Do not list Windcave automatically. Confirm whether the exact product and
version used appears on an applicable PCI SSC validated product list and obtain
the listing reference and expiry date.

### Part 2f: Third-party service providers

| Provider | Service | Evidence required |
| --- | --- | --- |
| Windcave | Hosted Payment Page, payment processing, card-data environment | Current PCI DSS compliance confirmation/AOC for services used |
| Hosting provider | Website hosting and infrastructure | Legal name, service description, security/PCI responsibility confirmation |
| Development/operations provider | Bespoke website development, deployment, and support | Legal name, agreement, access scope, responsibility matrix |
| GitHub | Source repository and CI workflow | Scope decision and account/access controls |
| Other DNS/CDN/email/security providers | As applicable | Confirm final production architecture |

### Part 2h: Eligibility

The planned HPP flow supports the technical no-card-data criteria. Eligibility
must not be certified until:

- production redirect and callback behavior are verified;
- every payment-page element is confirmed to originate only from the merchant
  or Windcave as allowed by the supplied form;
- Windcave compliance evidence is obtained;
- hosting TPSP compliance responsibility is documented;
- the merchant confirms whether any account data is retained on paper.

## Preliminary requirement matrix

`Partial` means useful technical evidence exists but the full expected testing
and operational evidence are not complete.

| Requirement | Preliminary status | Existing evidence | Missing before `In Place` |
| --- | --- | --- | --- |
| 1 Network security controls | Partial | Docker network separation, restricted public website binding, documented boundaries | Approved NSC policy, network and data-flow diagrams, allowed service/port inventory, six-month rule review, shared-host scope decision |
| 2 Secure configurations | Partial | Non-root/read-only containers, dropped capabilities, Nginx hardening, TLS configuration | Approved configuration baseline, default-account review, SSH hardening, unnecessary host service review |
| 3 Stored account data | Partial | No card form; HPP boundary; payment event schema excludes PAN/CVV | Written data-retention policy, production verification, paper-data confirmation |
| 4 Transmission security | Partial | TLS 1.2/1.3, HSTS, secure redirect design | Production HPP/UAT evidence and documented cryptography procedure |
| 5 Malware and phishing | Not in place / unknown | Host security updates and fail2ban | Anti-malware control or documented periodic risk evaluation, anti-phishing mechanism, related policies and monitoring |
| 6 Secure development | Partial | CI, repository checks, dependency audit, code review history, controlled deploy and rollback | Formal SDLC policy, annual secure-development training, vulnerability ranking/patch procedure, software inventory, automated web-attack protection |
| 7 Least privilege | Partial | Non-root containers and restricted website database user | Approved access matrix, authorization records, periodic user/service-account reviews |
| 8 Authentication and MFA | Not in place / unknown | Customer login rate limiting and secure session cookie | Administrative account inventory, unique IDs, lifecycle procedure, password policy evidence, MFA for all applicable administrative/remote access |
| 9 Physical access/media | Likely N/A in part | No electronic card-data storage | Merchant confirmation of no paper card data; facility responsibility; Appendix C explanations |
| 10 Logging and monitoring | Not in place | Structured logs, auditd, health metrics, deployment smoke checks | Protected centralized logs, 12-month retention, daily/periodic review evidence, alert recipient/on-call process, time-sync evidence package |
| 11 Security testing | Not in place | Internal security review and automated smoke/security checks | Westpac/ASV clarification, passing ASV report, penetration-test methodology and report, IDS/IPS, file-integrity monitoring |
| 12 Security program | Not in place | Technical security-boundary and operations notes | Approved information-security policy, targeted risk analyses, awareness training, TPSP register/agreements/AOC monitoring, incident-response plan and responsible personnel |

## Candidate Not Applicable explanations

These are drafts only and must be checked against the final implementation.

### Requirement 6.4.3

> Not applicable because the merchant server performs a URL redirect to the
> Windcave Hosted Payment Page and does not provide a payment form or
> payment-page scripts to the consumer's browser.

### Requirement 11.6.1

> Not applicable because the merchant server performs a URL redirect to the
> Windcave Hosted Payment Page and does not host or embed the payment page.

### Physical media requirements

> Not applicable if the merchant confirms that no paper or removable media
> containing account data is created, received, or retained.

Every `Not Applicable` response must be copied into Appendix C of the SAQ with
the final, verified explanation.

## Work that can proceed before ERPNext upgrade

1. Confirm company/contact/signatory information.
2. Produce the final network and payment data-flow diagrams.
3. Create the security policies and evidence registers.
4. Harden administrative access and implement MFA.
5. Configure centralized log retention, alert routing, and file-integrity
   monitoring.
6. Engage an ASV and independent penetration tester, subject to Westpac's
   written ASV clarification.
7. Complete Windcave UAT after credentials arrive.
8. Reassess the final production environment after the deferred ERPNext
   upgrade, then transfer verified answers into the PDF.
