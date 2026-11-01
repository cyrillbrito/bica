# UI

How Bica looks and is built. Read before touching UI.

## Principles

- Calm, dense, fast. Content first, chrome recedes. No decoration that doesn't carry meaning.
- Mobile is first-class. Every feature works on a phone, and it's not a reduced desktop.
- Instant. Interactions respond on the same frame, and animations are short (≤200ms) and never block.
- Our own look, inspired by the best, not cloned from a component kit.

## Stack

- Tailwind v4 is configured in `client/src/App.css` (`@theme`), with no config file. Design tokens live there, and reusable class groups as `@utility`.
- There is no component library. Platform features come first: `<dialog>`, `popover`, CSS anchor positioning, `<details>`, `field-sizing: content`, view transitions.
- Components live in their feature's folder, such as `client/src/sessions/`, and building blocks with no app knowledge (buttons, inputs, menus, toasts, icons) in `client/src/ui/`. Reach for those before styling a raw `<button>` or `<input>`. If two places style the same control by hand, it belongs there.
- The building blocks are listed under [Building blocks](#building-blocks) below, and every one of them shows in light and dark side by side at `/ui` in development (`client/src/playground/`). Add a new one there too.
- Live timers come from `createStopwatch` and `formatLive` in `client/src/ui/time.ts`, and stay hidden until a wait gets long. The per-second `tick` is enough for anything else. Every duration, timer, and countdown reads the same, through `formatDuration` ("42s", "3m 07s", "1h 05m"); tokens and dollars go through `formatTokens` and `formatCost` in `ui/format.ts`.
- A setting kept per device, such as the theme or line wrap, is a `stored(key, default)` signal from `ui/stored.ts`, saved as `bica.<key>` in `localStorage`. A list filtered by a search field matches with `matches(query, ...texts)` from `ui/search.ts`. `isTouch()` in `ui/layout.ts` says the screen is touch, for focusing a field only where no keyboard would cover the page.
- Files and diffs drawn by Pierre take their options from `client/src/files/pierre.ts`, so a diff splits, numbers its lines, and themes the same everywhere, Markdown's code blocks included.
- Button variants: `soft` for a main action that stays on screen, like commit, and `danger` to end something live, like a call.
- Overrides go through `class` and must not fight the base (no second `h-*`, `px-*`, `gap-*`). Add a variant or size instead. Longhands like `rounded-r-none` or `pl-*` are fine, since Tailwind orders them after the shorthand.
- Buttons, selects, summaries, tabs, menu items and checkbox labels get `cursor: pointer` from a base rule in `App.css`, since Tailwind v4 dropped it. Don't add `cursor-pointer` by hand.
- Third-party views (`@pierre/diffs`, `@pierre/trees`) are themed through their CSS variables, not Tailwind classes.
- Icons are [Lucide](https://lucide.dev/icons), 16px, stroke 1.75, from `ui/icons.tsx`. Never hand-draw an SVG icon: import the shape from `lucide` and add one line there. `lucide-solid` is built for Solid 1, so a small wrapper draws the shapes.

## Building blocks

Everything in `client/src/ui/`, by job. Reach for these before styling a raw element.

| Job | Parts |
| --- | --- |
| Actions | `Button` (variants `primary`, `soft`, `outline`, `ghost`, `danger`; sizes `sm`, `md`, `lg`; `loading`), `IconButton` (`title` is its label; `loading` too), `CopyButton` (the icon turns into a drawn check, no toast), `Kbd` (a key hint, hidden on touch) |
| Fields | `Input` and `fieldFrame`, `TextArea` (grows as you type; `framed` or bare inside a box), `Field` with `checkKey` (a labelled input whose check draws in when the value looks right, and rings red with the reason when it doesn't), `InlineInput` (rename in place), `Select`, `Switch`, `CheckMark` (the box or dot of a checkbox or radio row), `Segmented` with `SegmentCount` |
| Lists and menus | `optionClass`, `OptionList` (its hover fill glides from row to row), `OptionGroup`, `NoMatches`, `ContextMenu` with `MenuButton`, `FilterMenu` with `FilterChips`, `Summary` and `summaryClass` (the row of a `<details>`), `Chevron`, `Divider` (a list heading drawn as a rule) |
| Surfaces | `Dialog` and `dialogBody`, `Popover` with `PopoverSearch`, `Card` with `Setting` and `Toggle` (a settings section: a grey tray with the title, holding a white card of rows), `Strip` (one line on a tray: an icon, a label, an action), `Empty` (a quiet message, or with `icon`, `title`, and `action` a small empty state), `Failed` |
| Status | `Spinner`, `ThinkingLoader`, `Tag` with `tagClass` (a calm tinted label: Waiting, Failed, Open #42), `Alert`, `toast` with `.success`, `.error` (takes whatever was thrown), `.info`, `.loading`, `.promise`, and `.dismiss` |
| Numbers | `RollingNumber` (digits roll when it changes), `ProgressRing` (one segment per part, a rolling number in the middle), `Trend` (a change on a tinted arrow tile), `Breakdown` (a total split into ranked parts with a gliding bar) |
| Keyboard | `createActiveOption` (a list a search field drives, as a combobox: ↑ and ↓ move a highlight that wraps, Enter picks, focus stays in the field), `moveFocus` (menus and tabs whose rows take focus: arrows step and wrap, Home and End jump) |
| Motion helpers | `createHighlight` (the gliding hover fill), `createFlip` (rows glide to their new place), `createSortable` (drag to reorder on `@dnd-kit/dom`), `createDropZone` (files dragged over fan out as little documents), `arrive` (text the fast model wrote fades in with an accent tint) |

### Shells

- A modal is a `Dialog`: a bottom sheet on the phone, a centred card from `md` up, with a titled header, a close button, and an optional footer for its actions. The command palette is the one exception, since it fills the phone screen.
- A menu that opens from a button is a `Popover`: a card on a tray under (or above) its button, a sheet on the phone. Its rows go in an `OptionList`.
- Menu and picker rows are 32px (`optionClass`), unlike the 28px rows of the sidebar and the transcript, since they are read one by one. Pickers driven from a search field (the project menu, ⌘K) fill the row the keyboard is on (`data-active`) instead of gliding.
- A note above the composer (night run, parent in charge, stuck) is a `Strip`.
- Errors that block a form show as an `Alert` in place; failures with nowhere to show go to `toast.error`. `errorText` turns whatever was thrown into its message.

### Loading and busy

One look per kind of wait, so a wait reads the same everywhere.

- Something is working: the `Spinner`, eight rays lit in turn (`ThinkingLoader` is the spinner and a label that rolls to the next step and settles on a check). It is the only spinner; the sidebar's status ring and the toast's arc are status shapes, not spinners.
- A label for work in progress shimmers (`shimmer`): Working, Compacting context, Waiting for the result.
- An action in flight is a `loading` button: the leading icon becomes the spinner and the label shines. It isn't `disabled`, which says "you can't" rather than "it's happening".
- Data on its way shows nothing: the frame of the page with blank areas. Most data is cached or quick, and a skeleton or spinner that flashes for a moment reads slower than nothing (affectUI's Shimmer Loader draws the line at about 300ms).
- A wait that gets long shows a live timer (`formatLive`), not a bigger spinner.

## Tokens

Tokens are defined once with `light-dark()`. Light and dark follow the system unless Settings → Appearance forces one (per device, `client/src/ui/theme.ts`). Forcing sets `data-theme` on `<html>`, which pins `color-scheme`, and an inline script in `Document.tsx` applies it before first paint. Anything themed must follow `color-scheme` (`light-dark()`), never `prefers-color-scheme` directly.

### Color

- Colors: `bg`, `panel`, `surface`, `hover`, `active`, `line`, `line-strong`, `fg`, `muted`, `accent` (orange), `brand` (blue, the logo), `running` (green), `warn` (yellow), `danger`, `merged` (purple, merged PRs), `thumb` (the raised thumb of a segmented control: white in light, a light veil in dark). Small colored text on a tint of its own color (a tag, the sidebar's running clock) uses the `-ink` shade: `accent-ink`, `running-ink`, `warn-ink`, `danger-ink`, `merged-ink`, darker in light mode so 12px text keeps AA contrast. Use them as `bg-panel`, `text-muted`, `border-line`.
- Dark mode is a dimmed dark, a neutral gray near `#1c1c20` rather than black, after [GitHub's Dark Dimmed](https://github.blog/changelog/2021-04-21-dark-dimmed-theme-is-now-available-on-github/): it is easier on the eyes for long reading, and shadows and raised surfaces still show. Pierre's diffs take the same background (`--diffs-dark-bg` in `App.css`), so code doesn't sit in a black hole.
- Selection is tinted with the accent. Replies wrap with `text-wrap: pretty` (no lone last word), and headings with `balance`.

### Radius

Only these exist. Tailwind's others are removed, and the `bica/radius-tokens` lint rule fails on them and on raw values.

- Controls by height: `rounded-sm` (4px) for swatches, inline code, and badges, `rounded-md` (6px) for rows and controls up to 28px, and `rounded-lg` (8px) for 32px+ controls, chips, and strips.
- Surfaces by role: `rounded-card` (10px) for cards, menus, popovers, dialogs, and code blocks, `rounded-sheet` (16px) for the composer, your prompts, and bottom-sheet tops, and `rounded-tray` (20px) for a tray holding a sheet-round card with `p-1` (a question, the composer with queued prompts).
- `rounded-cell` (2px) for the smallest pieces of a meter: cells of the context field, segments of a bar or a sparkline.
- `rounded-full` for round buttons, dots, and bars.
- Nested corners are concentric: inner radius = outer radius − the padding between them. A `rounded-card` with `p-1` holds `rounded-md` rows.

### Shadows

Only these exist, since Tailwind's are removed. In dark mode they get darker, and floating ones a faint light top edge, so they still read.

- `shadow-raised`: resting on the page (the composer).
- `shadow-menu`: menus, popovers, the toast.
- `shadow-sheet`: dialogs, bottom sheets, drawers.
- `shadow-thumb`: the thumb of a segmented control, raised in its tray.

### Heights

Controls and rows step 24 · 28 · 32px (`Button` sizes `sm` · `md` · `lg`; list rows are 28px), and bars (top bar, panel and dialog headers) are 48px. On touch, anything tappable grows to 44px (`touch:h-11`). Padding inside follows the height: `px-1.5` in 24–28px rows, `px-2.5` in 32px+ controls and strips.

### Type

Sizes are defined by role in `@theme`, and Tailwind's own sizes (`text-sm`, `text-xl`…) and families (`font-sans`, `font-serif`) are removed. Each size carries its line height. Pick by what the text is, not how big it should look.

- `text-meta` (12px): times, counts, hints, small-control labels. The floor: nothing smaller.
- `text-ui` (14px): everything you click or scan. The body default.
- `text-code` (13px): code blocks, tool output, diffs, terminals.
- `text-read` (16px, 1.65): the conversation (agent replies, your prompts, the composer) and touch inputs, since iOS zooms below 16px.
- `text-display` (22px): one big number or title per screen.
- `text-greeting` (32px): the greeting over the new session composer, in `font-reading`.
- `font-ui` (Atkinson Hyperlegible Next, built for legibility and narrower than Lexend, so rows fit more) for the app, `font-reading` (Libron, a book face) for what the agent writes (`.markdown`), and `font-mono` (Atkinson Hyperlegible Mono, the same family) for code, paths, diffs and terminals. Fonts are self-hosted in `public/fonts/`. Tables in replies stay in `font-ui`, and Markdown headings scale in `em`.
- The `bica/type-tokens` lint rule (`lint/bica.js`) fails on removed Tailwind names and raw sizes like `text-[13px]`. A new role goes in `@theme` and here, not inline.

### Motion

Hover and press take about 150ms, and panels and sheets at most 200ms. `ease-out` is a strong curve (`cubic-bezier(0.23, 1, 0.32, 1)`), drawers and sheets use `ease-drawer`, and `ease-spring` overshoots a little, for things springing back, like a toast swiped too short. Entrances only: closing is instant. Fades stay under reduced motion, and movement is `motion-safe`. Don't animate what you do 100+ times a day or from the keyboard: switching sessions, shortcuts, list navigation.

Text the fast model writes in place, like a session title or a commit message, fades in with an accent tint that settles over about a second (`arrive` in `client/src/ui/arrive.ts`, or `createArrival` for a ref that plays it on each change). Otherwise the swap is instant and easy to miss. It plays only when the text changes, never on mount or when you switch sessions. The idea comes from [How I make apps feel premium](https://youtu.be/MXLF8b15GhQ), which starts with feedback for an AI summary.

The utilities in `App.css`:

- `pop`: menus, popovers, dialogs fade and grow in (from `transform-origin`; modals stay centred).
- `sheet`: phone bottom sheets slide up (`max-md:sheet md:pop` when a surface is both).
- `appear`: things that turn up on their own (a question, a queued prompt, a warning) fade and settle.
- `expand`: on a `<details>`, opens smoothly instead of snapping.
- `swap-in`: an icon replacing another in place blurs and grows in (a tool call's spinner becoming its icon). Only when you saw the change happen, not on load.
- `roll-in` / `roll-out`: a character or label rolling in where another was, from below when a value grows and from above when it shrinks (set `--roll-from` negative). `RollingNumber` and `ThinkingLoader` use them.
- `morph`: a box whose width JS sets to its content glides to the new size.
- `glide`: the segmented thumb sliding between options. Its leading edge runs ahead, so it stretches a little and settles.
- `shine`: busy content, text and icons alike, dims under a sweeping band of light (a loading `Button`). It is a mask, so the control's fill stays. It stays under reduced motion.
- `draw`: an SVG stroke drawing itself in (give the path `pathLength="1"`), like the check of a finished toast. `DrawnCheckIcon` is Lucide's check with it.
- `stream-in`: a block of a streaming reply fading (and unblurring) in, laid out like `contents`.
- `cell`: a cell of a field or meter. A new fill sweeps through cell by cell (`--i` is its index), and `data-busy` makes it breathe in a wave while work runs (a fade under reduced motion, since it's progress).
- `fold`: a part unfolding in place (grid rows from 0fr), with one child. Set `data-open`, and `inert` while closed. Closing is instant.
- `animate-grow`: a bar growing up from its base on first view (the days of a sparkline).
- `rise-in`: rows of a summary arriving one after another on first view. Set `--i` to the row's place.
- `animate-chip-in`: a filter chip arriving, fading and growing in a little.
- `animate-breathe`: a halo swelling around a dot that waits on you (a session asking a question). It is `motion-safe` only, since the ring shape already says it.
- The queue glide: a prompt the agent takes slides from its queue line into the transcript (`sessions/queue-glide.ts`).
- `animate-ray`: the rays of the `Spinner`, lit one after another, so it turns without rotating.
- `animate-nudge`: a small shake every few seconds, for the context chip of a session that grew too big.
- `context-target`: a row held on touch sinks and darkens until its context menu opens.

Buttons sink to 97% while pressed and spring back in 150ms (`ui/Button`), but not while `loading`. Toasts slide in from the top edge, stack with the older ones peeking out below, fan into a list on hover, focus, or a tap, and swipe away sideways or up. The hover fill of menus and option lists glides to the row under the pointer (`createHighlight`, built into `OptionList`), while keyboard moves land at once. Sidebar rows glide to their new place when the order changes, as with a new session, one archived, or a filter picked (`createFlip`, also the ranked rows of a `Breakdown`), but not when switching sessions.

## Layout

What each screen size shows is in [layout.md](./layout.md): phone is below `md`, tablet `md` to `xl`, and wide screen from `xl`, Tailwind's default breakpoints. State lives in `client/src/ui/layout.ts`.

- Toggles sit in the page's top bar.
- Hiding or showing a column slides it (200ms, motion-safe): a hidden column is zero wide, not removed, and its content keeps its width so it moves instead of squeezing. Only the toggle animates; dragging an edge or resizing the window stays instant (`sliding` in `layout.ts`).
- Columns resize by dragging their inner edge (arrow keys when focused, double-click resets). Widths are bounded per column and by the window: the centre column always keeps 400px, and the rendered width is re-clamped when the window shrinks (`layout.ts`). Column wrappers are `shrink-0 min-w-0` and their contents `overflow-hidden`, so inner content can't push a column wider.
- Overlays have a backdrop and make `main` inert. Navigating closes them.
- Transcript and composer share one centered column (`chat-column`, max 720px; 12px side padding on phone).
- On phone, expanded tool output, thoughts and diffs have no height cap, wrap long lines and drop the indent: the transcript is the only scroller. Desktop caps them and scrolls inside.
- Diffs are unified on phone, split allowed on desktop.

## Context menus

Right click (or the menu key / Shift+F10, or a long press on touch) opens a menu on the thing under the pointer: a session row, a workspace header. One `ContextMenu` is mounted in `App.tsx`; any element opts in by spreading `contextMenu(() => items)` (`client/src/ui/ContextMenu.tsx`) and adding the `context-target` class (no iOS callout or text selection on long press).

- Items are read when the menu opens, so they can look at current state. An item is `{ label, icon, onSelect, danger?, disabled?, hint?, keys? }`; `'separator'` splits groups. `disabled` can be a string, shown as the reason on hover, `hint` explains the item on hover, and `keys` shows a shortcut on the right.
- It grows in from the pointer, and outside press, Esc, scroll, and resize close it. It is a manual popover, since light dismiss would close it on the right click's own pointerup.
- A long press is hard to discover, so on touch the busiest rows (sessions) also show a "⋯" `MenuButton` with the same items. Swipe actions are not used, for the same reason.
- Keep menus short and put the most common action first. Everything in a menu should also be reachable some other way, since touch and keyboard users may never open it.
- File rows are Pierre trees, which draw their own "⋯" on hover (always on touch) and open this same menu.

## Sound

Sounds are short and synthesized with Web Audio, with no audio files: a chime when a session stops running, and a cheer for a compaction. One plays per change across open tabs. Settings → Appearance turns them off per device.

## Mobile checklist

- `viewport-fit=cover` and `env(safe-area-inset-*)` padding.
- `interactive-widget=resizes-content` and `100dvh`; the composer sits on the keyboard.
- Inputs at least 16px so iOS doesn't zoom.
- Touch targets at least 44px; hover styles only under `@media (hover: hover)`.
- `overscroll-behavior: contain` on scroll areas.
- Enter inserts a newline on touch devices; send with the button. On desktop, Enter sends, Shift+Enter newlines.
- `touch:` variant (`pointer: coarse`) for touch-only sizing.
- `theme-color` meta matching `bg`.

## Test data

Screens are drawn against kind data, so check them against the worst realistic data too: long names, missing fields, huge counts, non-Latin text. In development, pick one under Settings → Test data, or open any page with `?data=worst` (or `demo`, `empty`, `one`, `huge`, or `live` for real data). A switch at the bottom of the page changes it, – hides it until a reload (for screenshots), and × turns it off. It stays on for the tab across navigation and reloads.

- The test data stands in where topics are read (`useTopic`), so every screen gets it. It never reaches the server or the cache on the device.
- The whole app has test data, in `client/src/fixtures/`: the sidebar (sessions, projects, terminals, kept files), the transcripts, and the side panel (git status and files). In `demo` and `worst`, models (with list prices), providers, plan usage (limits near and at the cap), and each live test session's context have test data too (`usage.ts`), and Compact and Clean up play out on them. The other modes keep those live.
- Transcripts go through the same projection as live data, so opened rows load their details. In `demo` and `worst`, a few sessions play out live: one runs on a loop, one waits on a question, and one holds every kind of finished row.
- Demo data doubles as screenshot data: `/s/demo-shortcuts?data=demo` shows one session from prompt to reply, with its changes and diffs on the right.
- Commands are held back while it's on: they are logged to the console and never answer. Reads with test data (step details, files and diffs in the test data) answer from it; other reads go to the server.

## Debugging Solid updates

When something doesn't update, updates too often, or is slow, record what happened instead of guessing. Do the same to check that a change didn't add extra updates. The reports name signals, memos, and effects by their `{ name }` option.

- On the dev server, `diagnostics: true` in `client/vite.config.ts` turns on `/__solid/diagnostics`. It needs an open page connected to the dev server, for example through `agent-browser`.
- `GET /__solid/diagnostics` returns the status and how many pages are connected.
- `POST` it `{"method":"begin"}` and later `{"method":"end"}` to record everything in between.
- `{"method":"whyDidRun","params":{"name":"<scope name>"}}` lists each time one named signal, memo, or effect re-ran during the recording, and `{"method":"costs"}` returns the cost tables.

## Accessibility

- Semantic HTML first (`nav`, `main`, `aside`, `button`, `a`); ARIA only to fill gaps.
- Visible `:focus-visible` everywhere; full keyboard operation. Text fields show focus as a darker frame with a soft accent ring (`fieldFrame`), and option rows fill with `active`; everything else gets the accent outline.
- Tabs follow the ARIA tabs pattern: arrow keys move between them, and only the picked one is in the Tab order. A search field that drives a list is a combobox naming the row it's on.
- Dialogs and sheets trap focus and close on Escape (native `<dialog>` does this).
- Respect reduced motion for decorative motion. Settings → Appearance → Motion (System, Full, Reduced; per device, `client/src/ui/motion.ts`) can override the system setting, like the theme: it sets `data-motion` on `<html>`. So gate CSS with Tailwind's `motion-safe:` / `motion-reduce:` (redefined in `App.css` to follow it) and JS with `reducedMotion()`, never `prefers-reduced-motion` directly. Progress signals (spinner, `shimmer` on running work) stay on: they carry state, and the author runs macOS with reduced motion on.
- Text contrast WCAG AA in both themes; status is never color-only (pair with label or shape).

## Skills

Emil Kowalski's design-engineering skills ([emilkowalski/skills](https://github.com/emilkowalski/skills)) set the bar for motion and polish here. Read them before motion work:

- [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md): when to animate, easing, durations, press feedback, origin-aware popovers.
- [find-animation-opportunities](https://github.com/emilkowalski/skills/blob/main/skills/find-animation-opportunities/SKILL.md): where motion helps, and the gate that rejects most candidates.
- [improve-animations](https://github.com/emilkowalski/skills/blob/main/skills/improve-animations/SKILL.md) and [review-animations](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/SKILL.md): audit and review existing motion.

The repo's `frontend-design` skill (`.agents/skills/`) covers visual direction and typography.

## Inspiration

Use [mobbin.com](https://mobbin.com) for real app screens and flows; its [MCP server](https://docs.mobbin.com/mcp/features) lets an agent search it. [Refero](https://refero.design) covers web and SaaS.

| Area | Look at | Take |
| --- | --- | --- |
| Chat | ChatGPT, Claude, Codex, Cursor | Prose replies without bubbles, user message as a pill, composer as the hero |
| Navigation & density | Linear | Quiet sidebar, keyboard-first, subtle active states |
| Panels & diffs | Zed, Conductor, GitHub | Collapsible panes, compact file tree, readable mobile diffs |
| Polish | Raycast, v0 | Motion restraint, typography, empty states |
| AI components | affectUI | Rolling numbers, gliding pills, morphs, shimmer, agent cards (see below) |

### affectUI

[affectUI](https://www.affectui.com) is a React kit of components for AI products: tool calls, approvals, agent inboxes, context windows, model pickers, usage meters, toasts. It is the closest match to what Bica shows, and its motion is calm and exact. Much of Bica's current finish comes from it: `RollingNumber`, the gliding `Segmented` thumb, `Button loading`, the toast stack, `ThinkingLoader`, the Activity header, question cards, the context field, ⌘K, the sidebar tabs and clocks, and the workspace card.

Look there first when designing a new agent surface:

- Every item is one `.tsx` file with its CSS inside. The free ones are MIT, and their source comes from `https://www.affectui.com/r/<name>.json` (the shadcn registry format). Read their keyframes, easing, and durations.
- Pro items have no source, but their demo pages do the real thing. Open them with `agent-browser`, interact, and read computed styles and `document.getAnimations()`.
- `https://www.affectui.com/llms-full.txt` holds every item's docs. The Motion, Accessibility, and "When not to use" sections are worth more than the props.
- Port the idea, never the code: it is React, Bica is Solid. Bica's tokens, radii, type roles, and motion rules above win over affectUI's.
- Not taken: big flashy illustrations, and pills where a word does. The working state is a shimmering word, not a capsule.

Add links here as we find good references.
