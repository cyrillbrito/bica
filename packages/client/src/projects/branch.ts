// A ticket key like Jira's: capitals, a dash, digits. Lowercase keys are left
// alone, since names like "release-2024" would match too.
const TICKET = /^([A-Z][A-Z0-9]+-\d+)(?:[-_](.*))?$/;

/**
 * "me/NW-69095-restore-export" → prefix "me/", ticket "NW-69095", rest
 * "restore-export". The prefix is everything up to the last slash.
 */
export function splitBranch(branch: string) {
  const slash = branch.lastIndexOf('/');
  const prefix = branch.slice(0, slash + 1);
  const name = branch.slice(slash + 1);
  const match = TICKET.exec(name);
  return match
    ? { prefix, ticket: match[1], rest: match[2] ?? '' }
    : { prefix, ticket: undefined, rest: name };
}

/** The ticket's page, from a project's `tickets` template with `{key}` in it. */
export function ticketUrl(template: string | undefined, key: string) {
  return template?.replace('{key}', encodeURIComponent(key));
}
