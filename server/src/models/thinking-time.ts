import {
  type AssistantMessage,
  createAssistantMessageEventStream,
  type MutableModels,
} from '@earendil-works/pi-ai';

/**
 * Providers don't say how long the model thought, so time each thinking block
 * as it streams and stamp `durationMs` on it. The stamp is saved with the
 * message, so the transcript can show "Thought · 12s" after a reload too.
 * Providers rebuild thinking blocks field by field, so the extra field never
 * reaches the API.
 */
export function timeThinking(models: MutableModels) {
  const stream = models.streamSimple.bind(models);
  models.streamSimple = (model, context, options) => {
    const source = stream(model, context, options);
    const out = createAssistantMessageEventStream();
    const started = new Map<number, number>();
    const took = new Map<number, number>();
    const stamp = (message: AssistantMessage) => {
      for (const [i, ms] of took) {
        const block = message.content[i];
        if (block?.type === 'thinking') block.durationMs = ms;
      }
      return message;
    };
    void (async () => {
      try {
        for await (const event of source) {
          if (event.type === 'thinking_start')
            started.set(event.contentIndex, Date.now());
          if (event.type === 'thinking_end')
            took.set(
              event.contentIndex,
              Date.now() - (started.get(event.contentIndex) ?? Date.now()),
            );
          if (event.type === 'done') stamp(event.message);
          else if (event.type === 'error') stamp(event.error);
          else stamp(event.partial);
          out.push(event);
        }
        out.end(stamp(await source.result()));
      } catch (error) {
        console.error('[thinking-time]', error);
        out.end();
      }
    })();
    return out;
  };
}
