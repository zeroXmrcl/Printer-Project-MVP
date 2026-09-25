/** True when the rail content is taller than the visible viewport (with a 1px slop). */
export function railOverflows(scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight > clientHeight + 1;
}

/** Second copy of the list so a continuous vertical escalator can wrap seamlessly. */
export function railLoopCopies<T>(items: readonly T[]): T[] {
  if (items.length === 0) return [];
  return [...items, ...items];
}
