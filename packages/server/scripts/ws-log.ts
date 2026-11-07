// Summarizes ~/.bica/ws-log.jsonl: where the bytes go, by topic and by path.
// bun packages/server/scripts/ws-log.ts [file] [--top N]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const topAt = args.indexOf('--top');
const top = topAt >= 0 ? Number(args[topAt + 1]) : 10;
const file =
  args.find((a, i) => !a.startsWith('--') && i !== topAt + 1) ??
  join(homedir(), '.bica', 'ws-log.jsonl');

type Line = {
  t: number;
  c: number;
  dir: 'in' | 'out';
  bytes: number;
  msg: any;
};
const lines: Line[] = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
if (!lines.length) throw new Error(`${file} is empty`);

const topics = new Map<string, string>();
function topicOf(l: Line) {
  const m = l.msg;
  if (m.type === 'subscribe') topics.set(`${l.c}:${m.sub}`, m.topic);
  if (m.type === 'request') return `call ${m.call}`;
  if (m.type === 'reply') return 'reply';
  return m.sub != null ? (topics.get(`${l.c}:${m.sub}`) ?? '?') : '?';
}

function add(
  map: Map<string, { n: number; bytes: number }>,
  key: string,
  bytes: number,
) {
  const row = map.get(key) ?? { n: 0, bytes: 0 };
  row.n++;
  row.bytes += bytes;
  map.set(key, row);
}

const byKind = new Map<string, { n: number; bytes: number }>();
const byPath = new Map<string, { n: number; bytes: number }>();
const replies = new Map<string, string>();
const rows: { l: Line; label: string }[] = [];

for (const l of lines) {
  let topic = topicOf(l);
  if (l.msg.type === 'request') replies.set(l.msg.id, l.msg.call);
  if (l.msg.type === 'reply') topic = `reply ${replies.get(l.msg.id) ?? '?'}`;
  const label = `${l.dir} ${l.msg.type} ${topic}`;
  add(byKind, label, l.bytes);
  rows.push({ l, label });
  if (l.msg.type === 'changes')
    for (const op of l.msg.ops) {
      // The first two path keys, with array indexes collapsed, say what changed.
      const path = (op[1] as unknown[])
        .slice(0, 3)
        .map((k) => (typeof k === 'number' ? '#' : k))
        .join('.');
      add(byPath, `${topic} ${op[0]} ${path}`, JSON.stringify(op).length);
    }
}

function kb(b: number) {
  return (b / 1024).toFixed(1).padStart(8) + ' KB';
}
function table(title: string, map: Map<string, { n: number; bytes: number }>) {
  console.log(`\n${title}`);
  for (const [key, { n, bytes }] of [...map]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, top))
    console.log(`${kb(bytes)} ${String(n).padStart(6)}x  ${key}`);
}

const total = lines.reduce((s, l) => s + l.bytes, 0);
const secs = (lines.at(-1)!.t - lines[0]!.t) / 1000;
console.log(
  `${lines.length} messages, ${kb(total).trim()} over ${secs.toFixed(0)} s, ${new Set(lines.map((l) => l.c)).size} connections`,
);
table('By message type and topic', byKind);
table('Changes by op and path', byPath);
console.log('\nLargest messages');
for (const { l, label } of rows
  .sort((a, b) => b.l.bytes - a.l.bytes)
  .slice(0, top))
  console.log(
    `${kb(l.bytes)}  ${new Date(l.t).toLocaleTimeString()}  ${label}`,
  );
