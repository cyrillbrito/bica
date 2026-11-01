# Voice calls and dictation

A voice call lets you talk to a session. The sound-wave button in the send spot starts one while nothing is typed, as in ChatGPT, and on the home page it starts a new session with a call on it. While the agent works, stop takes the spot and the call button sits beside it.

During the call, the composer becomes the call panel: a level meter, what is being said, the model picker, mute, and a red end button. Each finished line moves into the transcript.

## How it works

```
 you ──speech──▶ GPT-Live (OpenAI) ── handoff ──▶ Bica server ── prompt ──▶ the session
     ◀─speech──                     ◀── result ───             ◀─ reply ──
```

GPT-Live is only the voice. It listens, talks, can be interrupted, and decides when something needs the agent. The session does the work with its own model and tools. Handoffs arrive as ordinary prompts, so everything stays in the transcript, and they act as typed ones: they bring an archived session back, a session held for tonight refuses them, and they end the agent's wait in `terminal_read`.

- A handoff carries your own words: the voice is asked not to rephrase you, and Bica adds what was said in the call since the last handoff. The transcript shows those lines once, in the call.
- A handoff while the agent works joins the run at once, so "no, the other branch" lands before the wrong thing is done. Handoffs that joined the same run share one reply, spoken once.
- Progress reaches the voice as quiet commentary, and the final reply as the result to speak. Long runs never time out.
- A run the call didn't start is spoken too, such as the hub's run after a note that a session finished or asks something.
- A result that is ready while you talk waits until you finish.
- The voice knows the recent conversation, so "continue" makes sense, and the project's file names, so it passes names like "CommitBox" on spelled right.
- "How's it going" gets the agent's latest turn and how long ago it was, and "stop" stops the run.
- The photo button in the call panel adds photos, and on a phone it can open the camera. The voice can't see them, so they wait on the server and go with the next handoff: take a picture, then ask "what's wrong with this?". Photos still waiting when the call ends are dropped.

Voice settings, in the session's ⋯ menu in the top bar, set a session's speed and instructions such as "talk with me in simple French".

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
- oh-my-pi's [live protocol](https://github.com/can1357/oh-my-pi/blob/403931b9/packages/coding-agent/src/live/protocol.ts): `session.context.append` on the same Codex route.
- [How I make apps feel premium](https://youtu.be/MXLF8b15GhQ): a calorie app gives its dictation the nearby restaurant names so it hears them right.
