import { render, type JSX } from '@solidjs/web';
import css from './demo.css?inline';

// One sheet for every demo on the page. `:root` rules (motion variants,
// tokens) match nothing in a shadow tree, so they target the host.
let sheet: CSSStyleSheet | undefined;
function demoSheet() {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css.replaceAll(':root', ':host'));
    // Browsers ignore @font-face and @property in shadow roots, so those go
    // on the page: the fonts (public/fonts links to the app's), and the
    // starting values of Tailwind's borders, rings, and transforms.
    const page = new CSSStyleSheet();
    page.replaceSync(
      (css.match(/@(font-face|property)[^{]*\{[^}]*\}/g) ?? []).join('\n'),
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, page];
  }
  return sheet;
}

/** Renders a real client component into `host`, styled by App.css in a shadow root. */
export function mount(host: HTMLElement, view: () => JSX.Element) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.adoptedStyleSheets = [demoSheet()];
  const root = document.createElement('div');
  root.className = 'bica-demo';
  shadow.replaceChildren(root);
  return render(view, root);
}
