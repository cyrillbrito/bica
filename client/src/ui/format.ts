/** 950, 12.3k, 126k, 1.2M */
export function formatTokens(n: number) {
  if (n < 1000) return String(Math.round(n));
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatCost(dollars: number) {
  return dollars < 0.01 && dollars > 0 ? '<$0.01' : `$${dollars.toFixed(2)}`;
}
