/** The built-in project for chats: sessions with no project, each in a new empty folder. */
export const CHATS_ID = 'chats';

/**
 * A project the user added, not the built-in Chats or a bot's workspace,
 * which Bica makes for every bot under the bot's id.
 */
export function isOwnProject(p: { id: string; bot?: boolean }) {
  return p.id !== CHATS_ID && !p.bot;
}
