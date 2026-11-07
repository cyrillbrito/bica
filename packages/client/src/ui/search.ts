/**
 * Whether the texts hold every word of the query, in any order and case:
 * "opus anth" finds "Claude Opus · Anthropic". An empty query matches all.
 */
export function matches(query: string, ...texts: string[]) {
  const hay = texts.join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
}
