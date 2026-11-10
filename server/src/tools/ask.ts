import { arr, bool, obj, opt, str } from '@earendil-works/pi-schema';
import { defineExtension, defineTool } from '@earendil-works/pi-durable';

/**
 * Asks the user and ends the run; the answer arrives as the next prompt.
 * Nothing blocks while waiting, so a question survives restarts and can be
 * answered hours later from another device. The browser draws the options
 * from the call's arguments (src/components/AskCard.tsx).
 */
export const ASK = 'ask';

const ask = defineTool({
  name: ASK,
  description:
    'Ask the user one to four multiple-choice questions and end your turn; the answer comes in a message from them. Use it for decisions that are genuinely theirs (what to build, which approach, scope), not for facts you can look up. Put your recommended option first and end its label with " (Recommended)". A skipped question comes back as "(skipped)": decide it yourself or ask again later.',
  parameters: obj(
    {
      questions: arr(
        obj({
          question: str({
            description: 'The full question, ending with a question mark',
          }),
          header: str({
            description: 'A very short label for it, at most 12 characters',
          }),
          options: arr(
            obj({
              label: str({ description: '1 to 5 words' }),
              description: opt(str({ description: 'What choosing it means' })),
            }),
            { minItems: 2, maxItems: 4 },
          ),
          multiSelect: opt(
            bool({ description: 'Allow picking several options' }),
          ),
        }),
        { minItems: 1, maxItems: 4 },
      ),
    },
    { open: true },
  ),
  replay: 'safe',
  callers: ['model'],
  async execute() {
    return {
      output: [
        {
          type: 'text',
          text: 'Shown to the user. Their answer comes in a message from them.',
        },
      ],
      control: { terminate: true },
    };
  },
});

export const AskTool = defineExtension({ name: 'ask', tools: [ask] });
