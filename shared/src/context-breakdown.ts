// What fills the context, for the context details (docs/context-usage.md).
//
// Like Pi's context extensions: count each part's characters, then scale all
// parts to the size the provider measured (context-usage.ts).
import type { Message, ToolCall } from '@earendil-works/pi-ai';
import { calculateContextTokens } from '@earendil-works/pi-ai/utils/estimate';

import type { ModelContext } from './context-usage';
import { CompactionEntry } from './pi-types';

export type Group = 'system' | 'tools' | 'conversation';

export interface Part {
  key: string;
  label: string;
  group: Group;
  tokens: number;
  /** A second line, e.g. which skills are loaded. */
  detail?: string;
}

/** One large piece of the conversation; `target` finds its transcript row. */
export interface Item {
  label: string;
  detail: string;
  tokens: number;
  target: { call: string } | { key: string };
}

export interface ContextBreakdown {
  /** Largest first within each group; they add up to the size in use. */
  parts: Part[];
  biggest: Item[];
  /**
   * Answers after the first that rewrote most of their context: the cache had
   * expired or the prefix changed.
   */
  misses: number;
}

export const GROUPS: Group[] = ['system', 'tools', 'conversation'];

// pi-ai counts an image as this many characters.
const IMAGE_CHARS = 4800;

export function contextBreakdown(
  ctx: ModelContext,
  used: number,
): ContextBreakdown {
  // Characters until the end, then scaled to tokens.
  const parts = new Map<string, Part>();
  const add = (key: string, label: string, group: Group, chars: number) => {
    if (chars <= 0) return;
    const part = parts.get(key);
    if (part) part.tokens += chars;
    else parts.set(key, { key, label, group, tokens: chars });
  };
  const items: Item[] = [];
  const calls = new Map<string, ToolCall>();
  const marker = ctx.entries[0]?.head !== undefined ? ctx.entries[0].id : -1;
  let answers = 0;
  let misses = 0;

  ctx.entries.forEach((entry, i) =>
    ctx.contributions[i]!.forEach((message, mi) => {
      count(message, entry.kind, `${entry.id}:${mi}`);
      if (message.role !== 'assistant' || entry.id <= marker) return;
      if (calculateContextTokens(message.usage) <= 0) return;
      const { input, cacheRead, cacheWrite } = message.usage;
      if (answers++ > 0 && cacheWrite + input > cacheRead) misses++;
    }),
  );

  function count(message: Message, kind: string, key: string) {
    if (message.role === 'system') {
      add('system', 'Base prompt', 'system', textLength(message.content));
      for (const [name, text] of Object.entries(message.sections ?? {})) {
        if (text) section(name, text);
      }
      for (const tool of message.toolsAdded ?? [])
        add(
          `tool:${tool.name}`,
          tool.name,
          'tools',
          JSON.stringify(tool).length,
        );
      return;
    }
    if (message.role === 'user') {
      const summary = kind === CompactionEntry.kind;
      const content = message.content;
      const text =
        typeof content === 'string' ? content.length : textLength(content);
      const images =
        typeof content === 'string'
          ? 0
          : content.filter((b) => b.type === 'image').length;
      add(
        summary ? 'summary' : 'prompts',
        summary ? 'Compaction summary' : 'Prompts',
        'conversation',
        text,
      );
      add('images', 'Images', 'conversation', images * IMAGE_CHARS);
      if (!summary)
        items.push({
          label: images ? 'Prompt with images' : 'Prompt',
          detail: firstLine(typeof content === 'string' ? content : ''),
          tokens: text + images * IMAGE_CHARS,
          target: { key },
        });
      return;
    }
    if (message.role === 'assistant') {
      message.content.forEach((block, bi) => {
        if (block.type === 'text') {
          add('replies', 'Replies', 'conversation', block.text.length);
          items.push({
            label: 'Reply',
            detail: firstLine(block.text),
            tokens: block.text.length,
            target: { key: `${key}:${bi}` },
          });
        } else if (block.type === 'thinking')
          add('thinking', 'Thinking', 'conversation', block.thinking.length);
        else if (block.type === 'toolCall') {
          calls.set(block.id, block);
          add(
            'calls',
            'Tool calls',
            'conversation',
            block.name.length + JSON.stringify(block.arguments).length,
          );
        }
      });
      return;
    }
    if (message.role === 'toolResult') {
      const chars = message.content.reduce(
        (n, b) => n + (b.type === 'text' ? b.text.length : IMAGE_CHARS),
        0,
      );
      add(
        `result:${message.toolName}`,
        `${message.toolName} results`,
        'conversation',
        chars,
      );
      const args = calls.get(message.toolCallId)?.arguments ?? {};
      items.push({
        label: message.toolName,
        detail: describe(args),
        tokens: chars,
        target: { call: message.toolCallId },
      });
    }
  }

  // AGENTS.md, memory, and skills get their own lines, the skills by name
  // so it's easy to see which loaded; the rest of the prompt is one line.
  // Section keys are those in server/src/agents/common.ts.
  function section(name: string, text: string) {
    const file = /path="[^"]*?([^/"]+)"/.exec(text)?.[1];
    if (name === 'project_context')
      add('project', file ?? 'Project file', 'system', text.length);
    else if (name === 'memory')
      add('memory', file ?? 'Memory', 'system', text.length);
    else if (name === 'skills') {
      const names = [...text.matchAll(/<name>([^<]*)<\/name>/g)].map(
        (m) => m[1],
      );
      add('skills', `Skills (${names.length})`, 'system', text.length);
      parts.get('skills')!.detail = names.join(', ');
    } else add('instructions', 'Instructions', 'system', text.length);
  }

  // The scale also covers what we can't see: the provider's own preamble,
  // message framing, and the real tokenizer.
  let chars = 0;
  for (const p of parts.values()) chars += p.tokens;
  const scale = chars > 0 ? used / chars : 0;
  for (const part of parts.values()) part.tokens *= scale;
  for (const item of items) item.tokens *= scale;

  return {
    parts: [...parts.values()].sort(
      (a, b) =>
        GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) ||
        b.tokens - a.tokens,
    ),
    biggest: items.sort((a, b) => b.tokens - a.tokens).slice(0, 6),
    misses,
  };
}

function textLength(
  content: string | readonly { type: string; text?: string }[],
) {
  return typeof content === 'string'
    ? content.length
    : content.reduce((n, b) => n + (b.text?.length ?? 0), 0);
}

function firstLine(text: string) {
  return text.trim().split('\n')[0]!.slice(0, 120);
}

// The coding tools' summary, or the argument that names the target.
function describe(args: Record<string, unknown>) {
  for (const key of ['summary', 'path', 'command', 'url', 'query']) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return firstLine(value);
  }
  return '';
}
