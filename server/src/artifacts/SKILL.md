---
name: artifacts
description: Build or update an artifact, a self-contained HTML report page the user opens in Bica, with themes, Tailwind, and ECharts charts. Use when the user asks for a report, dashboard, explainer, comparison, or anything easier to see than to read, or to change an existing artifact.
---

# Artifacts

An artifact is one HTML file in Bica's artifacts folder (the system prompt names it). Bica lists it on the Artifacts page by its `<title>` and shows it full page in a sandbox, with a theme picker and light and dark. It reloads when the file changes, so write it with `write` and change it with `edit`.

## When to make one

- The answer is easier to see than to read: numbers over time, a comparison, a breakdown, a diagram.
- It's longer than a screen, or meant to be kept and updated later.
- Otherwise reply in Markdown. Don't make an artifact for a short answer.

## Finding and updating

- Each file is `<name>.html`. Pick a short kebab-case name for what the page is about, such as `q3-sales.html`, and don't reuse one that exists unless you are updating it.
- To update "the sales report", list the folder and grep the titles (`rg -i '<title>' <folder>`), then `edit` that file. Don't make a second copy.
- After writing, put the file's full path in your reply: it's a link that opens the artifact.

## The contract

Every artifact starts like this:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Q3 sales</title>
  <script src="/artifact-kit/kit.js"></script>
</head>
<body>
  ...
</body>
</html>
```

The kit line loads the theme, Tailwind (the full browser build, arbitrary values included), and ECharts, all from Bica. Nothing else needs loading: no CDNs, no other fonts, no frameworks.

- Write no colors and no fonts: no hex, `rgb()`, named colors, or `font-family`. The viewer switches themes and light or dark, and anything hard-coded won't follow.
- Plain HTML is already styled: headings, paragraphs, lists, tables, `code`, `pre`, `blockquote`, `details`, `figure`, and form controls. The body is a centred column with padding. Reach for classes only for layout and emphasis.
- A page may set `<html data-theme="paper">` to suggest a theme. The user's pick wins.
- Images inline as SVG; no remote images.

## Tokens

The same names in every theme, as CSS variables and as Tailwind colors:

| Token | Tailwind | Use |
| --- | --- | --- |
| `--bg` | `bg-bg` | the page |
| `--surface` | `bg-surface` | cards, raised panels |
| `--well` | `bg-well` | sunk areas: code, table heads, insets |
| `--fg` | `text-fg` | text |
| `--muted` | `text-muted` | secondary text, labels, captions |
| `--line` | `border-line` | borders and rules |
| `--accent`, `--accent-fg` | `text-accent`, `bg-accent text-accent-fg` | links, the one thing to notice |
| `--success`, `--warn`, `--danger`, `--info` | `text-success`, `bg-danger/10` | status, deltas |
| `--chart-1` … `--chart-6` | `bg-chart-1` | legend swatches matching charts |

Also `font-sans`, `font-heading`, `font-mono`, and `rounded-card` (the theme's radius). Tailwind's palette is removed, so `bg-blue-500` or `text-white` do nothing. Tints use opacity: `bg-accent/10`, `border-danger/30`. `dark:` follows the viewer's light or dark, but the tokens already change, so you rarely need it. In your own CSS, use `var(--accent)`.

A card: `<div class="rounded-card border border-line bg-surface p-5">`. A stat: a `text-muted text-sm` label over a `text-3xl font-semibold` number, with a delta in `text-success` or `text-danger`.

## Charts

ECharts is loaded as `echarts`. Call `echarts.init(el)` with no theme: the kit gives it one made from the current theme's tokens, and recolors the chart when the theme or light/dark changes. Charts also resize with their box.

```html
<div id="revenue" class="h-72"></div>
...
<script>
  echarts.init(document.getElementById('revenue')).setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [120, 132, 101] }],
  });
</script>
```

- Give each chart's box a height (`h-64`, `h-80`), or it draws nothing.
- Never set `color`, `backgroundColor`, `textStyle` colors, or a theme name: series take `--chart-1` onward in order. To tie a series to meaning, read a token: `kit.token('danger')`.
- Keep options lean: `tooltip`, a `legend` only with more than one series, `grid: { containLabel: true }` when labels are long.
- A page that draws its own canvas or SVG with token colors can listen for the `kit:theme` event on `window` to redraw.

## Page patterns

- Summary first: the title, one or two sentences on what this shows, then the headline numbers or the conclusion. Details follow.
- Sections with `h2`, each answering one question. A long page gets a short list of links to its sections at the top.
- Tables over prose for anything with columns. Numbers right-aligned (`class="num"` on `th` and `td`) and formatted (`1,204`, `12.5%`).
- Grids for cards and charts: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. It must read on a phone, so start with one column.
- Diagrams as inline SVG, colored with token classes (`fill-surface stroke-line`, `fill-accent`) or `style="fill: var(--accent)"`.
- Say where the data came from and when, in a `small` or a `footer`.

## Scripts

- Scripts go last, at the end of `<body>`, after the elements they use.
- Data the page needs is inline, as a `const` in the script. There is no network: the page runs sandboxed, and the export works offline.
- No `localStorage` or cookies: the sandbox has none.
