# Data Model: RFQ And Cart

## RfqRequest

Payload collection: `rfq-requests`.

- `status`: `new`, `in_progress`, `quoted`, `closed`.
- `sourcePage`: page/query where request was submitted.
- `customerType`: `company`, `person`, `integrator`.
- `companyName`: company or buyer name.
- `inn`: tax ID for company quote/invoice.
- `contactName`: required contact person.
- `email`: contact email.
- `phone`: contact phone.
- `city`: delivery city.
- `deadline`: desired timing.
- `items`: JSON text with SKU/name/quantity rows.
- `message`: buyer comment.
- `technicalSpec`: pasted technical specification or equipment list.
- `analytics`: JSON metadata for source and user agent.

## RfqItem

- `sku`: product SKU.
- `name`: product name or custom line description.
- `quantity`: requested quantity.
