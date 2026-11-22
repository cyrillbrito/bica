# Voice calls and dictation

A voice call lets you talk to a session. The sound-wave button in the send spot starts one while nothing is typed, as in ChatGPT, and on the home page it starts a new session with a call on it. While the agent works, stop takes the spot and the call button sits beside it.

During the call, the composer becomes the call panel: a level meter, what is being said, the model picker, mute, and a red end button. Each finished line moves into the transcript.

## How it works

```
 you ──speech──▶ GPT-Live (OpenAI) ── handoff ──▶ Bica server ── prompt ──▶ the session
     ◀─speech──                     ◀── result ───             ◀─ reply ──
```

GPT-Live is only the voice. It listens, talks, can be interrupted, and decides when something needs the agent. The session does the work with its own model and tools. Handoffs arrive as ordinary prompts, so everything stays in the transcript, and they act as typed ones: they bring an archived session back, and they end the agent's wait in `terminal_read`.

- A handoff carries your own words: the voice is asked not to rephrase you, and Bica adds what was said in the call since the last handoff, leaving out your last line when the request already repeats it. The transcript shows those lines once, in the call.
- Every handoff tells the agent that its reply will be spoken, so it leads with the answer in a sentence or two of plain speech, with no headings or bold labels. Since the voice answers some things by itself, the agent also sees the voice's lines, and corrects one that got something wrong.
- A handoff while the agent works joins the run at once, so "no, the other branch" lands before the wrong thing is done. Handoffs that joined the same run share one reply, spoken once.
- Progress reaches the voice as quiet commentary, and the final reply as the result to speak. Long runs never time out.
- A run that ends on an approval card or a question isn't done, and often has no reply text. The result says what it waits for, such as "an approval card: GMAIL_BATCH_MODIFY_MESSAGES. It hasn't run yet", so the voice tells you to answer it instead of saying the work is done. Your answer starts a new run, which comes back as an update.
- The voice is told to say it's checking only when it hands something off: GPT-Live otherwise says "on it" with nothing running.
- A run the call didn't start is spoken too, such as a [bot](./bots.md)'s run after a note that a session finished or asks something.
- A result that is ready while you talk waits until you finish.
- "How's it going" gets the agent's latest turn and how long ago it was, and "stop" stops the run.
- The photo button in the call panel adds photos, and on a phone it can open the camera. The voice can't see them, so they wait on the server and go with the next handoff: take a picture, then ask "what's wrong with this?". If you say nothing for 5 seconds, they go to the agent on their own, and its reply comes back as an update. Photos still waiting when the call ends go too, with what was said since the last handoff. The call panel says "Sending the photo to the agent…" until the photo has gone, as `pi-live-codex` keeps its attached badge, so a photo never looks handled while it waits.

## What the voice is told

The voice module, `server/src/voice/`, is only the call, and knows nothing about bots or projects:

- `openai.ts` is the wire: the sign-in, the WebRTC offer, the sideband socket, and context sent in pieces under the size cap.
- `prompt.ts` holds every word GPT-Live is told, laid out as OpenAI's [GPT-Live prompting guide](https://developers.openai.com/api/docs/guides/live-prompting) suggests: who it is, then its backchannel, interruption, and delegation policies, kept short since the guide finds overlapping rules do harm.
- `heard.ts` keeps what was said, for the transcript and the next handoff.
- `session.ts` is the session side. A run's end and what it waits on come from the same places that tell a parent session ([orchestration.md](./orchestration.md#who-hears-what)): `sessions/runs.ts` and `readSession`.
- `voice.ts` ties them together.

What the voice is told at the start of a call comes from four places, in this order:

1. The session's [agent](./agents.md) says who the voice is, and gives the names you may say. To you, the voice and the agent are one: the voice speaks the agent's results as its own work, and takes its name. Without that, GPT-Live answers "who are you" by itself and says it is ChatGPT.
2. The call's rules: when to talk, when to hand off, and how to speak results. Fillers and listening sounds are allowed now and then, not in every turn.
3. The session's voice settings, in its ⋯ menu in the top bar: speed, and instructions such as "talk with me in simple French".
4. The recent conversation, so "continue" makes sense.

Each agent decides its own part:

- Coding: the voice is that session's agent. Its names are "Bica", the branch, and the project's file and folder names, such as "CommitBox".
- Bot: the voice is the [bot](./bots.md), with its name and the tone in its `SOUL.md`. It talks about all your work, so its names are "Bica", the bot's name, your projects, and your open sessions' titles, newest first.

The call writes the names out so the voice hears and spells them right, and cuts the list at about 3,000 characters.

The ChatGPT route ignores the instructions sent when the call is set up, and refuses to change them later. Without them the voice answers as ChatGPT and follows none of Bica's rules. So once the call starts, Bica sends the first three parts again as silent context, the channel the voice reads without speaking, as OpenClaw found ([openclaw#199052](https://github.com/openclaw/openclaw/pull/199052)). Each part starts with a label saying it is setup from Bica, not you, and to stay quiet until you speak: without it, the voice took the rules for you talking and answered them as the call connected. The recent conversation goes only at setup, since context sent after the call starts can read as a turn to answer. The `rules sent` line in the call log shows when the rules went.

## Hold music

While the agent works in silence, Groove Salad from [SomaFM](https://somafm.com) plays quietly, as a sign the agent is still working. It keeps playing when you look at another page or lock the phone, and goes quiet while anyone talks. Background music in the Voice dialog sets its volume on this device, and turning off Sounds in Settings → Appearance silences it. On iOS it plays at the phone's volume.

## Dictation

On a phone, the mic button in the composer records until you tap its check, then writes what you said where the cursor is. While it records, the text is locked and the toolbar shows a level meter, the time, and a cross that throws the recording away. It replaces the keyboard's own dictation, which hears names and code words badly. The recording goes to ChatGPT's transcription, the one Codex Desktop dictates with, and ChatGPT keeps it for 30 days.

## Sign-in

Calls and dictation need the OpenAI Codex (legacy) provider in Settings → Providers ([models.md](./models.md#providers)). Without it, their buttons don't show, and the empty composer's send spot is a faded send. In development, `?voice=off` fakes that for the tab, and `?voice=on` brings them back. The newer Sign in with ChatGPT under OpenAI only covers chat models, so it doesn't work for them. Both run on the plan, the way the `pi-live-codex` extension and Codex Desktop do. That route is unofficial and may break.

## When a call goes wrong

Every call logs each step to `.data/voice-log.jsonl` (the data folder's `voice-log.jsonl` for the `bica` binary). The browser adds the mic's state, the connection, and errors. The server adds the signaling, the sideband opening and closing, and the first event of each kind. A call's lines share one `trace` id. The file rolls over to `voice-log.jsonl.1` at 2 MB.

Skipped or garbled words usually mean a bad network. The browser checks the call's audio every 5 seconds and writes an `audio trouble` line for each 5 seconds that lost packets or had to make up sound. The line shows both directions: `lost` and `concealedMs` for the voice reaching you, `sentLost` for your mic reaching OpenAI, and `jitterMs` and `rttMs` for the connection. At hang-up, an `audio` line gives the totals. A call with only the `audio` line had clean audio, so the problem lies elsewhere.

If the mic sends pure silence from the start, without even room noise, the call panel says "No sound from your mic". Once it has heard you, only the system muting or ending the mic brings that back, since iOS sends pure silence between words. In that case the browser or the system isn't passing the mic through, and the server and OpenAI aren't to blame.

## Limits

- One call at a time per browser tab.
- The mic needs a secure page: localhost or the Tailscale HTTPS address.
- On iOS, the mic keeps working with the phone locked in Safari and Chrome, but not in Bica added to the home screen ([WebKit bug 226620](https://bugs.webkit.org/show_bug.cgi?id=226620)).

## Sources

- [SomaFM: how to link to us](https://somafm.com/linktous/): the official stream links.
- openai/codex [methods_v2.rs](https://github.com/openai/codex/blob/f1affbac/codex-rs/codex-api/src/endpoint/realtime_websocket/methods_v2.rs) and [#18761](https://github.com/openai/codex/pull/18761): Codex's voice passes "the user's own words", steers a running task, and sends what was said since the last handoff.
- ChatGPT, [ChatGPT Voice](https://learn.chatgpt.com/docs/features/voice): progress, blockers, and results from Codex tasks come back while you talk.
- OpenAI, [Prompting GPT-Live](https://developers.openai.com/api/docs/guides/live-prompting) and [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation): the policy headings, "delegate when" lists, and that a spoken "I'm checking that" doesn't start any work.
- OpenClaw [#199052](https://github.com/openclaw/openclaw/pull/199052): GPT-Live on the ChatGPT route ignores setup instructions but follows them as `commentary` context sent after `session.started`.
- oh-my-pi's [live protocol](https://github.com/can1357/oh-my-pi/blob/403931b9/packages/coding-agent/src/live/protocol.ts): `session.context.append` on the same Codex route.
- [How I make apps feel premium](https://youtu.be/MXLF8b15GhQ): a calorie app gives its dictation the nearby restaurant names so it hears them right.
