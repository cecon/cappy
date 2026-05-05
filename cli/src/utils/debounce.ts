/**
 * Returns a debounced version of `fn` that delays invocation by `ms` milliseconds.
 */
export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; fn(); }, ms);
  };
}
