// Prints the built docs site (site/dist) to one PDF for reading on paper:
// a cover, a table of contents with page numbers, then every docs page in
// sidebar order, each starting on a new sheet. Run `bun run pdf` in site/.
//
// Each page prints on its own, in the real page, so diagrams, Tabs, and the
// Solid demos render exactly as on the site. pdf-lib then merges the pages
// and stamps the running footer, since Chrome's footer can't count across
// separate prints.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const site = path.resolve(import.meta.dir, '..');
const dist = path.join(site, 'dist');
const out = path.join(site, 'dist-pdf', 'bica-docs.pdf');
const MM = 72 / 25.4;
const margin = { top: '22mm', bottom: '25mm', left: '25mm', right: '25mm' };

if (!fs.existsSync(path.join(dist, 'docs', 'index.html')))
  throw new Error('No site/dist yet: run `bun run build` in site/ first.');

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(dist)) return new Response('', { status: 403 });
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html');
    const body = Bun.file(file);
    return (await body.exists())
      ? new Response(body)
      : new Response('Not found', { status: 404 });
  },
});
const origin = `http://localhost:${server.port}`;

// Starlight keeps the theme in localStorage; paper is always light.
const browser = await chromium.launch();
const context = await browser.newContext({
  colorScheme: 'light',
  viewport: { width: 1000, height: 1400 },
});
await context.addInitScript(() =>
  localStorage.setItem('starlight-theme', 'light'),
);
const page = await context.newPage();
page.on('pageerror', (e) => console.warn(`  page error: ${e.message}`));

type Entry = { group: string; label: string; href: string; pages?: number };

// The sidebar, including collapsed groups, is in every page's HTML but the
// splash index's.
await page.goto(`${origin}/docs/start/install/`);
const entries: Entry[] = await page.$$eval(
  '#starlight__sidebar .sidebar-content a[href^="/docs/"]',
  (links) =>
    links.map((a) => {
      const group = a
        .closest('details')
        ?.querySelector(':scope > summary')
        ?.textContent?.trim();
      return {
        group: group ?? '',
        label: [a.querySelector('span'), a.querySelector('.sl-badge')]
          .map((s, i) =>
            i && s ? `(${s.textContent?.trim()})` : s?.textContent?.trim(),
          )
          .filter(Boolean)
          .join(' '),
        href: a.getAttribute('href') ?? '',
      };
    }),
);

const css = fs.readFileSync(path.join(import.meta.dir, 'pdf.css'), 'utf8');
const pdfOptions = { format: 'A4', margin, printBackground: true } as const;

async function printDocsPage(entry: Entry) {
  await page.goto(origin + entry.href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.addStyleTag({ content: css });
  await page.evaluate(preparePage, entry.href);
  // Demos mount in the browser after their chunk loads.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('bica-demo')].every(
      (d) =>
        (d.shadowRoot?.querySelector('.bica-demo')?.childElementCount ?? 0) > 0,
    ),
  );
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete),
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return page.pdf(pdfOptions);
}

// Runs in the page: show every tab, open collapsed blocks, put the URL path
// under the title, and load lazy images.
function preparePage(href: string) {
  for (const panel of document.querySelectorAll<HTMLElement>(
    '.sl-markdown-content [role="tabpanel"]',
  )) {
    panel.hidden = false;
    const tab = document.getElementById(
      panel.getAttribute('aria-labelledby') ?? '',
    );
    const label = document.createElement('p');
    label.className = 'pdf-tab-label';
    label.textContent = tab?.textContent?.trim() ?? '';
    panel.prepend(label);
  }
  for (const details of document.querySelectorAll(
    '.sl-markdown-content details',
  ))
    details.setAttribute('open', '');
  for (const img of document.images) img.loading = 'eager';
  const title = document.querySelector('h1');
  const where = document.createElement('p');
  where.className = 'pdf-path';
  where.textContent = href;
  (title?.closest('.copy') ?? title)?.after(where);
}

const printed: Uint8Array[] = [];
for (const entry of entries) {
  console.log(`printing ${entry.href}`);
  const bytes = await printDocsPage(entry);
  entry.pages = (await PDFDocument.load(bytes)).getPageCount();
  printed.push(bytes);
}

// Front matter: a cover, then the contents. The contents' own length moves
// every page number, so print it once to count its sheets, then for real.
const date = new Date().toISOString().slice(0, 10);
function frontHtml(firstDocsPage: number) {
  let n = firstDocsPage;
  let group = '';
  const rows: string[] = [];
  for (const e of entries) {
    if (e.group !== group) {
      group = e.group;
      if (group) rows.push(`<li class="group">${esc(group)}</li>`);
    }
    rows.push(
      `<li><span class="t">${esc(e.label)}</span><span class="p">${esc(e.href)}</span><span class="n">${n}</span></li>`,
    );
    n += e.pages ?? 0;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body class="pdf-front">
<section class="pdf-cover">
  <img src="${origin}/favicon.svg" alt="">
  <h1>Bica</h1>
  <p class="sub">The docs, on paper</p>
  <p class="meta">${entries.length} docs pages · printed ${date} from the docs site</p>
  <p class="meta">The margins are for your notes. Each page shows its path under the title and in the footer, so a note can point back to it.</p>
</section>
<section class="pdf-toc"><h2>Contents</h2><ol>${rows.join('')}</ol></section>
</body></html>`;
}
function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
async function printFront(firstDocsPage: number) {
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.setContent(frontHtml(firstDocsPage), { waitUntil: 'networkidle' });
  return page.pdf(pdfOptions);
}
let front = await printFront(100);
const frontPages = (await PDFDocument.load(front)).getPageCount();
front = await printFront(frontPages + 1);

await browser.close();
await server.stop();

// Merge, then stamp each sheet's footer: its page's path and the number.
const doc = await PDFDocument.create();
doc.setTitle('Bica docs');
const font = await doc.embedFont(StandardFonts.Helvetica);
const labels: string[] = [];
for (const [i, bytes] of [front, ...printed].entries()) {
  const src = await PDFDocument.load(bytes);
  const copied = await doc.copyPages(src, src.getPageIndices());
  for (const p of copied) {
    doc.addPage(p);
    labels.push(i === 0 ? '' : entries[i - 1].href);
  }
}
const grey = rgb(0.45, 0.45, 0.45);
doc.getPages().forEach((p, i) => {
  if (i === 0) return;
  const { width } = p.getSize();
  const y = 13 * MM;
  const num = String(i + 1);
  const size = 9;
  p.drawText(num, {
    x: width - 25 * MM - font.widthOfTextAtSize(num, size),
    y,
    size,
    font,
    color: grey,
  });
  if (labels[i])
    p.drawText(`Bica docs  ${labels[i]}`, {
      x: 25 * MM,
      y,
      size,
      font,
      color: grey,
    });
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await doc.save());
console.log(`${out}: ${doc.getPageCount()} pages`);
