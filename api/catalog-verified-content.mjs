// These ERP fields were checked against the original product title and selling pack.
// Hashes bind the alternate field and the ERP identity to the reviewed snapshot.
const reviewedPhotos = [
  ["BIO-B-LBL-N-SMALL", "ff9c5db2eeca48edee55175e1cd671b71a9a03fb766f311826bbe978a9e7c9d8"],
  ["BIO-BCL-12PLA", "5a2a5417e42560055be5193183aae3bb5b8081f2a0129a94e98009e94bd197f4"],
  ["BIO-R-200Y", "4cfc4dbc071ac3becf8e298cb658c2d702b9f8f5af94f433b0a554d274a551c4"],
  ["WIN-MHH-5", "752d0f39096aa5312e61b9aa1f76ad908e11c991f86c047a0ad71774036018a9"]
];
const reviewedDescriptions = [
  ["ALT-AT-ADCF-3", "8624c274168c25144d974e4cf58c0dd7b28719919e906ad7b4252a9dd02d4d7d"],
  ["ALT-AT-ADUF-1", "9dad797f1d96fdf587e3a217cccd84a7b49fb7fa81875c78689b5d22839e15df"]
];

function matchesReview(rowAlias, proofs, fields) {
  const ids = proofs.map(([sku]) => `'${sku}'`).join(", ");
  const hashes = proofs.map(([sku, hash]) => `WHEN '${sku}' THEN '${hash}'`).join(" ");
  // Evaluate hashes only for the small set of reviewed rows.
  return `${rowAlias}.name IN (${ids})
    AND SHA2(CONCAT_WS(CHAR(31), ${fields.join(", ")}), 256) =
        CASE ${rowAlias}.name ${hashes} END`;
}

function reviewedImageMatchSql(alias) {
  return matchesReview(alias, reviewedPhotos, [`COALESCE(${alias}.item_name, '')`, `COALESCE(${alias}.thumbnail, '')`]);
}

export function imageReadySql(alias, hasThumbnail) {
  const primary = `IFNULL(${alias}.image, '') <> ''`;
  return hasThumbnail ? `(${primary} OR (${reviewedImageMatchSql(alias)}))` : primary;
}

export function reviewedImageSql(alias) {
  const match = reviewedImageMatchSql(alias);
  return `CASE WHEN IFNULL(${alias}.image, '') = '' AND ${match} THEN ${alias}.thumbnail ELSE ${alias}.image END`;
}

export function reviewedDescriptionMatchSql(primary) {
  return matchesReview("i", reviewedDescriptions, ["COALESCE(i.item_name, '')", primary, "COALESCE(i.woocommerce_description, '')"]);
}

export function reviewedDescriptionSql(primary) {
  const match = reviewedDescriptionMatchSql(primary);
  return `CASE WHEN ${match} THEN i.woocommerce_description ELSE ${primary} END`;
}

const reviewedUnitSymbols = new Set(["WIN-TMT-P1", "WIN-TMT-P2", "WIN-TMT-P3"]);
const reviewedBladeSpacing = new Set(["WIN-TKP-41", "WIN-TN43"]);

export function displayItemName(sku, name) {
  // The previous public English titles confirm the original symbols and spacing.
  if (reviewedUnitSymbols.has(sku)) return name.replaceAll("Â°C", "°C");
  if (reviewedBladeSpacing.has(sku)) return name.replaceAll("Â\u00a0", " ");
  return sku === "BIO-R-200Y" ? name.replaceAll("\u00e2\u20ac\u201c", "–") : name;
}

// Supplier copy sometimes puts a component price beside its dimensions or material.
const currencyCode = "(?:FJD|USD|AUD|NZD|CAD|EUR|GBP)";
const amount = String.raw`\d+(?:[,.]\d{3})*(?:[.,]\d{1,2})?`;
const gap = String.raw`(?:\s|&nbsp;|&#160;|&#x0*a0;)*`;
const dollar = String.raw`(?:\$|&#0*36;|&#x0*24;|&dollar;)`;
const prefix = String.raw`(?:\b${currencyCode}${gap}${dollar}?|(?:US|FJ|AU?|NZ|CA)?${dollar}|[£€])`;
const hasCurrency = new RegExp(String.raw`${currencyCode}|${dollar}|[£€]`, "i");
const embeddedPrice = new RegExp(String.raw`[ \t]*(?:[-–—][ \t]*)?(?:${prefix}${gap}${amount}|${amount}${gap}${currencyCode}\b)`, "gi");

export function withoutEmbeddedPrices(text, sku) {
  if (!hasCurrency.test(text)) return text;
  const clean = text.replace(embeddedPrice, "");
  if (sku === "ART-SB2050RT" && clean !== text) {
    return clean.replace("Additional/board for logo engraving", "Logo engraving is available at an additional charge per board.");
  }
  return clean;
}
