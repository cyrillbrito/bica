# Color themes

Picking Bica's colors from well-known editor themes. Not built. Today `packages/client/src/App.css` holds one hand-written light palette and one dark one.

## Why

- The dark palette is close to black. Softer ones exist: GitHub Dark Dimmed, Rosé Pine Moon, Catppuccin Frappé.
- A theme you already use in VS Code or the terminal makes Bica match your setup.
- One choice colors the app, the code and diff highlighting, and the terminal, which today are three separate sets.

## Settings

Per device: a light theme, a dark theme, and Appearance (System, Light, Dark) picking between them, the way Ghostty's `theme = light:X,dark:Y` works. Bica's own palette stays the default in both lists.

## Source of the themes

VS Code themes, from the copies Shiki ships in `@shikijs/themes`, installed with Pierre. A VS Code theme names colors for backgrounds, sidebar, borders, list hover and selection, focus, buttons, and the 16 terminal colors, so every Bica token can come from the theme by role:

- Backgrounds from the editor, sidebar, and widget colors; lines from borders; text and muted text from the foregrounds.
- Hover and selected rows from the list colors, or mixed from background and text when missing.
- The accent from focus or button; running, warning, danger, and merged from the terminal's green, yellow, red, and magenta.

Terminal schemes (iTerm2, Ghostty) have no grays for panels and borders, and Base16 has fewer roles, so both were left out.

## Rules

- Diffs stay blue and orange, the colorblind palette (`.code-view` in `App.css`).
- Status colors and muted text keep AA contrast on the theme's background, adjusted toward the text color if not.
- A short tested list, not every theme: each one checked on the session, project, settings, and phone screens. A start: GitHub, Catppuccin, Rosé Pine, Gruvbox, Everforest, Solarized, Kanagawa, Tokyo Night, Nord, One Dark and One Light.

## Open questions

- The chosen theme must apply before first paint. Load all themes up front, or one?
- Does Bica orange override the theme's accent?
