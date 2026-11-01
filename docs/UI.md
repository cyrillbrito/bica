# UI

How Bica looks and is built. Read before touching UI.

## Principles

- Calm, dense, fast. Content first, chrome recedes. No decoration that doesn't carry meaning.
- Mobile is first-class. Every feature works on a phone, and it's not a reduced desktop.
- Instant. Interactions respond on the same frame, and animations are short (≤200ms) and never block.
- Our own look, inspired by the best, not cloned from a component kit.

### Personality

Bica is a professional tool with a little warmth, never a cartoon. The warmth comes from its name, coffee, and shows only while you wait on something.

- Settled: no mascot. No faces, filled illustrations, blush, confetti, or bright color fills.
- Settled: actions, navigation, and labels use plain Lucide icons and plain words. Starting a session is a plain icon, a failure says "Failed", and a button says "Commit".
- Settled: coffee lives in status. Today that is the working line (a cup with rising steam or filling, and phrases like "Pulling a shot") and the sounds.
- Open: how far coffee goes past the working line. Calm keeps it there. Warm gives a few more states their own cup, drawn as Lucide's line cup in `currentColor` with the accent only on what moves: a puff and a hop when a run finishes, a cup that tips over when it fails, steam that holds while it waits on you, a tamper while compacting. Either way, a moment plays only when you saw the change, and one change gets one moment.

The dev-only `/lab` page shows the same moments in calm and warm side by side. It is a brainstorm, and goes away once this settles.

## Stack

- Tailwind v4 is configured in `client/src/App.css` (`@theme`), with no config file. Design tokens live there, and reusable class groups as `@utility`.
- There is no component library. Platform features come first: `<dialog>`, `popover`, CSS anchor positioning, `<details>`, `field-sizing: content`, view transitions.
- Components live in their feature's folder, such as `client/src/sessions/`, and building blocks with no app knowledge (buttons, inputs, menus, toasts, icons) in `client/src/ui/`.
- Every building block shows in light and dark side by side at `/ui` in development (`client/src/playground/`). Add a new one there too.
- Third-party views (`@pierre/diffs`, `@pierre/trees`) are themed through their CSS variables, not Tailwind classes. Files and diffs take their options from `client/src/files/pierre.ts`, so a diff splits, numbers its lines, and themes the same everywhere, Markdown's code blocks included.

## Building blocks

Everything in `client/src/ui/`, by job. Reach for these before styling a raw `<button>` or `<input>`. If two places style the same control by hand, it belongs here.

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
| Helpers | `createStopwatch` and `formatLive` (`time.ts`, live timers hidden until a wait gets long; the per-second `tick` is enough for anything else), `formatDuration` ("42s", "3m 07s", "1h 05m"), `formatTokens` and `formatCost` (`format.ts`), `stored(key, default)` (a per-device setting saved as `bica.<key>` in `localStorage`), `matches(query, ...texts)` (`search.ts`, for any list a search field filters), `isTouch()` (`layout.ts`, to focus a field only where no keyboard would cover the page) |

### Using them

- Button variants: `soft` for a main action that stays on screen, like commit, and `danger` to end something live, like a call.
- A view has at most one `primary` (near-black) button: the composer's send button wherever there is a composer. Another main action near it is `soft`, and an action inside a note or strip is a small `outline` button.
- Overrides go through `class` and must not fight the base (no second `h-*`, `px-*`, `gap-*`). Add a variant or size instead. Longhands like `rounded-r-none` or `pl-*` are fine, since Tailwind orders them after the shorthand.
- Buttons, selects, summaries, tabs, menu items and checkbox labels get `cursor: pointer` from a base rule in `App.css`, since Tailwind v4 dropped it. Don't add `cursor-pointer` by hand.
- Icons are [Lucide](https://lucide.dev/icons), 16px, stroke 1.75, from `ui/icons.tsx`. Never hand-draw an SVG icon: import the shape from `lucide` and add one line there. `lucide-solid` is built for Solid 1, so a small wrapper draws the shapes. The animated coffee cups are Lucide's cup with moving parts, built the same way.

### Shells

- A modal is a `Dialog`: a bottom sheet on the phone, a centred card from `md` up, with a titled header, a close button, and an optional footer for its actions. The command palette is the one exception, since it fills the phone screen.
- A menu that opens from a button is a `Popover`: a card on a tray under (or above) its button, a sheet on the phone. Its rows go in an `OptionList`.
- Menu and picker rows are 32px (`optionClass`), unlike the 28px rows of the sidebar and the transcript, since they are read one by one. Pickers driven from a search field (the project menu, ⌘K) fill the row the keyboard is on (`data-active`) instead of gliding.
- A note above the composer (night run, parent in charge, stuck) is a `Strip`.
- A session's status is one ring family (`StatusDot`): the same size and stroke, and each state differs in shape as well as color. Idle is an empty ring, running a spinning arc, waiting a ring with a centre dot and a breathing halo, done a filled ring, and failed a ring with an x. The spin is progress, so it always plays; the halo is `motion-safe` only.
- Two kinds of switcher, each with one job. Tabs in a header switch what a column shows (the side panel's Files and Git). A `Segmented` control filters a list or picks a mode in place (the sidebar's All and Active, the theme).
- Errors that block a form show as an `Alert` in place; failures with nowhere to show go to `toast.error`. `errorText` turns whatever was thrown into its message.

### Loading and busy

One look per kind of wait, so a wait reads the same everywhere.

- Something is working: the `Spinner`, eight rays lit in turn (`ThinkingLoader` is the spinner and a label that rolls to the next step and settles on a check). It is the only spinner; the sidebar's status ring and the toast's arc are status shapes, not spinners. The agent's own turn is the exception: the working line shows a coffee cup (see Personality).
- A label for work in progress shimmers (`shimmer`): Working, Compacting context, Waiting for the result.
- An action in flight is a `loading` button: the leading icon becomes the spinner and the label shines. It isn't `disabled`, which says "you can't" rather than "it's happening".
- Data on its way shows nothing: the frame of the page with blank areas. Most data is cached or quick, and a skeleton or spinner that flashes for a moment reads slower than nothing (affectUI's Shimmer Loader draws the line at about 300ms).
- A wait that gets long shows a live timer (`formatLive`), not a bigger spinner.

## Tokens

Tokens are defined once with `light-dark()`. Light and dark follow the system unless Settings → Appearance forces one (per device, `client/src/ui/theme.ts`). Forcing sets `data-theme` on `<html>`, which pins `color-scheme`, and an inline script in `Document.tsx` applies it before first paint. Anything themed must follow `color-scheme` (`light-dark()`), never `prefers-color-scheme` directly.

### Color

Only these exist. Tailwind's palette is removed, and the `bica/color-tokens` lint rule fails on its names (`bg-red-500`, `text-white`) and on raw values (`bg-[#fff]`). A new color goes in `@theme` and here.

- Layers: `bg`, `panel`, `surface`, `well`, see Layers below. `backdrop` dims the page behind a dialog, and `paper` is plain white for a page that brings its own colors, like an HTML preview.
- Washes of `fg`, which work on any layer: `hover`, `active`, `line`, `line-strong`.
- Text: `fg`, and `muted` for anything secondary.
- Meaning: `accent` (copper, what wants you: an unread run, a question, a link), `running` (green), `warn` (amber), `danger`, `merged` (purple, merged PRs), and `added` and `removed` for diff lines (blue and orange, GitHub's colorblind pair). Small colored text on a tint of its own color (a tag, the sidebar's running clock) uses the `-ink` shade: `accent-ink`, `running-ink`, `warn-ink`, `danger-ink`, `merged-ink`, darker in light mode so 12px text keeps AA contrast.
- `thumb`: the raised thumb of a segmented control, white in light and a light veil in dark.
- Color is for what needs you. An icon or a meter that only labels or measures stays `fg` or `muted`, like the hub icon or a plan bar under its limit; it turns `warn` or `danger` when it needs you.
- Light mode is picked in OKLCH, a color space where equal numbers look equally light. Greys sit on hue 80 (beige) with a trace of chroma, away from both blue and red, after Radix's Sand, Anthropic's ivory, and Linear's 2026 move to warmer greys. Status colors share a lightness and differ in hue, so none shouts louder than the others. `App.css` writes each as hex, with its OKLCH value in a comment, and every text pair passes AA.
- Dark mode is a dimmed dark, a neutral gray near `#1c1c20` rather than black, after [GitHub's Dark Dimmed](https://github.blog/changelog/2021-04-21-dark-dimmed-theme-is-now-available-on-github/): it is easier on the eyes for long reading, and shadows and raised surfaces still show. Pierre's diffs take the same background (`--diffs-dark-bg` in `App.css`), so code doesn't sit in a black hole.
- Selection is tinted with the accent. Replies wrap with `text-wrap: pretty` (no lone last word), and headings with `balance`.

### Layers

From the canvas, a surface steps one way: out, raised toward you, or in, sunk below.

- Canvas (`bg`): the centre, where you read.
- Chrome (`panel`): the sidebar, the side panel, and toolbars, a step darker so the eye goes to the centre. It is solid, so the tray of a floating menu, dialog, or the command palette uses it too.
- Raised (`surface` with a shadow): what you act on or what floats: the composer, cards, your prompts, menus, dialogs.
- Wells (`well`): what sits sunk in its holder: code blocks, inline code, table heads, and the in-page trays of a settings card or a question. It is a wash, not a grey, so it reads as one step in on the canvas, in the sidebar, or in a white card.
- Stack at most two steps. A well in a raised card is fine; a card in a well in a card turns muddy.

### Radius

Only these exist. Tailwind's others are removed, and the `bica/radius-tokens` lint rule fails on them and on raw values.

- Controls by height: `rounded-sm` (4px) for swatches, inline code, and badges, `rounded-md` (6px) for rows and controls up to 28px, and `rounded-lg` (8px) for 32px+ controls, chips, and strips.
- Surfaces by role: `rounded-card` (10px) for cards, menus, popovers, dialogs, and code blocks, `rounded-sheet` (16px) for the composer, your prompts, and bottom-sheet tops, and `rounded-tray` (20px) for a tray holding a sheet-round card with `p-1` (a question, the composer with queued prompts).
- `rounded-cell` (2px) for the smallest pieces of a meter: cells of the context field, segments of a bar or a sparkline.
- `rounded-full` for round buttons, dots, and bars.
- Nested corners are concentric: inner radius = outer radius − the padding between them. A `rounded-card` with `p-1` holds `rounded-md` rows.

### Shadows

Only these exist, since Tailwind's are removed. In dark mode they get darker, and floating ones a faint light top edge, so they still read.

A shadow goes only on what floats over content (menus, popovers, dialogs, sheets, drawers, toasts, drag ghosts, and the composer or the call bar in its place) and on the thumb of a control. Cards in the page stay flat, with a border or in a well. Headers have no line under them either: the panel colors already separate the columns.

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

## Motion

Hover and press take about 150ms, and panels and sheets at most 200ms. `ease-out` is a strong curve (`cubic-bezier(0.23, 1, 0.32, 1)`), drawers and sheets use `ease-drawer`, and `ease-spring` overshoots a little, for things springing back, like a toast swiped too short.

- Entrances only: closing is instant.
- Fades stay under reduced motion, and movement is `motion-safe`.
- Don't animate what you do 100+ times a day or from the keyboard: switching sessions, shortcuts, list navigation.
- A change plays only when you saw it happen, never on load or when you switch sessions.

### Patterns

- Buttons sink to 97% while pressed and spring back in 150ms (`ui/Button`), but not while `loading`.
- The hover fill of menus and option lists glides to the row under the pointer (`createHighlight`, built into `OptionList`), while keyboard moves land at once.
- Sidebar rows glide to their new place when the order changes, as with a new session, one archived, or a filter picked (`createFlip`, also the ranked rows of a `Breakdown`), but not when switching sessions.
- Toasts slide in from the top edge, stack with the older ones peeking out below, fan into a list on hover, focus, or a tap, and swipe away sideways or up.
- Text the fast model writes in place, like a session title or a commit message, fades in with an accent tint that settles over about a second (`arrive` in `client/src/ui/arrive.ts`, or `createArrival` for a ref that plays it on each change). Otherwise the swap is instant and easy to miss. The idea comes from [How I make apps feel premium](https://youtu.be/MXLF8b15GhQ), which starts with feedback for an AI summary.
- A prompt the agent takes slides from its queue line into the transcript (`sessions/queue-glide.ts`).

### Utilities

In `App.css`:

- `pop`: menus, popovers, dialogs fade and grow in (from `transform-origin`; modals stay centred).
- `sheet`: phone bottom sheets slide up (`max-md:sheet md:pop` when a surface is both).
- `appear`: things that turn up on their own (a question, a queued prompt, a warning) fade and settle.
- `expand`: on a `<details>`, opens smoothly instead of snapping.
- `fold`: a part unfolding in place (grid rows from 0fr), with one child. Set `data-open`, and `inert` while closed. Closing is instant.
- `swap-in`: an icon replacing another in place blurs and grows in (a tool call's spinner becoming its icon).
- `roll-in` / `roll-out`: a character or label rolling in where another was, from below when a value grows and from above when it shrinks (set `--roll-from` negative). `RollingNumber` and `ThinkingLoader` use them.
- `morph`: a box whose width JS sets to its content glides to the new size.
- `glide`: the segmented thumb sliding between options. Its leading edge runs ahead, so it stretches a little and settles.
- `shine`: busy content, text and icons alike, dims under a sweeping band of light (a loading `Button`). It is a mask, so the control's fill stays. It stays under reduced motion.
- `draw`: an SVG stroke drawing itself in (give the path `pathLength="1"`), like the check of a finished toast. `DrawnCheckIcon` is Lucide's check with it.
- `stream-in`: a block of a streaming reply fading (and unblurring) in, laid out like `contents`.
- `cell`: a cell of a field or meter. A new fill sweeps through cell by cell (`--i` is its index), and `data-busy` makes it breathe in a wave while work runs (a fade under reduced motion, since it's progress).
- `animate-grow`: a bar growing up from its base on first view (the days of a sparkline).
- `rise-in`: rows of a summary arriving one after another on first view. Set `--i` to the row's place.
- `animate-chip-in`: a filter chip arriving, fading and growing in a little.
- `animate-breathe`: a halo swelling around a dot that waits on you (a session asking a question). It is `motion-safe` only, since the ring shape already says it.
- `animate-ray`: the rays of the `Spinner`, lit one after another, so it turns without rotating.
- `animate-steam` and `animate-fill`: the working cup's wisps rising one after another, and the cup filling from the bottom.
- `animate-nudge`: a small shake every few seconds, for the context chip of a session that grew too big.
- `context-target`: a row held on touch sinks and darkens until its context menu opens.

## Sound

Sounds are short and synthesized with Web Audio, with no audio files: a chime when a session stops running, and a cheer for a compaction. One plays per change across open tabs. Settings → Appearance turns them off per device.

## Layout

What each screen size shows is in [layout.md](./layout.md): phone is below `md`, tablet `md` to `xl`, and wide screen from `xl`, Tailwind's default breakpoints. State lives in `client/src/ui/layout.ts`.

- Toggles sit in the page's top bar.
- Hiding or showing a column slides it (200ms, motion-safe): a hidden column is zero wide, not removed, and its content keeps its width so it moves instead of squeezing. Only the toggle animates; dragging an edge or resizing the window stays instant (`sliding` in `layout.ts`).
- Columns resize by dragging their inner edge (arrow keys when focused, double-click resets). Widths are bounded per column and by the window: the centre column always keeps 400px, and the rendered width is re-clamped when the window shrinks (`layout.ts`). Column wrappers are `shrink-0 min-w-0` and their contents `overflow-hidden`, so inner content can't push a column wider.
- Overlays have a backdrop and make `main` inert. Navigating closes them.
- Scrollbars that stay visible (a mouse, or macOS set to always show them) are a thin thumb with no track, from a base rule in `App.css`, so a panel never grows a grey gutter.
- Transcript and composer share one centered column (`chat-column`, max 720px; 12px side padding on phone).
- On phone, expanded tool output, thoughts and diffs have no height cap, wrap long lines and drop the indent: the transcript is the only scroller. Desktop caps them and scrolls inside.
- Diffs are unified on phone, split allowed on desktop.

### Context menus

Right click (or the menu key / Shift+F10, or a long press on touch) opens a menu on the thing under the pointer: a session row, a workspace header. One `ContextMenu` is mounted in `App.tsx`; any element opts in by spreading `contextMenu(() => items)` (`client/src/ui/ContextMenu.tsx`) and adding the `context-target` class (no iOS callout or text selection on long press).

- Items are read when the menu opens, so they can look at current state. An item is `{ label, icon, onSelect, danger?, disabled?, hint?, keys? }`; `'separator'` splits groups. `disabled` can be a string, shown as the reason on hover, `hint` explains the item on hover, and `keys` shows a shortcut on the right.
- It grows in from the pointer, and outside press, Esc, scroll, and resize close it. It is a manual popover, since light dismiss would close it on the right click's own pointerup.
- A long press is hard to discover, so on touch the busiest rows (sessions) also show a "⋯" `MenuButton` with the same items. Swipe actions are not used, for the same reason.
- Keep menus short and put the most common action first. Everything in a menu should also be reachable some other way, since touch and keyboard users may never open it.
- File rows are Pierre trees, which draw their own "⋯" on hover (always on touch) and open this same menu.

### Mobile checklist

- `viewport-fit=cover` and `env(safe-area-inset-*)` padding.
- `interactive-widget=resizes-content` and `100dvh`; the composer sits on the keyboard.
- Inputs at least 16px so iOS doesn't zoom.
- Touch targets at least 44px; hover styles only under `@media (hover: hover)`.
- `overscroll-behavior: contain` on scroll areas.
- Enter inserts a newline on touch devices; send with the button. On desktop, Enter sends, Shift+Enter newlines.
- `touch:` variant (`pointer: coarse`) for touch-only sizing.
- `theme-color` meta matching `bg`.

## Accessibility

- Semantic HTML first (`nav`, `main`, `aside`, `button`, `a`); ARIA only to fill gaps.
- Visible `:focus-visible` everywhere; full keyboard operation. Text fields show focus as a darker frame with a soft accent ring (`fieldFrame`), and option rows fill with `active`; everything else gets the accent outline.
- Tabs follow the ARIA tabs pattern: arrow keys move between them, and only the picked one is in the Tab order. A search field that drives a list is a combobox naming the row it's on.
- Dialogs and sheets trap focus and close on Escape (native `<dialog>` does this).
- Respect reduced motion for decorative motion. Settings → Appearance → Motion (System, Full, Reduced; per device, `client/src/ui/motion.ts`) can override the system setting, like the theme: it sets `data-motion` on `<html>`. So gate CSS with Tailwind's `motion-safe:` / `motion-reduce:` (redefined in `App.css` to follow it) and JS with `reducedMotion()`, never `prefers-reduced-motion` directly. Progress signals (spinner, `shimmer` on running work) stay on: they carry state, and the author runs macOS with reduced motion on.
- Text contrast WCAG AA in both themes; status is never color-only (pair with label or shape).

## Checking the UI

### Test data

Screens are drawn against kind data, so check them against the worst realistic data too: long names, missing fields, huge counts, non-Latin text. In development, pick one under Settings → Test data, or open any page with `?data=worst` (or `demo`, `empty`, `one`, `huge`, or `live` for real data). A switch at the bottom of the page changes it, – hides it until a reload (for screenshots), and × turns it off. It stays on for the tab across navigation and reloads.

- The test data stands in where topics are read (`useTopic`), so every screen gets it. It never reaches the server or the cache on the device.
- The whole app has test data, in `client/src/fixtures/`: the sidebar (sessions, projects, terminals, kept files), the transcripts, and the side panel (git status and files). In `demo` and `worst`, models (with list prices), providers, plan usage (limits near and at the cap), and each live test session's context have test data too (`usage.ts`), and Compact and Clean up play out on them. The other modes keep those live.
- Transcripts go through the same projection as live data, so opened rows load their details. In `demo` and `worst`, a few sessions play out live: one runs on a loop, one waits on a question, and one holds every kind of finished row.
- Demo data doubles as screenshot data: `/s/demo-shortcuts?data=demo` shows one session from prompt to reply, with its changes and diffs on the right.
- Commands are held back while it's on: they are logged to the console and never answer. Reads with test data (step details, files and diffs in the test data) answer from it; other reads go to the server.

### Debugging Solid updates

When something doesn't update, updates too often, or is slow, record what happened instead of guessing. Do the same to check that a change didn't add extra updates. The reports name signals, memos, and effects by their `{ name }` option.

- On the dev server, `diagnostics: true` in `client/vite.config.ts` turns on `/__solid/diagnostics`. It needs an open page connected to the dev server, for example through `agent-browser`.
- `GET /__solid/diagnostics` returns the status and how many pages are connected.
- `POST` it `{"method":"begin"}` and later `{"method":"end"}` to record everything in between.
- `{"method":"whyDidRun","params":{"name":"<scope name>"}}` lists each time one named signal, memo, or effect re-ran during the recording, and `{"method":"costs"}` returns the cost tables.

## References

### Skills

Emil Kowalski's design-engineering skills ([emilkowalski/skills](https://github.com/emilkowalski/skills)) set the bar for motion and polish here. Read them before motion work:

- [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md): when to animate, easing, durations, press feedback, origin-aware popovers.
- [find-animation-opportunities](https://github.com/emilkowalski/skills/blob/main/skills/find-animation-opportunities/SKILL.md): where motion helps, and the gate that rejects most candidates.
- [improve-animations](https://github.com/emilkowalski/skills/blob/main/skills/improve-animations/SKILL.md) and [review-animations](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/SKILL.md): audit and review existing motion.

The repo's `frontend-design` skill (`.agents/skills/`) covers visual direction and typography.

### Apps

Use [mobbin.com](https://mobbin.com) for real app screens and flows; its [MCP server](https://docs.mobbin.com/mcp/features) lets an agent search it. [Refero](https://refero.design) covers web and SaaS. Screenshots of other agent UIs are in [inspiration/](./inspiration/README.md).

| Area | Look at | Take |
| --- | --- | --- |
| Chat | ChatGPT, Claude, Codex, Cursor | Prose replies without bubbles, user message as a pill, composer as the hero |
| Navigation & density | Linear | Quiet sidebar, keyboard-first, subtle active states |
| Panels & diffs | Zed, Conductor, GitHub | Collapsible panes, compact file tree, readable mobile diffs |
| Polish | Raycast, v0 | Motion restraint, typography, empty states |

### Component kits

React kits whose look is close to Bica's: calm, exact motion that explains a change. Look here first when designing a new agent surface.

- [affectUI](https://www.affectui.com): components for AI products, the closest match to what Bica shows: tool calls, approvals, agent inboxes, context windows, model pickers, usage meters, toasts. Much of Bica's finish comes from it: `RollingNumber`, the gliding `Segmented` thumb, `Button loading`, the toast stack, `ThinkingLoader`, the Activity header, question cards, the context field, ⌘K, the sidebar tabs and clocks, and the workspace card. Docs for every item are in `https://www.affectui.com/llms-full.txt`, and the source of the free ones in `https://www.affectui.com/r/<name>.json`.
- [Arc](https://uiarc.dev): a wider kit, from inputs and charts to whole blocks, in the same spirit. Docs for every item are linked from `https://uiarc.dev/llms.txt`. Its [model picker](https://uiarc.dev/components/blocks/model-picker) morphs one pill to the new model's width.

How to read them:

- Each item's Motion, Accessibility, and "When not to use" notes are worth more than its props.
- Free items come with source: read their keyframes, easing, and durations. Pro items have none, but their demo pages run the real thing: open them with `agent-browser`, interact, and read computed styles and `document.getAnimations()`.
- Port the idea, never the code: they are React, Bica is Solid. Bica's tokens, radii, type roles, and motion rules win over theirs.
- Not taken: big flashy illustrations, and pills where a word does. The working state is a shimmering word, not a capsule.

### Color

- [Radix Colors, composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette): Sand is a grey on a yellow hue, paired with orange and amber accents.
- [Anthropic's palette](https://brand-atoms.com/palettes/anthropic/): an ivory canvas (`#faf9f5`), a darker ivory surface, and near-black text, all on hue 95.
- [A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh): Linear moved from cool greys to warmer ones, and warns that too warm turns muddy.
- [How we redesigned the Linear UI](https://karrisaarinen.com/posts/how-we-redesigned-the-linear-ui/): themes generated in LCH from a base, an accent, and a contrast.

Add links here as we find good references.
