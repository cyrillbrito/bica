import { createMemo, lazy } from 'solid-js';

import { errorText } from '../ui/errors';

let count = 0;

// Mermaid derives shades from real colors, so the tokens are resolved first:
// a probe reads each `light-dark()` as the current scheme paints it.
function token(name: string) {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${name})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function themeVariables() {
  const surface = token('surface');
  const fg = token('fg');
  const bg = token('bg');
  return {
    // The Settings theme can override the system's, so ask the page.
    darkMode: Number(/\d+/.exec(bg)?.[0]) < 128,
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: '14px',
    background: bg,
    primaryColor: surface,
    primaryTextColor: fg,
    primaryBorderColor: token('muted'),
    secondaryColor: token('panel'),
    tertiaryColor: token('panel'),
    lineColor: token('muted'),
    textColor: fg,
    edgeLabelBackground: bg,
    clusterBkg: token('panel'),
    clusterBorder: token('line-strong'),
    noteBkgColor: token('panel'),
    noteTextColor: fg,
    noteBorderColor: token('line-strong'),
  };
}

/** A Mermaid diagram as SVG, used by `.mmd` files and ```mermaid blocks. */
// Loaded on first use: mermaid is large and most pages never need it.
const Mermaid = lazy(async () => {
  const { default: mermaid } = await import('mermaid');
  return {
    default: (props: { text: string; class?: string }) => {
      const svg = createMemo(
        async () => {
          const text = props.text;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: themeVariables(),
            // A sketch reads as an explanation, not a spec. A fixed seed
            // draws the same strokes each time.
            look: 'handDrawn',
            handDrawnSeed: 1,
            // Otherwise a failed diagram leaves its error graphic in <body>.
            suppressErrorRendering: true,
          });
          try {
            return (await mermaid.render(`mermaid-${++count}`, text)).svg;
          } catch (error) {
            // The source stays readable, and the error says what to ask for.
            const box = document.createElement('div');
            box.className = 'w-full';
            const pre = document.createElement('pre');
            pre.append(document.createElement('code'));
            pre.firstChild!.textContent = text;
            const why = document.createElement('p');
            why.className = 'font-ui text-meta text-muted';
            const reason = errorText(error).split('\n')[0]!.replace(/:$/, '');
            why.textContent = `Diagram didn't render: ${reason}.`;
            box.append(pre, why);
            return box.outerHTML;
          }
        },
        { name: 'mermaidSvg' },
      );
      return (
        <div
          class={[
            'flex justify-center [&_svg]:h-auto [&_svg]:max-w-full',
            props.class,
          ]}
          // Mermaid's strict security level sanitizes labels in the SVG.
          // eslint-disable-next-line solid/no-innerhtml
          innerHTML={svg()}
        />
      );
    },
  };
});

export default Mermaid;
