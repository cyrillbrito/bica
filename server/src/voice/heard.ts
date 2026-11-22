import type { VoiceLine } from '@bica/shared/transcript';

// What was said since the last handoff, newest kept.
const CALL_WORDS_CHARS = 4000;
// How long without a new piece of the user's transcript counts as them having
// stopped, when GPT-Live never closes their turn.
const QUIET_MS = 3000;

/**
 * What was said in a call. Each line goes to the transcript once its turn is
 * done, and to the agent with the next handoff. Lines arrive in pieces, or
 * whole so far, until the turn is done.
 */
export function heard(save: (line: VoiceLine) => void) {
  const turns = {
    you: { text: '', at: 0, heard: 0 },
    voice: { text: '', at: 0, heard: 0 },
  };
  // What was said since the last handoff, for the agent.
  const said: string[] = [];
  // The start of the user's unfinished line that a handoff already carried.
  let carried = '';

  const talking = () =>
    !!turns.you.text || Date.now() - turns.you.heard < QUIET_MS;

  return {
    talking,

    /** Resolves once the user isn't talking, so a result isn't spoken over them. */
    async quiet(open: () => boolean) {
      while (turns.you.text && talking() && open()) await Bun.sleep(250);
    },

    piece(who: VoiceLine['who'], piece: string) {
      const turn = turns[who];
      if (!turn.text) turn.at = Date.now();
      turn.heard = Date.now();
      turn.text = piece.startsWith(turn.text) ? piece : turn.text + piece;
    },

    /** Ends a turn, with its whole transcript when GPT-Live gives it. */
    done(who: VoiceLine['who'], transcript?: string) {
      const text = (transcript || turns[who].text).trim();
      const at = turns[who].at || Date.now();
      turns[who] = {
        text: '',
        at: 0,
        heard: who === 'you' ? turns.you.heard : 0,
      };
      if (!text) return;
      save({ who, text, at });
      const fresh =
        who === 'you' && carried && text.startsWith(carried)
          ? text.slice(carried.length).trim()
          : text;
      if (who === 'you') carried = '';
      if (fresh) said.push(`${who === 'you' ? 'User' : 'Voice'}: ${fresh}`);
    },

    /**
     * The lines since the last handoff, for the next one. The voice passes
     * the user's own words, so a last line that only repeats `request` is
     * left out.
     */
    take(request = '') {
      const lines = said.splice(0);
      carried = turns.you.text.trim();
      if (carried) lines.push(`User: ${carried}`);
      const last = lines.at(-1);
      if (last?.startsWith('User: ') && sameWords(last.slice(6), request))
        lines.pop();
      let length = lines.join('\n').length;
      while (lines.length > 1 && length > CALL_WORDS_CHARS)
        length -= lines.shift()!.length + 1;
      return lines;
    },
  };
}

function sameWords(a: string, b: string) {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return words(a) === words(b);
}
