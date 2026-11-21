# mini-swe-agent

From https://github.com/SWE-agent/mini-swe-agent. Kind: an agent itself, a coding agent in about 100 lines of Python by the Princeton and Stanford team behind SWE-bench and SWE-agent. It scores over 74% on SWE-bench Verified.

- Bash is its only tool. It doesn't even use the model's tool calling, so it runs with any model.
- Each command runs on its own with `subprocess.run`, with no shell kept between steps. Running in a sandbox is swapping that call for `docker exec`.
- The history is linear: each step appends to the messages, so the trajectory is exactly what the model saw.
- A trajectory browser, batch runs, and Python bindings.

## Harness Leaderboard

https://huggingface.co/spaces/joelniklaus/harness-leaderboard measures which harness to run a given open model in: Claude Code, Codex, Pi, OpenCode, Hermes Agent, mini-swe-agent, Kimi Code, Qwen Code, and OpenClaw. Same model, provider, and reasoning effort, three attempts per task, on Terminal-Bench 2.1 and DeepSWE, with every trajectory public. Cost and time are measured outside the harness by a metering proxy, and looking up a benchmark's answers counts as a fail.

Read from its data on 2026-11-07, as passes over scored trials pooled across GLM-5.3-Flash, DeepSeek-V4.1-Flash, and Flint, not the board's macro-averaged headline:

| Harness | Tasks passed | Cost per pass |
| --- | --- | --- |
| mini-swe-agent | 57% | $0.53 |
| Hermes Agent | 56% | $0.65 |
| Kimi Code | 56% | $0.62 |
| Claude Code | 55% | $0.52 |
| Pi | 55% | $0.29 |
| Qwen Code | 50% | $0.34 |
| Codex | 49% | $0.71 |
| OpenCode | 40% | $3.35 |
| OpenClaw | 30% | $1.43 |

The top five sit within a few points of each other. Pi is the cheapest per pass among them by about half. Only open models are tested, so this says little about frontier models in their own harnesses.

For Bica, which runs on Pi Durable, this supports staying close to Pi's small tool set and prompt rather than adding tools: a bash-only agent does as well, and the heavy harnesses do worse and cost more. Its sister site, Harness Lens (https://huggingface.co/spaces/harness-hub/harness-lens), lists each harness's system prompt, tools, edit format, and compaction, with sources, which is worth reading before changing Bica's tools or prompt.
