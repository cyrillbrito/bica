// The wire format of the one WebSocket (docs/realtime-communication.md).
// Shared by server/src/socket.ts and client/src/socket/socket.ts; types only.
import type { Op } from '@earendil-works/chord/delta';
import type { AgentId, PickableAgent } from './agents';
import type { ProjectedView } from './projection';

// A run in progress (or backing off after a provider error), or none: failed,
// asked the user something (waiting), finished with an answer not yet opened
// (done), or read (idle).
export type SessionStatus =
  | 'running'
  | 'retrying'
  | 'error'
  | 'waiting'
  | 'done'
  | 'idle';

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: number;
  // The newest message, or creation if there is none.
  updatedAt: number;
  // While running or retrying: when the current run's prompt was sent, for
  // the live clock in the sidebar; null otherwise.
  runningSince: number | null;
  // null: made before projects existed.
  projectId: string | null;
  // The folder it runs in: a workspace path, or one that's gone since.
  cwd: string | null;
  // When it was archived (hidden from the list, kept); null: not archived.
  archivedAt: number | null;
  // The session it was forked from; null: started fresh.
  forkedFrom: string | null;
  // The last entry it took from there.
  forkedAt: number | null;
  // The session whose agent started it; null: started by the user.
  startedBy: string | null;
  // The session in charge of it, which hears each run it ends; null: none,
  // so it's yours (docs/sessions.md).
  parent: string | null;
  // Each time it left its parent, or went back to it.
  handoffs: InCharge[];
  // The hubs that watch it and hear each run it ends.
  watchedBy: string[];
  // Its worktree was removed: the branch and PR it had then; null: not. Named
  // when removing was called clean up, and stored so.
  cleanedUp: { branch: string | null; pr: PullRequest | null } | null;
  // The agent it runs as: its tools, instructions, and model
  // (docs/agents.md).
  agent: AgentId;
  // How its voice calls sound; null: the defaults.
  voice: VoiceSettings | null;
  // The first prompt, held for tonight's run (docs/night-runs.md); null:
  // nothing waiting.
  tonight: string | null;
  // Work Pi Durable won't run (docs/sessions.md); null: none.
  stuck: Stuck | null;
  // Dollars spent at list prices, even on a plan: its models and tools, not
  // the sessions it started.
  cost: number;
}

// Crashed: cut off by crashes too often in a row, so paused until a retry.
// Missing: its code is gone from this Bica, so only stopping ends it.
export type Stuck = 'crashed' | 'missing';

/**
 * Who is in charge of a child session from `at` on: you detached it, or (before
 * detaching was final) handed it back. `you` was called taking over.
 */
export type InCharge = { at: number; to: 'you' | 'parent' };

/** A session's voice calls (docs/voice.md). */
// A type, not an interface: session docs only take plain JSON shapes.
export type VoiceSettings = {
  // How fast the voice talks, 0.25 to 1.5; 1 is normal. Asked for in its
  // instructions: GPT-Live has no speed setting.
  speed: number;
  // Added to the voice's own instructions: language, pace, role.
  instructions: string;
};

/** How hard the model thinks; models support a subset (pi-ai's levels). */
export type ThinkingLevel =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export interface ModelRef {
  provider: string;
  modelId: string;
}

export interface ModelChoice {
  model: ModelRef;
  thinkingLevel: ThinkingLevel;
}

/**
 * Bica's settings, the same on every device: the models new sessions and side
 * jobs use, the hub, night runs, and git habits.
 */
export interface Settings extends ModelChoice {
  // `provider/modelId`s; empty: every available model.
  enabled: string[];
  // The small model for titles and commit messages; null: none.
  fastModel: ModelRef | null;
  // Opening a file's diff under Changes stages it: staged means reviewed.
  stageOnView: boolean;
  // Ask for the long prompt cache: 1 hour on Claude, 24 hours on some OpenAI
  // models. False: the 5-minute default.
  longCache: boolean;
  // The hub's folder (docs/hub.md); null: not picked yet.
  hubFolder: string | null;
  // The hub's model and effort; null: Bica's pick for it.
  hubModel: ModelChoice | null;
  // When night runs start, as local "HH:MM" (docs/night-runs.md).
  nightStart: string;
  // Which defaults still come from the server's env (PI_MODEL, PI_FAST_MODEL)
  // because nothing was picked in Settings.
  fromEnv: { model: boolean; fastModel: boolean };
}

/** What the Settings page changes; the rest stays as saved. */
export type SettingsChange = Partial<Omit<Settings, 'fromEnv'>>;

/** The providers with a key on the server, and the models they reach. */
export interface ModelCatalog {
  // `source`: how it's connected, e.g. OAuth.
  providers: { id: string; name: string; source: string | null }[];
  models: {
    provider: string;
    id: string;
    name: string;
    levels: ThinkingLevel[];
    contextWindow: number;
    // List price in dollars per million tokens; 0: unknown.
    cost: { input: number; output: number };
    // Prompt cache lifetimes in seconds; absent: unknown or no cache.
    cacheTtl: { short?: number; long?: number };
  }[];
  // Auto-compaction: blocks at contextWindow - reserveTokens, starts in the
  // background backgroundTokens before that, and keeps the newest
  // keepRecentTokens as they are.
  compaction: {
    reserveTokens: number;
    backgroundTokens: number;
    keepRecentTokens: number;
  };
}

/** A model provider or a tool service (Exa) and how it's signed in. */
export interface Account {
  id: string;
  name: string;
  // Who signed in, and their plan (Max, Plus), read once per sign-in.
  email: string | null;
  plan: string | null;
  // Its turn among the plan's signed-in accounts, 0 first; null: the only one.
  place: number | null;
  // What it's for and where a key comes from; null: no guide written.
  about: string | null;
  link: { label: string; url: string } | null;
  // null: not set up. Only sign-ins and keys saved in Settings count.
  // hint: a key's last 4 characters.
  status: { type: 'oauth' | 'api_key'; hint: string | null } | null;
  methods: { type: 'oauth' | 'api_key'; label: string }[];
  // A plan signed in here, which can take an extra account (docs/models.md).
  addAccount: boolean;
  // Another account of a plan: anthropic:2.
  extra: boolean;
  // Not a model provider but a tool's key, like Exa's for web search.
  tool: boolean;
}

/** A sign-in in progress: what the provider asked so far. */
export interface SignIn {
  id: string;
  account: string;
  // A page to open and sign in on.
  url: string | null;
  instructions: string | null;
  // Device code flows: the code to type at `uri`.
  device: { code: string; uri: string } | null;
  notes: { message: string; links: { label?: string; url: string }[] }[];
  progress: string | null;
  // Waiting for the user; answered with `account.answer`.
  prompt: {
    id: string;
    type: 'text' | 'secret' | 'select' | 'manual_code';
    message: string;
    placeholder: string | null;
    options: { id: string; label: string; description?: string }[];
  } | null;
  error: string | null;
}

export interface Accounts {
  accounts: Account[];
  // One at a time, shared by every tab; null: none running.
  signIn: SignIn | null;
}

/** A folder sessions run in; git is optional. */
export interface Project {
  id: string;
  name: string;
  path: string;
  git: boolean;
  // Set by hand in projects.json: a link with `{key}`, so ticket tags in
  // branch names open the ticket.
  tickets?: string;
  // Its main folder stays in the sidebar's list, never in Parked.
  pinned?: boolean;
  // The main folder, or every worktree of its repo; never empty.
  workspaces: Workspace[];
}

/** What the Edit project dialog changes. */
export type ProjectEdit = Pick<Project, 'name'>;

/** A project's main folder or one of its git worktrees. */
export interface Workspace {
  path: string;
  // null: not git, or a detached HEAD.
  branch: string | null;
  // The repo's main worktree (or the folder of a non-git project).
  main: boolean;
  // The newest PR of mine from this branch, via gh; null: none, or not known yet.
  pr: PullRequest | null;
}

/** A GitHub pull request, as `gh` reports it. A type, so docs can store it. */
export type PullRequest = {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'draft' | 'merged' | 'closed';
  // The commit it was opened or merged at.
  head: string;
};

export interface DirListing {
  path: string;
  parent: string | null;
  dirs: { name: string; path: string; git: boolean }[];
}

/** A workspace, as the browser names it. */
export interface WorkspaceRef {
  projectId: string;
  cwd: string;
}

/**
 * One changed file. M modified, A added, D deleted, R renamed,
 * U untracked, ! conflicted.
 */
export interface GitChange {
  path: string;
  // Renames: where it came from.
  oldPath?: string;
  status: 'M' | 'A' | 'D' | 'R' | 'U' | '!';
  // Changes whenever this side of the file does, so open views re-read.
  version: string;
  // Each side's git blob hash, for `/blob/<hash>` (server/src/git/blob.ts),
  // which the browser caches for good; null: that side has no file. Absent:
  // read it through `git.diff` (submodules, conflicts, too big to hash).
  blobs?: { old: string | null; new: string | null };
  // Lines added and removed on this side; absent: binary or not counted.
  added?: number;
  removed?: number;
}

/** A commit on the current branch. */
export interface GitCommit {
  // The full hash.
  hash: string;
  subject: string;
  // Committer time, ms.
  time: number;
  // On no remote branch yet. Set by `git.log`; status leaves it out.
  unpushed?: boolean;
}

/** A page of the current branch's history, newest first. */
export interface GitLog {
  commits: GitCommit[];
  // Older commits follow.
  more: boolean;
  // A commit's page on GitHub or GitLab is this plus its hash; null when
  // `origin` is neither.
  commitUrl: string | null;
}

/**
 * One commit, opened: its message, author, and the files it changed against
 * its first parent, or against nothing for the first commit. Each file's
 * blobs are read like a staged change's.
 */
export interface GitCommitDetail extends GitCommit {
  body: string;
  author: string;
  email: string;
  // Here `time` is when the author wrote it.
  parents: string[];
  files: GitChange[];
  commitUrl: string | null;
}

export interface GitStatus {
  // null: detached HEAD.
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitChange[];
  unstaged: GitChange[];
  // The newest few commits of HEAD; empty before the first commit.
  recent: GitCommit[];
  // Submodules with changes or commits to sync, each its own repo (nested
  // ones flattened). Their paths, and their changes', are from the workspace.
  submodules: (GitStatus & { path: string })[];
}

/** A file's text, its bytes when the browser can show it, or why neither. */
export type FileText =
  | { text: string }
  // An image, PDF, audio, or video file; data is base64.
  | { text: null; reason: 'media'; mimeType: string; data: string }
  | { text: null; reason: 'missing' | 'binary' | 'too large' };

/**
 * A path from a chat message: in a workspace, relative to it; else absolute,
 * with a link that serves it when it is a file.
 */
export type FoundPath =
  | { workspace: WorkspaceRef; path: string; folder: boolean; url?: undefined }
  | { workspace: null; path: string; folder: boolean; url?: string };

/** One limit of a plan: the 5-hour session, the week, or a spend cap. */
export interface PlanWindow {
  key: string;
  label: string;
  // 0 to 1.
  utilization: number;
  // ms; null: no known reset, like Claude's monthly extra usage.
  resetsAt: number | null;
  // Blocked until it resets.
  limited: boolean;
}

/** The limits of one signed-in plan account, from its last reply. */
export interface ProviderUsage {
  // The account's provider id: anthropic, or anthropic:work.
  id: string;
  // The provider whose models it serves: anthropic for anthropic:work.
  family: string;
  name: string;
  // With more than one account, the one the next request takes.
  inUse: boolean;
  windows: PlanWindow[];
  updatedAt: number;
}

export type PlanUsage = ProviderUsage[];

/** A shell in a workspace, maybe running a command (docs/terminals.md). */
export interface TerminalInfo {
  id: string;
  projectId: string;
  cwd: string;
  title: string;
  // The command it runs first, again on restart; null: none.
  command: string | null;
  // The shell itself.
  status: 'running' | 'exited';
  exitCode: number | null;
  // A command runs at its prompt; null: not known (no shell integration).
  busy: boolean | null;
  // The last finished command's exit code.
  lastExit: number | null;
  // The session whose agent started it; null: started by the user.
  startedBy: string | null;
  // The session in charge of it, which closes it when archived; null: none,
  // so it's yours (docs/terminals.md).
  parent: string | null;
  createdAt: number;
}

/** A terminal's output, raw (escape codes and all), capped at the front. */
export interface TerminalOutput {
  // Bumped on restart: start a clean screen.
  run: number;
  // Characters dropped from the front so far.
  start: number;
  output: string;
}

/** A pasted or picked image, sent with a prompt. data: base64, no prefix. */
export interface PromptImage {
  mimeType: string;
  // Empty in a transcript, which points to `file` instead.
  data: string;
  // Its copy on the dev machine, saved by the server when the prompt is
  // sent (server/src/sessions/attachments.ts): the agent's tools can open it.
  file?: string;
  // The n of its `[Image #n]` marker in the prompt's text, if it has one.
  ref?: number;
}

/** A prompt taken back out of the queue. */
export interface QueuedPrompt {
  prompt: string;
  images: PromptImage[];
}

/** One-off requests: args in, one reply out. */
export interface Calls {
  'session.create': {
    args: {
      projectId: string;
      // A workspace path of the project; absent: its main folder.
      cwd?: string;
      // May be empty when images are attached. Both empty: a session for a
      // voice call, named by its first handoff.
      prompt: string;
      images?: PromptImage[];
      requestId: string;
      // Absent: the agent's default.
      choice?: ModelChoice;
      // Absent: coding.
      agent?: PickableAgent;
      // Starts in a new worktree named after the session, instead of `cwd`.
      worktree?: boolean;
      // Holds the prompt for tonight's run instead of sending it.
      tonight?: boolean;
    };
    // warning: the session started, but not quite as asked, such as a
    // worktree from an unfetched branch.
    result: { id: string; warning?: string };
  };
  // A session held for tonight: save an edited prompt, run it now (edited
  // when `prompt` is given), or cancel the run and get the prompt back.
  'session.tonight': {
    args: { id: string; action: 'save' | 'run' | 'cancel'; prompt?: string };
    result: string;
  };
  'session.configure': { args: { id: string } & ModelChoice; result: null };
  'settings.update': { args: SettingsChange; result: null };
  'project.add': { args: { path: string }; result: string };
  // Project ids in their new sidebar order; ids left out keep their place after.
  'project.reorder': { args: { ids: string[] }; result: null };
  'project.pin': { args: { id: string; pinned: boolean }; result: null };
  'project.update': { args: { id: string } & ProjectEdit; result: null };
  // Removes a worktree and its local branch, archives its sessions, closes its
  // terminals. Returns what would be lost and removes nothing, unless force.
  // Named when removing was called clean up.
  'worktree.cleanUp': {
    args: WorkspaceRef & { force?: boolean };
    result: string | null;
  };
  // Absent path: the home folder.
  'fs.dirs': { args: { path?: string }; result: DirListing };
  'session.submit': {
    args: {
      id: string;
      // May be empty when images are attached.
      prompt: string;
      images?: PromptImage[];
      requestId: string;
      // While a run works: wait for it to answer (default), or join it after
      // the current step.
      whenBusy?: 'followUp' | 'steer';
    };
    result: null;
  };
  // Takes a session from its parent: it's yours from now on.
  'session.detach': { args: { id: string }; result: null };
  // Ends every hub's watch on a session.
  'session.unwatch': { args: { id: string }; result: null };
  // Takes a queued prompt back; null: it was already sent.
  'session.withdraw': {
    args: { id: string; submission: number };
    result: QueuedPrompt | null;
  };
  // A queued follow-up joins the run after the current turn; false: already sent.
  'session.push': { args: { id: string; submission: number }; result: boolean };
  // Stops the run; returns the queued prompts the stop dropped.
  'session.stop': { args: { id: string }; result: QueuedPrompt[] };
  // Runs work paused after crashes again.
  'session.retry': { args: { id: string }; result: null };
  'session.archive': {
    args: { id: string; archived: boolean };
    // The worktree it left with no open session; null: none.
    result: WorkspaceRef | null;
  };
  'session.rename': { args: { id: string; title: string }; result: null };
  // Summarizes older context now; instructions: what the summary keeps.
  'session.compact': {
    args: { id: string; instructions?: string };
    result: null;
  };
  // Prunes old tool output from the model context (shared/src/prune.ts).
  // Named when pruning was called clean up.
  'session.cleanup': { args: { id: string }; result: null };
  // Changing it later breaks the prompt cache once.
  'session.agent': {
    args: { id: string; agent: PickableAgent };
    result: null;
  };
  // The hub's session id, started first if there is none.
  'hub.open': { args: Record<string, never>; result: string };
  // Applies from the next call.
  'session.voice': { args: { id: string; voice: VoiceSettings }; result: null };
  // A new session with the history up to entry `at` (absent: all); its id.
  'session.fork': { args: { id: string; at?: number }; result: string };
  // Opened in a browser: its answers so far are read.
  'session.seen': { args: { id: string; seen?: boolean }; result: null };
  // An opened row's full contents: a tool call by id, a thought by step key.
  'session.detail': {
    args: { id: string; key: string };
    result: StepDetail | null;
  };
  // A voice call on a session: the browser's WebRTC offer in, the answer out.
  // `trace` keys the call's lines in the voice log (server/src/voice/log.ts).
  'voice.start': {
    args: { id: string; sdp: string; trace: string };
    result: { sdp: string; callId: string };
  };
  'voice.stop': { args: { callId: string }; result: null };
  // Photos added during a call; they go with its next handoff.
  'voice.photos': {
    args: { callId: string; images: PromptImage[] };
    result: null;
  };
  // A step of a call in the browser, for the voice log.
  'voice.log': {
    args: { trace: string; event: string; data?: Record<string, unknown> };
    result: null;
  };
  // Dictation: a recording in, its text out. `audio` is base64.
  'voice.transcribe': {
    args: { audio: string; mimeType: string };
    result: { text: string };
  };
  // Starts a sign-in (replacing one running); follow it on `accounts`.
  'account.signIn': {
    args: { id: string; type: 'oauth' | 'api_key' };
    result: null;
  };
  'account.answer': { args: { prompt: string; value: string }; result: null };
  'account.cancel': { args: Record<string, never>; result: null };
  // Signs in another account of a plan (anthropic).
  'account.add': { args: { provider: string }; result: null };
  // Puts the account ahead of the others of its plan.
  'account.useFirst': { args: { id: string }; result: null };
  // Forgets a saved sign-in or key, with its email and limits.
  'account.signOut': { args: { id: string }; result: null };
  // Absent paths: everything.
  // repo, on every git call: a submodule's path; absent, the workspace's own
  // repo. Paths are from the workspace; without paths, everything in repo.
  'git.stage': {
    args: WorkspaceRef & { paths?: string[]; repo?: string };
    result: null;
  };
  'git.unstage': {
    args: WorkspaceRef & { paths?: string[]; repo?: string };
    result: null;
  };
  // all: stage everything first. amend: an empty message keeps the old one.
  'git.commit': {
    args: WorkspaceRef & {
      message: string;
      all?: boolean;
      amend?: boolean;
      repo?: string;
    };
    result: null;
  };
  // Throws away unstaged changes; untracked files are deleted.
  'git.discard': {
    args: WorkspaceRef & { paths: string[]; repo?: string };
    result: null;
  };
  // Sets the upstream on a branch's first push.
  'git.push': { args: WorkspaceRef & { repo?: string }; result: null };
  // Fast-forward only; anything else is for a terminal.
  'git.pull': { args: WorkspaceRef & { repo?: string }; result: null };
  // A commit message for the staged changes (all: every change), written by
  // the fast model. null: no fast model is set. fresh: skip the cache.
  'git.suggest': {
    args: WorkspaceRef & { all?: boolean; fresh?: boolean; repo?: string };
    result: string | null;
  };
  // Staged: HEAD → index. Unstaged: index → working tree.
  'git.diff': {
    args: WorkspaceRef & {
      path: string;
      staged: boolean;
      oldPath?: string;
      repo?: string;
    };
    result: { old: FileText; new: FileText };
  };
  // The branch's commits from `skip` on, `count` at most.
  'git.log': {
    args: WorkspaceRef & { skip?: number; count: number; repo?: string };
    result: GitLog;
  };
  // A commit by hash; paths are from the workspace.
  'git.show': {
    args: WorkspaceRef & { hash: string; repo?: string };
    result: GitCommitDetail;
  };
  'file.read': { args: WorkspaceRef & { path: string }; result: FileText };
  // Opens it in the editor on the dev machine (server/src/git/editor.ts); absent
  // path: the whole workspace.
  'editor.open': { args: WorkspaceRef & { path?: string }; result: null };
  // A path from a chat message, anywhere on the dev machine: files in the
  // editor, folders (or anything with reveal) in Finder. Relative to cwd.
  'path.open': {
    args: { path: string; cwd?: string; reveal?: boolean };
    result: null;
  };
  // Where Bica shows a path from a chat message (server/src/git/editor.ts).
  'path.find': { args: { path: string; cwd?: string }; result: FoundPath };
  // A URL serving the file over HTTP for an hour (server/src/git/download.ts).
  'file.link': { args: WorkspaceRef & { path: string }; result: string };
  // Absent command: an interactive shell. Its id.
  'terminal.create': {
    args: WorkspaceRef & { command?: string; title?: string };
    result: string;
  };
  // Keystrokes, as the terminal encodes them.
  'terminal.input': { args: { id: string; data: string }; result: null };
  'terminal.resize': {
    args: { id: string; cols: number; rows: number };
    result: null;
  };
  'terminal.stop': { args: { id: string }; result: null };
  'terminal.restart': { args: { id: string }; result: null };
  // Stops it if needed and drops it from the list.
  'terminal.remove': { args: { id: string }; result: null };
  // Takes a terminal from its session: it's yours from now on.
  'terminal.detach': { args: { id: string }; result: null };
}

/** Live state: a snapshot, then numbered changes. */
export interface Topics {
  sessions: { params: Record<string, never>; value: SessionSummary[] };
  projects: { params: Record<string, never>; value: Project[] };
  models: { params: Record<string, never>; value: ModelCatalog };
  settings: { params: Record<string, never>; value: Settings };
  accounts: { params: Record<string, never>; value: Accounts };
  // null: no such conversation.
  conversation: { params: { id: string }; value: ProjectedView | null };
  // null: not a git repository.
  'git.status': { params: WorkspaceRef; value: GitStatus | null };
  'plan.usage': { params: Record<string, never>; value: PlanUsage };
  // Every file path in the workspace, minus what git ignores.
  files: { params: WorkspaceRef; value: string[] };
  terminals: { params: Record<string, never>; value: TerminalInfo[] };
  // null: no such terminal (closed, or the server restarted).
  terminal: { params: { id: string }; value: TerminalOutput | null };
}

/** A tool call's input and output, or a thought's text; the transcript leaves them out. */
export type StepDetail =
  | { args: Record<string, unknown>; output?: string; details?: unknown }
  | { text: string };

/** The ids of the first and last entries a browser holds, and how many. */
export interface EntriesHeld {
  first: number;
  last: number;
  count: number;
}

export type Call = keyof Calls;
export type Topic = keyof Topics;

export type ClientMessage =
  | { type: 'request'; id: string; call: Call; args: unknown }
  | {
      type: 'subscribe';
      sub: number;
      topic: Topic;
      params: unknown;
      // A conversation the browser already holds, so the snapshot can skip it.
      have?: EntriesHeld;
    }
  | { type: 'unsubscribe'; sub: number };

export type ServerMessage =
  | { type: 'reply'; id: string; ok: true; value: unknown }
  | { type: 'reply'; id: string; ok: false; error: string }
  // A snapshot replaces the copy and restarts the numbering at n = 0.
  // `kept`: a conversation whose first `kept` entries are the browser's own,
  // left out of `value.entries`.
  | { type: 'snapshot'; sub: number; n: number; value: unknown; kept?: number }
  | { type: 'changes'; sub: number; n: number; ops: readonly Op[] }
  | { type: 'error'; sub: number; error: string };
