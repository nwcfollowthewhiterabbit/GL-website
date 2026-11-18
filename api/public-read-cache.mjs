// Each caller owns one entry. Concurrent readers share the first successful load.
export function cachePublicRead(load, ttlMs) {
  let current;
  let expires = 0;
  let loading;

  return () => {
    if (Date.now() < expires) return Promise.resolve(current);
    loading ??= Promise.resolve().then(load).then(result => {
      current = result;
      expires = Date.now() + ttlMs;
      return result;
    }).finally(() => { loading = undefined; });
    return loading;
  };
}
