import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isOwnProject } from '@bica/shared/projects';
import { listProjects } from '../projects/projects';

// The memory index, loaded with the instructions so the bot never has to
// remember to read it.
const MEMORY_FILE = 'MEMORY.md';
const MEMORY_LIMIT = 8_000;

/**
 * What a bot's prompt keeps as copies (Agent.copies): its memory index and
 * every project, taken at the first prompt and after each compaction, since
 * the bot edits its memory mid-session and each change would break the
 * prompt cache. `list` has the live state.
 */
export async function botCopies(home: string) {
  const [memory, projects] = await Promise.all([
    memoryIndex(home),
    projectList(),
  ]);
  return { memory, projects };
}

async function memoryIndex(home: string) {
  const path = join(home, MEMORY_FILE);
  const text = (await readFile(path, 'utf8').catch(() => '')).trim();
  if (!text) return '';
  // Cut loudly, never silently: the bot should know it sees only part.
  const body =
    text.length > MEMORY_LIMIT
      ? `${text.slice(0, MEMORY_LIMIT)}\n\n[Cut at ${MEMORY_LIMIT} of ${text.length} characters. Read the file for the rest, and make it shorter.]`
      : text;
  return `This is ${path} as it was when this session started or last compacted. Your edits since then are in the file, not here.\n\n<memory_file path="${path}">\n${body}\n</memory_file>`;
}

async function projectList() {
  const lines = (await listProjects())
    .filter(isOwnProject)
    .flatMap((p) => [
      `- ${p.name}`,
      ...p.workspaces.map(
        (w) =>
          `  - ${w.main ? 'main' : `worktree ${w.branch ?? '(detached)'}`}: ${w.path}`,
      ),
    ]);
  return `Bica's projects as they were when this session started or last compacted. Pass one of these paths as session_start's \`folder\`. \`list\` shows what changed since, and every session's status.\n\n${lines.join('\n')}`;
}
