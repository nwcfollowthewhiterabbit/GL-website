# Процессы

Текущие сквозные процессы:

1. Catalog -> Order basket -> ERPNext Quotation.
2. Customer login -> scoped ERP documents -> customer-facing status.
3. Eligible ERP document -> Windcave HPP -> verified result -> ERP update.
4. Commit -> CI -> website-only deploy -> public validation.

Полные последовательности и error/repeat behavior:
[golden-path.md](golden-path.md).

Процесс считается подтвержденным только при проверке backend effect и
наблюдаемого результата, а не по наличию UI.
