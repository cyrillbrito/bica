import { Dynamic } from '@solidjs/web';
import { For } from 'solid-js';
// One module per icon: the `lucide` barrel ships every icon in dev.
import Archive from 'lucide/dist/esm/icons/archive.mjs';
import AudioLines from 'lucide/dist/esm/icons/audio-lines.mjs';
import ArrowDown from 'lucide/dist/esm/icons/arrow-down.mjs';
import ArrowUp from 'lucide/dist/esm/icons/arrow-up.mjs';
import ArrowLeft from 'lucide/dist/esm/icons/arrow-left.mjs';
import Check from 'lucide/dist/esm/icons/check.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import ChevronsUpDown from 'lucide/dist/esm/icons/chevrons-up-down.mjs';
import CornerDownLeft from 'lucide/dist/esm/icons/corner-down-left.mjs';
import CornerLeftUp from 'lucide/dist/esm/icons/corner-left-up.mjs';
import ChevronsUp from 'lucide/dist/esm/icons/chevrons-up.mjs';
import CircleAlert from 'lucide/dist/esm/icons/circle-alert.mjs';
import Copy from 'lucide/dist/esm/icons/copy.mjs';
import Diff from 'lucide/dist/esm/icons/diff.mjs';
import Download from 'lucide/dist/esm/icons/download.mjs';
import Ellipsis from 'lucide/dist/esm/icons/ellipsis.mjs';
import Eraser from 'lucide/dist/esm/icons/eraser.mjs';
import ExternalLink from 'lucide/dist/esm/icons/external-link.mjs';
import File from 'lucide/dist/esm/icons/file.mjs';
import FilePen from 'lucide/dist/esm/icons/file-pen.mjs';
import FilePlus from 'lucide/dist/esm/icons/file-plus.mjs';
import FileText from 'lucide/dist/esm/icons/file-text.mjs';
import ChevronsDownUp from 'lucide/dist/esm/icons/chevrons-down-up.mjs';
import Folder from 'lucide/dist/esm/icons/folder.mjs';
import GitBranch from 'lucide/dist/esm/icons/git-branch.mjs';
import GitFork from 'lucide/dist/esm/icons/git-fork.mjs';
import GitMerge from 'lucide/dist/esm/icons/git-merge.mjs';
import GitPullRequest from 'lucide/dist/esm/icons/git-pull-request.mjs';
import GitPullRequestClosed from 'lucide/dist/esm/icons/git-pull-request-closed.mjs';
import GitPullRequestDraft from 'lucide/dist/esm/icons/git-pull-request-draft.mjs';
import Globe from 'lucide/dist/esm/icons/globe.mjs';
import type { IconNode } from 'lucide';
import Image from 'lucide/dist/esm/icons/image.mjs';
import Info from 'lucide/dist/esm/icons/info.mjs';
import Keyboard from 'lucide/dist/esm/icons/keyboard.mjs';
import Lightbulb from 'lucide/dist/esm/icons/lightbulb.mjs';
import List from 'lucide/dist/esm/icons/list.mjs';
import ListFilter from 'lucide/dist/esm/icons/list-filter.mjs';
import Upload from 'lucide/dist/esm/icons/upload.mjs';
import GitCommitHorizontal from 'lucide/dist/esm/icons/git-commit-horizontal.mjs';
import ListChecks from 'lucide/dist/esm/icons/list-checks.mjs';
import ListPlus from 'lucide/dist/esm/icons/list-plus.mjs';
import MessageCircleQuestion from 'lucide/dist/esm/icons/message-circle-question-mark.mjs';
import ListTree from 'lucide/dist/esm/icons/list-tree.mjs';
import MessageSquarePlus from 'lucide/dist/esm/icons/message-square-plus.mjs';
import Mail from 'lucide/dist/esm/icons/mail.mjs';
import MailOpen from 'lucide/dist/esm/icons/mail-open.mjs';
import Mic from 'lucide/dist/esm/icons/mic.mjs';
import MicOff from 'lucide/dist/esm/icons/mic-off.mjs';
import Minus from 'lucide/dist/esm/icons/minus.mjs';
import Monitor from 'lucide/dist/esm/icons/monitor.mjs';
import Moon from 'lucide/dist/esm/icons/moon.mjs';
import Inbox from 'lucide/dist/esm/icons/inbox.mjs';
import PanelLeft from 'lucide/dist/esm/icons/panel-left.mjs';
import Command from 'lucide/dist/esm/icons/command.mjs';
import Coffee from 'lucide/dist/esm/icons/coffee.mjs';
import PanelRight from 'lucide/dist/esm/icons/panel-right.mjs';
import Pencil from 'lucide/dist/esm/icons/pencil.mjs';
import PhoneOff from 'lucide/dist/esm/icons/phone-off.mjs';
import Pin from 'lucide/dist/esm/icons/pin.mjs';
import Plus from 'lucide/dist/esm/icons/plus.mjs';
import RotateCcw from 'lucide/dist/esm/icons/rotate-ccw.mjs';
import RefreshCw from 'lucide/dist/esm/icons/refresh-cw.mjs';
import Hourglass from 'lucide/dist/esm/icons/hourglass.mjs';
import Search from 'lucide/dist/esm/icons/search.mjs';
import SlidersHorizontal from 'lucide/dist/esm/icons/sliders-horizontal.mjs';
import Snowflake from 'lucide/dist/esm/icons/snowflake.mjs';
import Sparkles from 'lucide/dist/esm/icons/sparkles.mjs';
import InfinityShape from 'lucide/dist/esm/icons/infinity.mjs';
import Square from 'lucide/dist/esm/icons/square.mjs';
import SunMoon from 'lucide/dist/esm/icons/sun-moon.mjs';
import Sun from 'lucide/dist/esm/icons/sun.mjs';
import SquareCode from 'lucide/dist/esm/icons/square-code.mjs';
import SquareTerminal from 'lucide/dist/esm/icons/square-terminal.mjs';
import TextWrap from 'lucide/dist/esm/icons/text-wrap.mjs';
import Eye from 'lucide/dist/esm/icons/eye.mjs';
import Unlink from 'lucide/dist/esm/icons/unlink.mjs';
import Trash from 'lucide/dist/esm/icons/trash.mjs';
import Undo2 from 'lucide/dist/esm/icons/undo-2.mjs';
import Waypoints from 'lucide/dist/esm/icons/waypoints.mjs';
import Wrench from 'lucide/dist/esm/icons/wrench.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';

// The same shape, its strokes drawing in on mount: for a check that confirms.
function drawn(node: IconNode) {
  return icon(
    node.map(([tag, attrs]) => [
      tag,
      { ...attrs, pathLength: '1', class: 'draw' },
    ]) as IconNode,
  );
}

// Lucide's shapes, drawn by us: `lucide-solid` is built for Solid 1.
function icon(node: IconNode, extra?: string) {
  return () => (
    <svg
      class={['size-4 shrink-0', extra]}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <For each={node}>
        {([tag, attrs]) => <Dynamic component={tag} {...attrs} />}
      </For>
    </svg>
  );
}

export const PlusIcon = icon(Plus);
export const MinusIcon = icon(Minus);
export const ArrowUpIcon = icon(ArrowUp);
export const ArrowDownIcon = icon(ArrowDown);
export const BackIcon = icon(ArrowLeft);
export const FilesIcon = icon(File);
export const DiffIcon = icon(Diff);
export const SidebarIcon = icon(PanelLeft);
export const ColdIcon = icon(Snowflake);
export const ExpiringIcon = icon(Hourglass);
export const SidePanelIcon = icon(PanelRight);
export const FolderIcon = icon(Folder);
export const ListIcon = icon(List);
export const TreeIcon = icon(ListTree);
export const SettingsIcon = icon(SlidersHorizontal);
export const ImageIcon = icon(Image);
export const CloseIcon = icon(X);
export const CheckIcon = icon(Check);
/** A check that draws itself in each time it mounts (`draw`). */
export const DrawnCheckIcon = drawn(Check);
export const ChevronIcon = icon(ChevronRight);
export const ArchiveIcon = icon(Archive);
export const RestoreIcon = icon(RotateCcw);
export const RefreshIcon = icon(RefreshCw);
/** Throwing away uncommitted changes; a new file is deleted instead. */
export const DiscardIcon = icon(Undo2);
export const DeleteIcon = icon(Trash);
export const CopyIcon = icon(Copy);
export const MoreIcon = icon(Ellipsis);
export const DownloadIcon = icon(Download);
export const ExternalIcon = icon(ExternalLink);
export const PencilIcon = icon(Pencil);
export const WrapIcon = icon(TextWrap);
export const PreviewIcon = icon(Eye);
export const BranchIcon = icon(GitBranch);
export const ForkIcon = icon(GitFork);
export const PullRequestIcon = icon(GitPullRequest);
export const PullRequestDraftIcon = icon(GitPullRequestDraft);
export const PullRequestClosedIcon = icon(GitPullRequestClosed);
export const MergedIcon = icon(GitMerge);
export const InfoIcon = icon(Info);
export const AlertIcon = icon(CircleAlert);
export const CompactIcon = icon(ChevronsDownUp);
export const PruneIcon = icon(Eraser);
/** Voice calls. */
export const VoiceIcon = icon(AudioLines);
export const HangUpIcon = icon(PhoneOff);
export const MicIcon = icon(Mic);
export const UnreadIcon = icon(Mail);
export const ReadIcon = icon(MailOpen);
export const MicOffIcon = icon(MicOff);
/** Written by a model. */
export const SparkleIcon = icon(Sparkles);
export const AssistantIcon = icon(InfinityShape);
export const HubIcon = icon(Waypoints);

// Transcript steps.
export const TerminalIcon = icon(SquareTerminal);
export const FileReadIcon = icon(FileText);
export const FileWriteIcon = icon(FilePlus);
export const FileEditIcon = icon(FilePen);
export const SearchIcon = icon(Search);
export const GlobeIcon = icon(Globe);
export const ToolIcon = icon(Wrench);
export const CodeIcon = icon(SquareCode);
export const SessionIcon = icon(MessageSquarePlus);
export const ParentIcon = icon(CornerLeftUp);
export const DetachIcon = icon(Unlink);
export const WatchIcon = icon(Eye);
export const ThoughtIcon = icon(Lightbulb);
export const StopIcon = icon(Square, 'fill-current');
export const PushIcon = icon(ChevronsUp);
export const StepsIcon = icon(ListChecks);
// Lucide's cup, its three wisps of steam rising one after another: the agent
// is brewing. The cup's own path is the one long one.
const BREWING = Coffee.map(([tag, attrs]) => {
  const wisp = ['M6 2v2', 'M10 2v2', 'M14 2v2'].indexOf(String(attrs.d));
  return wisp === -1
    ? [tag, attrs]
    : [
        tag,
        {
          ...attrs,
          class: 'animate-steam',
          style: `animation-delay: ${wisp * 300}ms`,
        },
      ];
}) as IconNode;
export const BrewingIcon = icon(BREWING);
// The cup filling from the bottom and starting over, under the same steam.
export const PouringIcon = icon([
  [
    'rect',
    {
      x: '5',
      y: '10',
      width: '10',
      height: '9',
      rx: '2',
      fill: 'currentColor',
      stroke: 'none',
      class: 'animate-fill',
      style: 'transform-box: fill-box; transform-origin: bottom',
    },
  ],
  ...BREWING,
] as IconNode);
export const QueueIcon = icon(ListPlus);
export const QuestionIcon = icon(MessageCircleQuestion);
/** Keeping a file open in the sidebar. */
export const PinIcon = icon(Pin);
export const KeyboardIcon = icon(Keyboard);
export const ThemeIcon = icon(SunMoon);

// The app shell: the sidebar's menu, the command menu, themes.
export const ChevronsUpDownIcon = icon(ChevronsUpDown);
export const CommandIcon = icon(Command);
export const EnterIcon = icon(CornerDownLeft);
export const InboxIcon = icon(Inbox);
export const SunIcon = icon(Sun);
export const MoonIcon = icon(Moon);
export const SystemThemeIcon = icon(Monitor);

// Review: filtering changes, dropping files.
export const FilterIcon = icon(ListFilter);
export const UploadIcon = icon(Upload);
export const CommitIcon = icon(GitCommitHorizontal);
