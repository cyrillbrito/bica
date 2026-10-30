# Testing

Bica's tests check the promises the app makes, from the outside, so they keep passing while the code behind them changes. `bun run test` runs them with Bun's own test runner, each file in its own process, in a couple of seconds.

## What gets a test

A test guards a behavior that would hurt if it quietly broke: a prompt gets its reply, a queued prompt waits for the run, Stop hands the queue back, a resent request acts once, a crash loses no run, another website can't open the socket, stopping a terminal ends what it started. Each test is named for that behavior in plain words.

Everything else goes without one. Helpers, components, and code that is easy to see working in the app don't get tests, and neither do the shapes of data or the steps a feature takes. Fewer tests that each guard something real beat many that restate the code.

- Test through the socket, the way the browser uses Bica. Assert on what a user would see, such as text in the transcript or a file in the Git tab, not on where it sits in the data.
- Fake only the model. The server, SQLite, git, the disk, and the shells are real, in a scratch folder.
- One test per behavior. A new case of the same behavior is a new input to that test, not a copy of it.
- Expected values come from the behavior, never computed the way the code computes them.
- Wait for a state, never for a fixed time. Each `until` names the condition it waits for.
- A new test has to fail once. Break the behavior on purpose, see the test go red, and put the code back.

A narrower test is fine where a module meets a library and is easy to get wrong, such as fitting images for the model.

## Where tests live

A test sits next to the code it guards, as `name.test.ts`: session behaviors in `server/src/sessions`, git in `server/src/git`, and so on. A behavior that crosses areas goes next to where it starts.

`server/src/testing/bica.ts` starts a real Bica on a free port with a fake model, and opens tabs on it. A tab sends requests and watches topics as the browser does. `reply` queues the model's next replies, and `hold` keeps it working until the test releases it. The server is one per process, so each test file starts its own.

## Sources

- Kent Beck's [Test Desiderata](https://testdesiderata.com/): tests should be sensitive to behavior and insensitive to structure.
- Kent C. Dodds, [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests) and [Testing implementation details](https://kentcdodds.com/blog/testing-implementation-details).
- Matt Pocock's [tdd skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md): test at agreed seams, and its anti-patterns, implementation-coupled and tautological tests.
- [Preventing LLM unit test spam](https://blog.larah.me/test-slop/): tell agents to test at the edges, and avoid mocks.
- [How many tests is too many?](https://specstory.com/learning/test-quality/test-bloat): one test per behavior, add inputs instead of copies, and mutation testing to find tests that guard nothing.
