/** What went wrong, as text: an Error's message, or the thrown value itself. */
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
