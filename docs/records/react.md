# React for the UI

November 2026. Decision: Bica's UI moves from Solid to React, built on BoardUI's design system. The Solid app in `packages/client` stays until the React one in `packages/web` can replace it.

## The problem

Solid's principles fit Bica well: components run once, and updates reach only the parts that read them. But every design system and component library worth borrowing from targets React. Bica's own components were written by hand to close that gap, and each new screen meant designing its parts from scratch.

## What we tried

A throwaway prototype ported BoardUI's free tier to Solid 2: its tokens and type scale unchanged, its base components, the Sidebar, Stat Cards, and Settings Modal blocks, and a mock Bica screen with a scripted streaming turn. It used BoardUI at commit `ec5c5eb`.

- The design held up. BoardUI looked polished in light and dark, with the same tokens behind both.
- It is less dense than Bica: 36px rows, 24px corners, a blue accent, and Inter.
- Most of the porting work was React Aria, which has no Solid counterpart. Select, Dropdown, and Tooltip became the native `popover` attribute, the modal a `<dialog>`, and Checkbox and Switch hidden inputs. Keyboard handling and focus had to be redone by hand, and every React Aria update would need porting again.
- Framer Motion's exit animations had no direct replacement, so they became CSS transitions and `@starting-style`.

## The decision

Go all in on React and BoardUI.

- BoardUI's components are copied into the package as source, the way its CLI installs them, so Bica owns them and can change anything. Only the free MIT tier is used.
- React Aria and Motion come with them unchanged, so the friction the port hit disappears.
- BoardUI's layouts, tokens, and spacing win over Bica's current ones, even where that changes Bica's layout. `docs/UI.md` keeps describing the Solid app until it is replaced.
- The first step is `packages/web`: the whole UI as a front-end mock on fake data, with routing and no server. Wiring it to the socket comes after.

Reopen this only if React's rendering cost shows on long sessions on the phone and can't be fixed with memoisation or virtualisation.

## Sources

- [BoardUI](https://www.boardui.com), free tier at [github.com/BoardUI/boardui](https://github.com/BoardUI/boardui), MIT.
- [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), which BoardUI builds on.
- The Solid port prototype, in the `boardui-solid-port-prototype` worktree under `prototypes/boardui-solid`.
