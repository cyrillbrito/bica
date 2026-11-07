import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Context } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { shows, startBica, type Bica, type Tab } from '../testing/bica';

let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
  bica.reply(...Array.from({ length: 100 }, () => route));
});
afterAll(() => bica?.stop());

function firstPrompt(context: Context) {
  const first = context.messages.find((m) => m.role === 'user')?.content;
  return typeof first === 'string' ? first : JSON.stringify(first ?? '');
}

// A child session's task comes with its parent's label in front.
function task(context: Context) {
  return firstPrompt(context).replace(/^\[Message from [^\]]*\] /, '');
}

let script: Record<string, unknown[]> = {};

/**
 * One fake model for every session, answering by whose run it is: `script`
 * maps how the session's first prompt starts to its answers, in order; once
 * they run out, the session answers "Noted".
 */
function route(context: Context) {
  const key = Object.keys(script).find((k) => task(context).startsWith(k));
  const next = key ? script[key]!.shift() : undefined;
  if (next === undefined) return fauxAssistantMessage('Noted');
  if (typeof next === 'function') return next(context);
  return typeof next === 'string'
    ? fauxAssistantMessage(next)
    : (next as ReturnType<typeof fauxAssistantMessage>);
}

function sessionsOf(tab: Tab) {
  return tab.watch('sessions', {});
}

async function settled(tab: Tab, ...ids: string[]) {
  await sessionsOf(tab).until((l) =>
    ids.every((id) =>
      l.some(
        (s) => s.id === id && s.status !== 'running' && s.status !== 'retrying',
      ),
    ),
  );
}

test('a child session reports each turn to its parent, with what the user told it, until the user detaches it', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'children');
  script = {
    Lead: [
      fauxAssistantMessage(
        fauxToolCall('session_start', {
          prompt: 'Childwork: pick a colour',
          summary: 'Start a child session',
        }),
        { stopReason: 'toolUse' },
      ),
      'Child started',
    ],
    Childwork: ['First pick: red', 'Second pick: blue', 'Third pick: green'],
  };
  const { id: parent } = await tab.request('session.create', {
    projectId,
    prompt: 'Lead the colour work',
    requestId: crypto.randomUUID(),
  });
  const list = await sessionsOf(tab).until((l) =>
    l.some((s) => s.parent === parent),
  );
  const child = list.find((s) => s.parent === parent)!.id;
  // Shown as a message from the parent, not as the user's prompt.
  await tab
    .watch('conversation', { id: child })
    .until((c) => shows(c, 'bica.sent'));
  const parentChat = tab.watch('conversation', { id: parent });
  await parentChat.until((c) => shows(c, 'First pick: red'));

  // Writing to a child session leaves it with its parent, which hears the user's words.
  await settled(tab, child);
  await tab.request('session.submit', {
    id: child,
    prompt: 'Go for something cooler',
    requestId: crypto.randomUUID(),
  });
  await parentChat.until(
    (c) => shows(c, 'Go for something cooler') && shows(c, 'Second pick: blue'),
  );

  await settled(tab, child, parent);
  await tab.request('session.detach', { id: child });
  await parentChat.until((c) => shows(c, 'detached'));
  await sessionsOf(tab).until((l) =>
    l.some((s) => s.id === child && s.parent === null),
  );
  await settled(tab, parent);
  await tab.request('session.submit', {
    id: child,
    prompt: 'One more',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('conversation', { id: child })
    .until((c) => shows(c, 'Third pick: green'));
  await settled(tab, child, parent);
  expect(shows(parentChat.value, 'Third pick: green')).toBe(false);
});

test('a child session that messages its parent mid-turn still reports the end of that turn', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'mid-turn');
  script = {
    Chief: [
      fauxAssistantMessage(
        fauxToolCall('session_start', {
          prompt: 'Worker: sort the list',
          summary: 'Start a child session',
        }),
        { stopReason: 'toolUse' },
      ),
      'Worker started',
    ],
    Worker: [
      (context: Context) =>
        fauxAssistantMessage(
          fauxToolCall('session_send', {
            id: /\(session (\d+)\) started this session/.exec(
              firstPrompt(context),
            )![1],
            message: 'Going with ascending order',
            summary: 'Tell the parent',
          }),
          { stopReason: 'toolUse' },
        ),
      'Sorted ascending, all done',
    ],
  };
  const { id: parent } = await tab.request('session.create', {
    projectId,
    prompt: 'Chief of sorting',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('conversation', { id: parent })
    .until(
      (c) =>
        shows(c, 'Going with ascending order') &&
        shows(c, 'Sorted ascending, all done'),
    );
});

test('archiving a parent detaches the child sessions it leaves open', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'archive-parent');
  script = {
    Boss: [
      fauxAssistantMessage(
        fauxToolCall('session_start', {
          prompt: 'Helper: count to three',
          summary: 'Start a child session',
        }),
        { stopReason: 'toolUse' },
      ),
      'Helper started',
    ],
  };
  const { id: parent } = await tab.request('session.create', {
    projectId,
    prompt: 'Boss the counting',
    requestId: crypto.randomUUID(),
  });
  const list = await sessionsOf(tab).until((l) =>
    l.some((s) => s.parent === parent),
  );
  const child = list.find((s) => s.parent === parent)!.id;
  await settled(tab, child, parent);
  await tab.request('session.archive', { id: parent, archived: true });
  const after = await sessionsOf(tab).until((l) =>
    l.some((s) => s.id === child && s.parent === null),
  );
  expect(after.find((s) => s.id === child)!.archivedAt).toBeNull();
});

test('a codemode script starts child sessions and reads them', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'scripted');
  script = {
    Fanout: [
      fauxAssistantMessage(
        fauxToolCall('codemode', {
          summary: 'Start two child sessions',
          code: `const ids = await Promise.all(['Scripted one', 'Scripted two'].map((prompt) => tools.session_start({ prompt })));
return await tools.list({});`,
        }),
        { stopReason: 'toolUse' },
      ),
      'Both started',
    ],
  };
  const { id: parent } = await tab.request('session.create', {
    projectId,
    prompt: 'Fanout the work',
    requestId: crypto.randomUUID(),
  });
  await settled(tab, parent);
  const list = await sessionsOf(tab).until(
    (l) => l.filter((s) => s.parent === parent).length === 2,
  );
  expect(list.filter((s) => s.parent === parent)).toHaveLength(2);
  await tab
    .watch('conversation', { id: parent })
    .until((c) => shows(c, 'Both started'));
});

test('archiving a running child session waits for its turn to end', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'archive-running');
  const { promise: released, resolve: release } = Promise.withResolvers();
  script = {
    Boss: [
      fauxAssistantMessage(
        fauxToolCall('session_start', {
          prompt: 'Heldwork: take your time',
          summary: 'Start a child session',
        }),
        { stopReason: 'toolUse' },
      ),
      (context: Context) => {
        const started = JSON.stringify(context.messages.at(-1));
        return fauxAssistantMessage(
          fauxToolCall('session_archive', {
            id: started.match(/Started session (\d+)/)![1]!,
            summary: 'Archive the child session',
          }),
          { stopReason: 'toolUse' },
        );
      },
      'Archive asked',
    ],
    Heldwork: [
      async () => {
        await released;
        return fauxAssistantMessage('Work done');
      },
    ],
  };
  const { id: parent } = await tab.request('session.create', {
    projectId,
    prompt: 'Boss the child around',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('conversation', { id: parent })
    .until((c) => shows(c, 'Archive asked'));
  const list = await sessionsOf(tab).until((l) =>
    l.some((s) => s.parent === parent),
  );
  expect(list.find((s) => s.parent === parent)!.archivedAt).toBeNull();
  release(undefined);
  await sessionsOf(tab).until((l) =>
    l.some((s) => s.parent === parent && s.archivedAt),
  );
});

test('a session archives itself once its turn ends, only when the user asked', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'self-archive');
  let self = '';
  const archiveSelf = (userAsked: boolean) => () =>
    fauxAssistantMessage(
      fauxToolCall('session_archive', {
        id: self,
        summary: 'Archive this session',
        ...(userAsked && { user_asked: true }),
      }),
      { stopReason: 'toolUse' },
    );
  script = {
    Tidy: [
      'Ready',
      archiveSelf(false),
      'Not archived',
      archiveSelf(true),
      'All done, archiving',
    ],
  };
  ({ id: self } = await tab.request('session.create', {
    projectId,
    prompt: 'Tidy up',
    requestId: crypto.randomUUID(),
  }));
  await settled(tab, self);
  await tab.request('session.submit', {
    id: self,
    prompt: 'Archive yourself',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('conversation', { id: self })
    .until((c) => shows(c, 'Not archived'));
  await settled(tab, self);
  expect(
    (await sessionsOf(tab).until(() => true)).find((s) => s.id === self)!
      .archivedAt,
  ).toBeNull();
  await tab.request('session.submit', {
    id: self,
    prompt: 'You may archive yourself',
    requestId: crypto.randomUUID(),
  });
  await sessionsOf(tab).until((l) =>
    l.some((s) => s.id === self && s.archivedAt),
  );
  await tab
    .watch('conversation', { id: self })
    .until((c) => shows(c, 'All done, archiving'));
});

test('the hub hears each turn of a session it watches, until the user stops the watch', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'watched');
  await tab.request('settings.update', {
    hubFolder: join(bica.root, 'hub'),
  });
  script = {
    Solowork: ['Files listed', 'Watched answer', 'Unwatched answer'],
  };
  const { id: watched } = await tab.request('session.create', {
    projectId,
    prompt: 'Solowork: list the files',
    requestId: crypto.randomUUID(),
  });
  script['Watch it'] = [
    fauxAssistantMessage(
      fauxToolCall('session_watch', {
        id: watched,
        watch: true,
        summary: 'Watch it',
      }),
      { stopReason: 'toolUse' },
    ),
    'Watching',
  ];
  await settled(tab, watched);
  const hub = await tab.request('hub.open', {});
  await tab.request('session.submit', {
    id: hub,
    prompt: 'Watch it for me',
    requestId: crypto.randomUUID(),
  });
  await sessionsOf(tab).until((l) =>
    l.some((s) => s.id === watched && s.watchedBy.includes(hub)),
  );
  await settled(tab, hub);

  const hubChat = tab.watch('conversation', { id: hub });
  await tab.request('session.submit', {
    id: watched,
    prompt: 'Again',
    requestId: crypto.randomUUID(),
  });
  await hubChat.until((c) => shows(c, 'Watched answer'));

  await settled(tab, watched, hub);
  await tab.request('session.unwatch', { id: watched });
  await hubChat.until((c) => shows(c, 'stopped your watch'));
  await settled(tab, hub);
  await tab.request('session.submit', {
    id: watched,
    prompt: 'Once more',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('conversation', { id: watched })
    .until((c) => shows(c, 'Unwatched answer'));
  await settled(tab, watched, hub);
  expect(shows(hubChat.value, 'Unwatched answer')).toBe(false);
});
