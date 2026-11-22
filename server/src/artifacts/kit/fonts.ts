// The app's own font files, imported as paths so the `bica` binary embeds
// them, and served to artifacts by name (fonts.css).
import mono from '../../../../client/public/fonts/AtkinsonHyperlegibleMono-latin.woff2' with { type: 'file' };
import monoExt from '../../../../client/public/fonts/AtkinsonHyperlegibleMono-latin-ext.woff2' with { type: 'file' };
import next from '../../../../client/public/fonts/AtkinsonHyperlegibleNext-latin.woff2' with { type: 'file' };
import nextExt from '../../../../client/public/fonts/AtkinsonHyperlegibleNext-latin-ext.woff2' with { type: 'file' };
import libron from '../../../../client/public/fonts/Libron-Regular.woff2' with { type: 'file' };
import libronItalic from '../../../../client/public/fonts/Libron-Italic.woff2' with { type: 'file' };
import libronBold from '../../../../client/public/fonts/Libron-Bold.woff2' with { type: 'file' };
import libronBoldItalic from '../../../../client/public/fonts/Libron-BoldItalic.woff2' with { type: 'file' };

export const FONTS: Record<string, string> = {
  'AtkinsonHyperlegibleMono-latin.woff2': mono,
  'AtkinsonHyperlegibleMono-latin-ext.woff2': monoExt,
  'AtkinsonHyperlegibleNext-latin.woff2': next,
  'AtkinsonHyperlegibleNext-latin-ext.woff2': nextExt,
  'Libron-Regular.woff2': libron,
  'Libron-Italic.woff2': libronItalic,
  'Libron-Bold.woff2': libronBold,
  'Libron-BoldItalic.woff2': libronBoldItalic,
};
