import type {
  Project,
  PullRequest,
  SessionSummary,
  TerminalInfo,
} from '@bica/shared/protocol';
import type { Kept } from '../../files/files';
import { CHATS_ID, folderName, type Target } from '../../projects/projects';

export interface Group {
  key: string;
  projectKey: string;
  projectName: string;
  // Named by its branch; a worktree without one falls back to its folder.
  branch?: string;
  folder?: string;
  // "detached", "no git", or "folder removed".
  note?: string;
  tickets?: string;
  pr?: PullRequest | null;
  path?: string;
  // A worktree, not the main folder: it can be removed.
  worktree?: boolean;
  // The main folder of a pinned project: never parked.
  pinned?: boolean;
  // Absent: a folder that's gone, so no new sessions there.
  target?: Target;
  // Listed above the sessions: they belong to the workspace, not to a session.
  terminals: TerminalInfo[];
  // Kept open on this device, with the terminals: also the workspace's.
  files: Kept[];
  sessions: SessionSummary[];
}

// Worktrees are sibling folders named `<project>-<branch>`; the project is
// already the heading, and repeating it hides the part that differs.
function worktreeFolder(projectPath: string, path: string) {
  const name = folderName(path);
  const prefix = `${folderName(projectPath)}-`;
  return name.startsWith(prefix) && name.length > prefix.length
    ? name.slice(prefix.length)
    : name;
}

// "shop / NW-69095-restore-export" for messages and tooltips.
export function nameOf(g: Group) {
  return [g.projectName, g.branch ?? g.folder].filter(Boolean).join(' / ');
}

// A project's workspaces in use. Its name heads them; the branch goes on the
// same line when there is just one, else each gets a line of its own.
export interface Section {
  key: string;
  name: string;
  groups: Group[];
}

export function bySection(groups: Group[]) {
  const sections = new Map<string, Section>();
  for (const g of groups) {
    let section = sections.get(g.projectKey);
    if (!section)
      sections.set(
        g.projectKey,
        (section = { key: g.projectKey, name: g.projectName, groups: [] }),
      );
    section.groups.push(g);
  }
  return [...sections.values()];
}

/** Every workspace with what's open in it, and sessions in no known one. */
export function workspaceGroups(
  projects: Project[],
  terminals: TerminalInfo[],
  kept: Kept[],
  list: SessionSummary[],
) {
  const groups = new Map<string, Group>();
  // Chats share one flat group: a header per chat folder would be noise.
  const keyOf = (projectId: string, cwd: string) =>
    projectId === CHATS_ID
      ? `${projectId}\n${projects.find((p) => p.id === projectId)?.path}`
      : `${projectId}\n${cwd}`;
  for (const p of projects)
    for (const w of p.workspaces) {
      if (p.id === CHATS_ID && !w.main) continue;
      groups.set(`${p.id}\n${w.path}`, {
        key: `${p.id}\n${w.path}`,
        projectKey: p.id,
        projectName: p.name,
        branch: w.branch ?? undefined,
        folder: w.main ? undefined : worktreeFolder(p.path, w.path),
        note:
          p.id === CHATS_ID
            ? undefined
            : !p.git
              ? 'no git'
              : w.branch
                ? undefined
                : 'detached',
        tickets: p.tickets,
        pr: w.pr,
        path: w.path,
        worktree: !w.main,
        pinned: w.main && p.pinned,
        target: {
          projectId: p.id,
          cwd: w.path,
          worktree: p.id === CHATS_ID || undefined,
        },
        terminals: [],
        files: [],
        sessions: [],
      });
    }
  for (const t of terminals)
    groups.get(keyOf(t.projectId, t.cwd))?.terminals.push(t);
  for (const k of kept) groups.get(keyOf(k.projectId, k.cwd))?.files.push(k);
  for (const s of list) {
    const project = projects.find((p) => p.id === s.projectId);
    // Sessions without a known project share one group, whatever folder they ran in.
    const key = project ? keyOf(project.id, s.cwd ?? '') : '\n';
    let group = groups.get(key);
    if (!group) {
      // A removed worktree, or a session from before projects.
      group = {
        key,
        projectKey: project?.id ?? '',
        projectName: project?.name ?? 'No project',
        folder:
          project && s.cwd ? worktreeFolder(project.path, s.cwd) : undefined,
        note: project ? 'folder removed' : undefined,
        path: project ? (s.cwd ?? undefined) : undefined,
        terminals: [],
        files: [],
        sessions: [],
      };
      groups.set(key, group);
    }
    group.sessions.push(s);
  }
  for (const g of groups.values()) g.sessions = underParents(g.sessions);
  return [...groups.values()];
}

/**
 * Sessions in their order, except that a child session sits right under its
 * parent, when both work in the same workspace.
 */
function underParents(list: SessionSummary[]) {
  const here = new Set(list.map((s) => s.id));
  const children = new Map<string, SessionSummary[]>();
  for (const s of list)
    if (s.parent && here.has(s.parent))
      children.set(s.parent, [...(children.get(s.parent) ?? []), s]);
  if (!children.size) return list;
  const out: SessionSummary[] = [];
  const add = (s: SessionSummary) => {
    out.push(s);
    for (const c of children.get(s.id) ?? []) add(c);
  };
  for (const s of list) if (!s.parent || !here.has(s.parent)) add(s);
  return out;
}
