# MausBot

From https://mausbot.com. Kind: an agent team, an open source take on Grok Bot under Apache 2.0. A desktop app (macOS, Windows, Linux) runs bots on your computer or a server, and phone apps connect to it.

- A bot list like a messaging app: pin, mark unread, duplicate, hide. Each row shows the bot's last line, such as "3 PRs reviewed, 1 needs you".
- Bots run on the agent CLIs already installed (Claude Code, Codex, Grok, Pi, any ACP agent, and more) with your logins. One local server on 127.0.0.1 owns every agent process and turns each provider's protocol into one event stream. Data lives in `~/.openmausbot`.
- The model can change in the middle of a conversation.
- Automations from one sentence: on a schedule, on a webhook, or on an event in Gmail, Slack, or Stripe. Scheduled runs show on a week calendar instead of a list of routines.
- Approval requests show in the chat, and a bot holds its drafts until you say send.
- Voice calls: the bot narrates its work and asks for approvals out loud.
- A skill recorder watches a chat, collects the commands the agent ran, and turns them into a skill with one click. Based on poteto's pstack article.
- Each bot can get its own cloud desktop with a live screen preview, or use this computer. Connected apps go through Composio.

For Bica, the calendar of scheduled runs, the skill recorder, and the last line on each list row are worth a look. Business bot personas, connected apps, and cloud desktops are out of scope.
