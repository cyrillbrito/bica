import { memo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Enough Markdown for the fixtures: paragraphs, lists, fenced code, headings,
// and inline code, bold, and links. The real app uses a full parser.

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'code'; lang: string; text: string };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```'))
        body.push(lines[i++]!);
      i++;
      blocks.push({ kind: 'code', lang, text: body.join('\n') });
    } else if (/^#{1,4} /.test(line)) {
      blocks.push({ kind: 'h', text: line.replace(/^#+ /, '') });
      i++;
    } else if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i]!))
        items.push(lines[i++]!.replace(/^(- |\d+\. )/, ''));
      blocks.push({ kind: ordered ? 'ol' : 'ul', items });
    } else if (line.trim()) {
      const text: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim() &&
        !/^(```|- |\d+\. |#)/.test(lines[i]!)
      )
        text.push(lines[i++]!);
      blocks.push({ kind: 'p', text: text.join(' ') });
    } else i++;
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('`'))
      out.push(
        <code
          key={m.index}
          className="rounded-md bg-background-tertiary-default px-1 py-px font-mono text-[0.9em] text-text-primary"
        >
          {t.slice(1, -1)}
        </code>,
      );
    else if (t.startsWith('**'))
      out.push(
        <strong key={m.index} className="font-semibold text-text-primary">
          {t.slice(2, -2)}
        </strong>,
      );
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      out.push(
        <a
          key={m.index}
          href={href}
          className="text-accent-600 underline dark:text-accent-400"
        >
          {label}
        </a>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h':
      return (
        <h3 className="text-headline-semibold text-text-primary">
          {inline(block.text)}
        </h3>
      );
    case 'p':
      return (
        <p className="text-body-regular text-text-primary">
          {inline(block.text)}
        </p>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-2xl border border-border-button-default bg-well p-3 font-mono text-[13px] leading-5 text-text-primary">
          <code>{block.text}</code>
        </pre>
      );
    default: {
      const List = block.kind;
      return (
        <List
          className={
            List === 'ol'
              ? 'flex list-decimal flex-col gap-1.5 ps-5 text-body-regular text-text-primary marker:text-text-tertiary'
              : 'flex list-disc flex-col gap-1.5 ps-5 text-body-regular text-text-primary marker:text-text-tertiary'
          }
        >
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </List>
      );
    }
  }
}

const HIDDEN = { opacity: 0, filter: 'blur(5px)', y: 4 };
const SHOWN = { opacity: 1, filter: 'blur(0px)', y: 0 };
const EASE = { duration: 0.42, ease: [0.22, 0.61, 0.36, 1] } as const;

// Each block softens in once as it first appears, as BoardUI's StreamedText
// does for lines, then only grows.
const Animated = memo(function Animated({
  block,
  animate,
}: {
  block: Block;
  animate: boolean;
}) {
  return (
    <motion.div
      initial={animate ? HIDDEN : false}
      animate={SHOWN}
      transition={EASE}
    >
      <BlockView block={block} />
    </motion.div>
  );
});

export function Markdown({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-3">
      {parse(text).map((block, i) => (
        <Animated key={i} block={block} animate={streaming && !reduce} />
      ))}
    </div>
  );
}
