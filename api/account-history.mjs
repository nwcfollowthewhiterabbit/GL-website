export function accountHistoryPage(query = {}) {
  const integer = (value, fallback, maximum) => {
    if (value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
  };
  return { limit: Math.max(1, integer(query.limit, 20, 50)), offset: integer(query.offset, 0, 1000000) };
}

export function accountHistoryResult(kind, rows, page) {
  const hasMore = rows.length > page.limit;
  return { [kind]: rows.slice(0, page.limit), hasMore, nextOffset: hasMore ? page.offset + page.limit : null };
}
