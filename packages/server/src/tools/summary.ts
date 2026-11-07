import {
  AgentDoc,
  defineExtension,
  GenerationTask,
  hook,
  ToolTask,
} from '@earendil-works/pi-durable';
import type { JsonObject } from '@earendil-works/pi-durable';
import type { Message } from '@earendil-works/pi-ai';

// The transcript shows `summary` next to the tool name, so a call reads at a
// glance instead of only as a raw bash command, path, or URL. Only the model's
// copy of each tool gets the field: tools stay as registered, so codemode lists
// them unchanged, where calls show no summary anyway. It's required because
// models skip optional fields; a call without one still runs, since Durable
// validates against the registered tool.
const summary = {
  type: 'string',
  description:
    'What this call does and why, in plain words, shown to the user next to the tool name. At most ~10 words, no trailing period. E.g. "Find where sessions are created", "Run the type checker", "Add summary param to tools".',
};

function withSummary(message: Message, grammar: boolean): Message {
  if (message.role !== 'system' || !message.toolsAdded) return message;
  return {
    ...message,
    toolsAdded: message.toolsAdded.map((tool) => {
      // A model that takes grammar tools, such as GPT-5, writes codemode's
      // script as one raw string, and pi-ai rejects a second required field.
      // Other models get the tool as plain JSON, so it takes a summary too.
      if (
        grammar &&
        tool.constrainedSampling &&
        tool.constrainedSampling.type === 'grammar'
      )
        return tool;
      const { properties, required = [] } = tool.parameters as {
        properties?: object;
        required?: string[];
      };
      return {
        ...tool,
        parameters: {
          ...tool.parameters,
          properties: { summary, ...properties },
          // Sessions from before 0dd7e60 stored the field already.
          required: ['summary', ...required.filter((r) => r !== 'summary')],
        },
      };
    }),
  };
}

export const ToolSummary = defineExtension({
  name: 'bica-tool-summary',
  hooks: [
    // Tool declarations travel in the transcript's system messages, so adding
    // the field per request keeps the stored ones as Durable made them.
    hook(GenerationTask, {
      beforeRequest: async ({ messages }, api, context) => {
        const ref = (await api.snapshot(AgentDoc, api.conversationId, context))
          ?.model;
        const model = ref && api.models.getModel(ref.provider, ref.modelId);
        // Unknown model: skip grammar tools, since a request without a
        // summary still works and one pi-ai rejects doesn't.
        const grammar = model
          ? !!model.compat &&
            'supportsOpenAIGrammarTools' in model.compat &&
            model.compat.supportsOpenAIGrammarTools === true
          : true;
        return { messages: messages.map((m) => withSummary(m, grammar)) };
      },
    }),
    hook(ToolTask, {
      beforeTool: ({ arguments: args }) => {
        if (!('summary' in args)) return undefined;
        const { summary: _summary, ...rest } = args;
        return { arguments: rest as JsonObject };
      },
    }),
  ],
});
