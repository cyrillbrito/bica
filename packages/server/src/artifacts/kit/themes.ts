import bica from './themes/bica.css' with { type: 'text' };
import dashboard from './themes/dashboard.css' with { type: 'text' };
import paper from './themes/paper.css' with { type: 'text' };

/**
 * The artifact themes, in the order the viewer lists them; the first is the
 * default. A theme is one CSS file in themes/ that sets every token for
 * light and dark under its `data-theme`, plus its line here.
 */
export const THEMES = [
  { id: 'bica', label: 'Bica', css: bica },
  { id: 'paper', label: 'Paper', css: paper },
  { id: 'dashboard', label: 'Dashboard', css: dashboard },
];
