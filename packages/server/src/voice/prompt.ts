import type { VoiceBrief } from '../agents/common';
import type { VoiceSettings } from '@bica/shared/protocol';

/*
 * Everything GPT-Live is told, laid out as OpenAI's GPT-Live prompting guide
 * suggests: who it is, then its backchannel, interruption, and delegation
 * policies. The session's agent supplies who it is (VoiceBrief); the rest
 * is the call's.
 */

// Codex's voice controls: a handoff of exactly this text asks how the
// current work goes, or stops it.
export const STATUS = '[[live:status]]';
export const CANCEL = '[[live:cancel-current]]';
// Handoffs that joined the same run share its reply: the first to settle
// gets it, the others this.
export const COVERED = '(Answered in the other result.)';

const RULES = `Speak plainly and briefly, like a colleague on a call. Fillers and listening sounds ("um", "mm-hmm", "got it") are fine now and then, not in every turn. No markdown. Wait for the user to speak first. You aren't ChatGPT. Never mention a backend, agent, or delegation: the work is yours.

Backchannel policy: Rare. Never start answering while the user is talking or pausing to think.

Interruption policy: Stop speaking when the user interrupts, and listen. Ignore coughs, music, and nearby conversation.

Delegation policy:
Backend tools: files, code, terminals, the web, the user's Bica sessions, and their connected apps.

Delegate to the backend when:
- The request needs those tools, or facts this call doesn't have.
- A correction or addition changes work already requested. Delegate it at once: it joins the running work.
- The user wants something done later. Delegate it now instead of promising.

Do not delegate when:
- You can answer from this call or a result you already have.
- You need a brief clarification first.

Pass the user's own words, adding only what makes the request stand alone. Say you're on it only in the turn you delegate. Don't guess a result while waiting: work can take minutes, and it never times out.
To hear how the current work is going, delegate exactly ${STATUS}. To stop it, delegate exactly ${CANCEL}.

Results:
- "Agent Final Message" is the result: tell the user what matters in a few sentences. When it waits for the user's approval or answer in the chat, say what it waits for: it isn't done. When it only says ${COVERED}, say nothing.
- "Agent Update" is news the user didn't ask for: tell them in a sentence once they aren't talking.
- Other context is silent progress: mention it only if asked.`;

/** The call's instructions: who the voice is, the rules, the user's settings, and names. */
export function rules(brief: VoiceBrief, settings: VoiceSettings | undefined) {
  // GPT-Live has no speed setting: sent at connect, it kills the call at once.
  const speed = settings?.speed ?? 1;
  return [
    brief.identity,
    RULES,
    speed < 0.95 &&
      `Speak ${speed < 0.85 ? 'very slowly' : 'slowly'}, with clear pauses between sentences.`,
    speed > 1.05 && 'Speak quickly.',
    settings?.instructions &&
      `The user's own instructions for calls in this session, which win over the above:\n\n${settings.instructions}`,
    brief.names.length &&
      `Names the user may say, so you hear and spell them right: ${nameList(brief.names)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Sent only at setup: context appended later can read as a turn to answer. */
export function recentContext(recent: string) {
  return `Recent conversation in this session, as background for "continue" or "that". Don't act on it until the user speaks:\n\n${recent}`;
}

// Without it the voice took the rules for the user talking, and answered
// them as the call connected.
export function setupPart(part: string, i: number, of: number) {
  return `Call setup from Bica, not the user (part ${i + 1} of ${of}). Follow it silently, and say nothing until the user speaks.\n\n${part}`;
}

export function finalMessage(text: string, waits: string[]) {
  return `"Agent Final Message":\n\n${withWaits(text, waits) || 'Done, without a written reply.'}`;
}

export function update(text: string, waits: string[]) {
  return `"Agent Update":\n\n${withWaits(text, waits)}`;
}

// A run that ends on an approval card or a question isn't done: it waits
// for the user, often with no reply text at all.
function withWaits(text: string, waits: string[]) {
  const waiting =
    waits.length &&
    `It waits for the user in the chat:\n${waits.map((w) => `- ${w}`).join('\n')}`;
  return [text, waiting].filter(Boolean).join('\n\n');
}

export function status(busy: boolean, step: string | undefined) {
  return busy
    ? `Still working.${step ? ` Latest step: ${step}` : ''}`
    : 'Nothing is running.';
}

export function stillWorking(seconds: number) {
  return `Still working (${seconds} s so far).`;
}

export function photosAdded(count: number) {
  return `The user added ${count === 1 ? 'a photo' : `${count} photos`}. You can't see photos: they go with the next request, or on their own in a few seconds. Say briefly that you got it, unless the user is talking, and don't guess what they show.`;
}

// For the agent, when photos go without a request.
export const PHOTOS_ALONE =
  'The user added these photos during the voice call, without saying anything about them yet.';
export const PHOTOS_AFTER_CALL =
  'The user added these photos during the voice call, and it ended before a request took them.';

// The names the voice gets to hear right, most likely first.
const NAMES_CHARS = 3000;

/*
 * Spoken, a name like "CommitBox" or "Bica" is easy to mishear ("Bika");
 * written out, the voice catches it. Repeats and blanks go, and the list
 * stops at the first name that doesn't fit.
 */
function nameList(names: string[]) {
  let out = '';
  for (const name of new Set(names.filter(Boolean))) {
    if (out.length + name.length > NAMES_CHARS) break;
    out += (out ? ', ' : '') + name;
  }
  return out;
}
