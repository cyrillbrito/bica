import type { Extension, ToolRegistration } from '@earendil-works/pi-durable';

const listeners = new Set<(cwd: string) => void>();

/**
 * Calls `fn` with the folder of every tool call that finishes, however it
 * ends, so views of that folder can look again at once instead of at their
 * next poll. Returns the unsubscribe.
 */
export function onToolRan(fn: (cwd: string) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function announceRuns(extension: Extension): Extension {
  return { ...extension, tools: extension.tools?.map(announced) };
}

function announced(tool: ToolRegistration): ToolRegistration {
  return {
    ...tool,
    execute: async (args, api, context) => {
      try {
        return await tool.execute(args, api, context);
      } finally {
        const cwd = api.env?.cwd;
        if (cwd) for (const fn of listeners) fn(cwd);
      }
    },
  };
}
