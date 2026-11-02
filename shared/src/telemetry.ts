/** The user doc on what telemetry sends and how to turn it off. */
export const TELEMETRY_DOCS = 'https://bica.sh/docs/reference/telemetry/';

/** A machine's name on a tailnet, such as `studio.tail1a2b.ts.net`. */
export const TAILNET_HOST = /\b(?:[\w-]+\.)+ts\.net\b/gi;

// What may never leave the machine inside text: whose folder it is, the
// machine's tailnet name, emails, and keys (docs/telemetry.md).
const RULES: [RegExp, string][] = [
  // Before hosts, so `name@machine.tailnet.ts.net` goes whole. The last part
  // must be letters, so versions such as `pkg@1.2.3` stay.
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/gi, '<email>'],
  [/\/(?:Users|home)\/[^/\s'"`:)]+/g, '~'],
  [/\b[a-z]:\\Users\\[^\\\s'"`:)]+/gi, '~'],
  [TAILNET_HOST, '<host>'],
  [
    /\b(?:sk|phc|phx|phs|ghp|gho|ghs|github_pat|xox[abpr])[-_][\w-]{12,}/g,
    '<key>',
  ],
];

/** Text with home folders, tailnet hosts, emails, and keys replaced, cut to at most `max` long. */
export function scrubSecrets(text: string, max = 2000) {
  let out = text;
  for (const [pattern, to] of RULES) out = out.replace(pattern, to);
  return out.length > max ? `${out.slice(0, max)}…` : out;
}
