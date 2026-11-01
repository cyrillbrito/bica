// Checks every internal link and anchor in the built site (site/dist).
// Run after `bun run --filter @bica/site build`: bun site/scripts/check-links.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const ids = new Map();
function idsOf(file) {
  if (!ids.has(file)) {
    const html = readFileSync(file, 'utf8');
    ids.set(
      file,
      new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
    );
  }
  return ids.get(file);
}

let broken = 0;
let checked = 0;
for (const file of pages(dist)) {
  const html = readFileSync(file, 'utf8');
  const from = '/' + file.slice(dist.length).replace(/index\.html$/, '');
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(href)) continue;
    checked++;
    const [path, hash] = href.split('#');
    if (path && !path.startsWith('/')) continue;
    if (/\.(css|js|svg|png|webp|ico|xml|json|txt)$/.test(path)) continue;
    const target = path
      ? join(dist, path, path.endsWith('/') ? 'index.html' : '')
      : file;
    if (!existsSync(target)) {
      console.log(`${from}: missing page ${href}`);
      broken++;
    } else if (hash && !idsOf(target).has(decodeURIComponent(hash))) {
      console.log(`${from}: missing anchor ${href}`);
      broken++;
    }
  }
}
console.log(
  broken
    ? `${broken} of ${checked} links broken`
    : `all ${checked} links resolve`,
);
process.exit(broken ? 1 : 0);
