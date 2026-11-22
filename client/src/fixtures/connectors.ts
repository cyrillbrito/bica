// Connected apps and approvals for `?data=demo` and `?data=worst`.
import type { AppChoice, Connectors } from '@bica/shared/protocol';
import type { ApprovalRequest } from '@bica/shared/requests';
import type { Turn } from './conversation';

function logo(slug: string) {
  return `https://logos.composio.dev/api/${slug}`;
}
const now = Date.now();
const MIN = 60_000;

const CATALOG: AppChoice[] = [
  ['gmail', 'Gmail'],
  ['slack', 'Slack'],
  ['github', 'GitHub'],
  ['googlecalendar', 'Google Calendar'],
  ['notion', 'Notion'],
  ['linear', 'Linear'],
  ['googledrive', 'Google Drive'],
  ['jira', 'Jira'],
  ['figma', 'Figma'],
  ['discord', 'Discord'],
].map(([slug, name]) => ({ slug: slug!, name: name!, logo: logo(slug!) }));

/** Composio's catalog for Connect app: the first popular ones, or matches. */
export function fixtureToolkits(search: string): AppChoice[] {
  const q = search.trim().toLowerCase();
  return q
    ? CATALOG.filter(
        (a) => a.name.toLowerCase().includes(q) || a.slug.includes(q),
      )
    : CATALOG.slice(0, 8);
}

export function fixtureConnectors(worst: boolean): Connectors {
  const app = (
    slug: string,
    name: string,
    status: string,
    ago: number,
    withLogo = true,
  ) => ({
    id: `ca_${slug}_${ago}`,
    toolkit: slug,
    name,
    logo: withLogo ? logo(slug) : null,
    status,
    createdAt: now - ago * MIN,
  });
  if (!worst)
    return {
      keyHint: 'x7Qe',
      error: null,
      apps: [
        app('gmail', 'Gmail', 'ACTIVE', 3 * 24 * 60),
        app('slack', 'Slack', 'INITIATED', 2),
        app('github', 'GitHub', 'EXPIRED', 40 * 24 * 60),
      ],
    };
  return {
    keyHint: '9999',
    error:
      'Composio refused the key: 401 Unauthorized. Remove it and add a new one from your Composio project.',
    apps: [
      app(
        'internal-crm',
        'Acme Internal Customer Relationship Management Platform (Production, EU West, read and write access)',
        'ACTIVE',
        60,
        false,
      ),
      app('gmail', 'Gmail', 'ACTIVE', 3000),
      app('gmail', 'Gmail', 'INITIATED', 1),
      app('slack', 'Slack', 'FAILED', 90),
      app('github', 'GitHub', 'EXPIRED', 9000),
      app('notion', 'Notion', 'INACTIVE', 400),
      app('linear', 'Linear', 'REVOKED', 800),
      app('x', 'X', 'SUSPENDED', 5, false),
      app('googlecalendar', 'Google Calendar', 'ACTIVE', 20),
      app('googledrive', 'Google Drive', 'ACTIVE', 30),
      app('jira', 'Jira', 'ACTIVE', 50),
      app('figma', 'Figma', 'ACTIVE', 70),
    ],
  };
}

/** A reply that ends on two approval cards: a send and a delete. */
export function approvalTurn(worst: boolean): Turn {
  const choices = [
    { value: 'approve', label: 'Approve' },
    { value: 'always_approve', label: 'Always approve' },
    { value: 'deny', label: 'Deny' },
  ];
  const send: ApprovalRequest = {
    kind: 'approval',
    danger: false,
    choices,
    items: [
      {
        tool: 'GMAIL_SEND_EMAIL',
        app: 'Gmail',
        logo: logo('gmail'),
        danger: false,
        message: 'Send an email',
        args: worst
          ? {
              recipient_email:
                'a.very.long.address.for.someone.at.an.organisation.with.a.long.domain@subdomain.example-corporation.co.uk',
              subject:
                'Draft: building Bica with Bica — the second part, with every screen, the reconnect story, and what changed since the first draft',
              body: Array.from(
                { length: 14 },
                (_, i) =>
                  `Paragraph ${i + 1}. The draft walks through how sessions stream, how a queue survives a reconnect, and why the review happens in full-screen diffs rather than a side panel.`,
              ).join('\n\n'),
              cc: ['ana@example.com', 'joão@example.com', '李雷@example.cn'],
              is_html: false,
              attachment: null,
              extra: { thread: 'r-1234567890', labels: ['drafts', 'blog'] },
            }
          : {
              recipient_email: 'editor@example.com',
              subject: 'Draft: building Bica with Bica',
              body: 'Hi Sam,\n\nThe draft is ready for a read. It walks through how sessions stream and how review happens in full-screen diffs.\n\nThanks,\nAna',
            },
      },
      ...(worst
        ? [
            {
              tool: 'GOOGLECALENDAR_CREATE_EVENT',
              app: 'Google Calendar',
              logo: logo('googlecalendar'),
              danger: false,
              message: 'Create an event',
              args: {
                summary: 'Review the blog draft',
                start_datetime: '2026-10-12T10:00:00',
                attendees: ['editor@example.com'],
              },
            },
            {
              tool: null,
              app: null,
              logo: null,
              danger: false,
              message:
                'The agent wants to run a tool Composio could not describe.\nArguments were not readable.',
              args: null,
            },
          ]
        : []),
    ],
  };
  const remove: ApprovalRequest = {
    kind: 'approval',
    danger: true,
    choices: choices.filter((c) => c.value !== 'always_approve'),
    items: [
      {
        tool: 'GITHUB_DELETE_A_REPOSITORY',
        app: 'GitHub',
        logo: logo('github'),
        danger: true,
        message: 'Delete a repository',
        args: { owner: 'ana-silva', repo: 'blog-drafts-2025' },
      },
    ],
  };
  const card = (request: ApprovalRequest) => ({
    tool: 'composio_multi_execute_tool',
    args: { summary: 'Use connected apps' },
    output:
      "Not run yet: it waits for the user's approval on a card in the chat.",
    details: { request } as never,
  });
  return {
    agent: [
      { say: 'The draft is ready. Sending it needs your yes.' },
      card(send),
      card(remove),
    ],
  };
}
