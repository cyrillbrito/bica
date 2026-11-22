/**
 * Reads the YAML that frontmatter uses: `key: value` maps nested by indent,
 * `- item` and `[a, b]` lists, quoted strings, `|` and `>` blocks, numbers,
 * booleans, and null. Anchors, tags, and multi-line flow lists aren't
 * frontmatter's YAML: they throw, and the caller shows the text as written.
 */
export function parseFrontmatter(yaml: string): unknown {
  const lines: Line[] = [];
  for (const raw of yaml.split(/\r?\n/)) {
    const text = raw.trim();
    if (text && !text.startsWith('#'))
      lines.push({ indent: raw.length - raw.trimStart().length, text });
  }
  if (lines.length === 0) return null;
  const [value, next] = block(lines, 0);
  if (next < lines.length) throw new Error(`Unexpected "${lines[next]!.text}"`);
  return value;
}

type Line = { indent: number; text: string };

const KEY =
  /^("[^"]*"|'[^']*'|[^\s"'#[{-][^:]*?|-[^\s:][^:]*?)\s*:(?:\s+(.*))?$/;
function isItem(line?: Line) {
  return !!line && /^-(\s|$)/.test(line.text);
}

function block(lines: Line[], i: number): [unknown, number] {
  return isItem(lines[i]) ? list(lines, i) : map(lines, i);
}

function list(lines: Line[], i: number): [unknown[], number] {
  const indent = lines[i]!.indent;
  const items: unknown[] = [];
  while (lines[i]?.indent === indent && isItem(lines[i])) {
    const rest = lines[i]!.text.slice(1).trim();
    if (!rest) {
      const deeper = (lines[i + 1]?.indent ?? -1) > indent;
      const [value, next] = deeper ? block(lines, i + 1) : [null, i + 1];
      items.push(value);
      i = next;
    } else if (KEY.test(rest) || isItem({ indent, text: rest })) {
      // `- name: one` starts a map, and `- - a` a list, lined up after the dash.
      const offset = lines[i]!.text.indexOf(rest);
      const copy = [...lines];
      copy[i] = { indent: indent + offset, text: rest };
      const [value, next] = block(copy, i);
      items.push(value);
      i = next;
    } else {
      items.push(scalar(rest));
      i++;
    }
  }
  return [items, i];
}

function map(lines: Line[], i: number): [Record<string, unknown>, number] {
  const indent = lines[i]!.indent;
  const object: Record<string, unknown> = {};
  while (lines[i]?.indent === indent) {
    const found = KEY.exec(lines[i]!.text);
    if (!found) throw new Error(`Not a key: "${lines[i]!.text}"`);
    const key = unquote(found[1]!);
    const rest = found[2]?.trim() ?? '';
    i++;
    if (rest === '|' || rest === '>' || /^[|>][-+]$/.test(rest)) {
      const text: string[] = [];
      while ((lines[i]?.indent ?? -1) > indent) text.push(lines[i++]!.text);
      object[key] = text.join(rest.startsWith('|') ? '\n' : ' ');
    } else if (rest) {
      object[key] = scalar(rest);
    } else if ((lines[i]?.indent ?? -1) > indent) {
      [object[key], i] = block(lines, i);
    } else if (lines[i]?.indent === indent && isItem(lines[i])) {
      // A list may sit at its key's own indent.
      [object[key], i] = list(lines, i);
    } else {
      object[key] = null;
    }
  }
  return [object, i];
}

function unquote(text: string): string {
  if (text.startsWith('"')) return JSON.parse(text) as string;
  if (text.startsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
  return text;
}

function scalar(text: string): unknown {
  if (/^["']/.test(text)) {
    const quote = text[0]!;
    const end = text.lastIndexOf(quote);
    if (end === 0) throw new Error(`Unclosed quote: ${text}`);
    return unquote(text.slice(0, end + 1));
  }
  const value = text.replace(/\s+#.*$/, '');
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new Error(`Unclosed list: ${value}`);
    const inner = value.slice(1, -1).trim();
    return inner ? split(inner).map(scalar) : [];
  }
  if (value === '{}') return {};
  if (/^[&*!{]/.test(value)) throw new Error(`Unsupported: ${value}`);
  if (value === 'true' || value === 'false') return value === 'true';
  if (value === 'null' || value === '~') return null;
  if (/^[-+]?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

// Commas inside quotes stay in their item.
function split(text: string): string[] {
  return (text.match(/"[^"]*"|'[^']*'|[^,]+/g) ?? [])
    .map((part) => part.trim())
    .filter(Boolean);
}
