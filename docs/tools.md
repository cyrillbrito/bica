# Agent tools

The agent works through tools. Every call carries a short summary of what it is for, so the transcript reads as a list of intentions. The exception is `codemode` on models that write its script as raw text, such as GPT-5, which take no other field. Other models, such as Claude, get codemode as a plain JSON tool, so its calls carry a summary too. What the agent is told about using them is in [system-prompt.md](./system-prompt.md).

- Read, write, edit, and bash work in the session's workspace. Read also shows images to the model, shrunk when they are too big.
- Web search and fetch go through Exa, once its key is set ([models.md](./models.md#providers)). Both take a list: search runs its queries in parallel, and fetch reads all its URLs in one Exa request. A fetch returns at most 50,000 characters of page text, split evenly between its URLs, and a page that fails shows its error without failing the others.
- Terminal tools share the workspace's terminals with you ([terminals.md](./terminals.md)).
- The session tools start, read, message, and stop other sessions ([orchestration.md](./orchestration.md#the-session-tools)).

## Code mode

Code mode, the `codemode` tool, lets the model write a short JavaScript script that calls the other tools, so it can run them in parallel, chain them, and filter big output. Only what the script prints reaches the model. It is Pi Durable's code mode: each call in a script is a tool call of its own, and a script survives a restart. Scripts can call every tool but `ask`, which ends the run.

Scripts can also call classifier models, which answer typed yes/no, choice, or score questions in well under a second for a fraction of a cent. That makes it cheap to label many items and read only the flagged ones.

## Asking you

`ask` puts one to four multiple-choice questions to you and ends the run. Nothing waits, so a question can be answered hours later from another device. Typing in the composer answers too, and number keys pick options. A note or another session's message that comes first doesn't answer: it runs the agent with word that your answer is still to come. Once answered, the card folds into one row.

## Sources

- Pi Durable's [`codemode`](https://github.com/earendil-works/pi/tree/main/packages/durable).
- Exa's own [`web_fetch_exa`](https://github.com/exa-labs/exa-mcp-server/blob/main/src/tools/webFetch.ts) and Parallel's [Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp), which take lists of URLs and queries. Before lists, most web calls ran inside codemode scripts that only looped over them.
- The [web search benchmark for coding agents](https://github.com/openbenchmarks-labs/web-search-for-coding-agents), where Exa leads search and fetch.
