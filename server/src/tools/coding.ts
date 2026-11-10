import { isAbsolute, relative, resolve } from 'node:path';
import type { JsonValue } from '@earendil-works/chord';
import { defineExtension } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import {
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
} from '@earendil-works/pi-durable/tools';
import { bunImages } from './fit-image';

/** Whether `path` lies inside `cwd`; the edit tools strip a leading @. */
function ownsPath(cwd: string, path: string) {
  const rel = relative(cwd, resolve(cwd, path.replace(/^@/, '')));
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
}

/** The hub writes only its own memory files (docs/hub.md). */
function ownFolder<P extends object, D extends JsonValue>(
  tool: ToolRegistration<P, D>,
): ToolRegistration<P, D> {
  return {
    ...tool,
    description: `${tool.description} Only inside your own folder.`,
    execute: (args, api, context) => {
      const cwd = api.env?.cwd;
      // Only given to write and edit, whose schemas require a path.
      if (!cwd || !ownsPath(cwd, (args as { path: string }).path))
        throw new Error(
          `You can only change files inside your folder, ${cwd}. Hand other changes to a session.`,
        );
      return tool.execute(args, api, context);
    },
  };
}

function read() {
  return createReadTool({ images: bunImages });
}

// Only the hub agent selects it (server/src/hub/agent.ts).
export const HubFileTools = defineExtension({
  name: 'hub-file-tools',
  tools: [read(), ownFolder(createWriteTool()), ownFolder(createEditTool())],
});

export const CodingTools = defineExtension({
  name: 'coding-tools',
  tools: [read(), createWriteTool(), createEditTool(), createBashTool()],
});
