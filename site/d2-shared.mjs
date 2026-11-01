import fs from 'node:fs';

// Fixes around astro-d2, so list this integration after `d2()`:
// - D2.js compiles each fence alone, so `@import` can't reach a shared file.
//   This puts src/d2/shared.d2 in front of every d2 fence before astro-d2 runs.
// - D2's dark theme sits in a `prefers-color-scheme` media query, which ignores
//   Starlight's theme picker. This moves those rules under `[data-theme='dark']`.
// - The outer svg has no size, so a narrow diagram stretched to the page width.
//   It gets its natural size; Starlight's CSS only shrinks it on narrow screens.
// - On a phone, shrinking a wide diagram to the column made its text
//   unreadable. It goes in a box that scrolls sideways, and src/styles/d2.css
//   stops it shrinking below `--d2-min`, a share of its natural width.
export default function d2Shared() {
  return {
    name: 'd2-shared',
    hooks: {
      'astro:config:setup': ({ config }) => {
        const prelude = fs.readFileSync(
          new URL('./src/d2/shared.d2', import.meta.url),
          'utf8',
        );
        const plugins = config.markdown.processor.options.mdastPlugins;
        plugins.unshift(() => ({
          name: 'd2-shared-classes',
          code(node, ctx) {
            if (node.lang !== 'd2' || node.value.startsWith(prelude)) return;
            ctx.replaceNode(node, {
              ...node,
              value: `${prelude}\n${node.value}`,
            });
          },
        }));
        plugins.push(() => ({
          name: 'd2-svg-fixes',
          html(node, ctx) {
            if (!node.value.includes(D2_SVG)) return;
            ctx.replaceNode(node, { ...node, value: fixSvg(node.value) });
          },
          mdxJsxFlowElement(node, ctx) {
            const html = node.attributes?.find((a) => a.name === 'set:html');
            if (typeof html?.value !== 'string' || !html.value.includes(D2_SVG))
              return;
            const attributes = node.attributes.map((a) =>
              a === html ? { ...a, value: fixSvg(a.value) } : a,
            );
            ctx.replaceNode(node, { ...node, attributes });
          },
        }));
      },
    },
  };
}

const D2_SVG = 'data-d2-version=';
// Below this share of its natural size, a diagram's 16px labels get too small
// to read, so a phone scrolls instead.
const MIN_SCALE = 0.7;
const MEDIA = '@media screen and (prefers-color-scheme:dark){';

function fixSvg(svg) {
  const sized = svg.replace(/<svg\b[^>]*data-d2-version=[^>]*>/, (tag) => {
    const box = /viewBox="0 0 (\d+) (\d+)"/i.exec(tag);
    if (!box || / width=/.test(tag)) return tag;
    return tag.replace('<svg', `<svg width="${box[1]}" height="${box[2]}"`);
  });
  const tag = /<svg\b[^>]*data-d2-version=[^>]*>/.exec(sized)?.[0] ?? '';
  const width = Number(/ width="(\d+)"/.exec(tag)?.[1] ?? 0);
  const min = Math.round(width * MIN_SCALE);
  return `<div class="d2-scroll" style="--d2-min:${min}px">${followTheme(sized)}</div>`;
}

function followTheme(svg) {
  let out = svg;
  let start = out.indexOf(MEDIA);
  while (start !== -1) {
    let depth = 1;
    let end = start + MEDIA.length;
    while (depth > 0 && end < out.length) {
      if (out[end] === '{') depth++;
      else if (out[end] === '}') depth--;
      end++;
    }
    const body = out.slice(start + MEDIA.length, end - 1);
    const rules = body.replace(/(^|})\s*([^{}]+)\{/g, (_, close, selectors) => {
      const scoped = selectors
        .split(',')
        .map((s) => `:root[data-theme='dark'] ${s.trim()}`)
        .join(',');
      return `${close}${scoped}{`;
    });
    out = out.slice(0, start) + rules + out.slice(end);
    start = out.indexOf(MEDIA, start + rules.length);
  }
  return out;
}
