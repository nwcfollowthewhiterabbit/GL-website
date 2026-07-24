# Доменная модель

## Основные сущности

- **Item / Item Group / Item Price / Bin**: catalog, grouping, price and stock.
- **Website content records**: departments, banners, catalogues, manufacturers,
  featured products and customer corner settings.
- **Customer / Contact**: ERP identity and account scope.
- **Website Customer Credential**: customer link, email and password hash.
- **Quotation / Sales Order / Sales Invoice**: customer-visible sales documents.
- **Payment session/result**: Windcave reference tied to one payable ERP document.

## Связи

Customer email разрешается только через ERP Contact/Customer links. Sales
documents принадлежат Customer. Payment result должен ссылаться на один payable
document и не может менять сумму после создания provider session.

Инварианты: [invariants.md](invariants.md). Жизненный цикл:
[data-lifecycle.md](data-lifecycle.md).
