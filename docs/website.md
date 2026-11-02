# Website

The website at bica.sh is the `site` package: an Astro home page, and the user docs at `/docs` built with Starlight. It is static, and Cloudflare serves it.

## Home page

`site/src/pages/index.astro`, with its parts in `site/src/home/` and its images in `site/src/assets/home/`. It uses the app's palette, fonts, and logo, and shares Starlight's light and dark setting. The coffee cup with a face lives only here; the app has no mascot.

## User docs

The docs are for people who use Bica, not for people who build it. `docs/` is the agents' manual and the source of facts; the site turns it into something a newcomer can follow. The sidebar in `site/astro.config.mjs` reads top to bottom:

- Start here: what Bica is, install, first run, a light how it works, the phone, and a FAQ.
- Basics: what everyone uses daily, one page each.
- Features: one page per feature, a little deeper.
- Set up and Reference: providers, settings, updating, and lookup pages.

Write and review every page with the [humanizer skill](../.agents/skills/humanizer/SKILL.md), including its section on Bica's user docs: what a feature is for first, the UI's labels, no internals, about 300 words, and one home per fact. When a feature changes in `docs/`, update its page here too.

Pick one picture per spot:

- A D2 diagram for flows, parts, and states the UI doesn't show. A `title` on every fence, about seven boxes, three actors at most in a sequence so it fits a phone. The shared classes in `site/src/d2/shared.d2` apply to every diagram.
- A demo for one small piece of UI worth trying: a real component from `client/src`, mounted with demo data from `site/src/demos/<name>.demo.tsx` and placed with `<Demo name="..." />`.
- A screenshot for a whole screen. `site/scripts/screens.sh` shoots the dev app on test data (`?data=demo`, port 3142) at 2x into `site/src/assets/screens/`, and `screens.txt` lists every shot so they can all be retaken after a UI change.

Keep MDX comments on one line, and don't run oxfmt on `.mdx` files: `.oxfmtrc.json` ignores them because oxfmt breaks JSX inside them.

## Commands

All run in `site/`, or from the root with `bun run --cwd site <script>`.

- `bun run dev` serves it on port 3144, and `bun run build` writes `site/dist`.
- `bun run links` checks every internal link and anchor in `site/dist` after a build.
- `bun run pdf` prints the whole docs site to one PDF in `site/dist-pdf`.
- `bun run deploy` builds, checks the links, and uploads `site/dist` to Cloudflare with Wrangler. The root's `bun run deploy:site` does the same.

## Analytics

The site counts visits with PostHog, in the same project as the app (see [telemetry.md](telemetry.md)), so it shows whether people who read about Bica go on to install it. It is off unless the build has a project key: with no `PUBLIC_POSTHOG_KEY`, no page carries any PostHog script. `PUBLIC_POSTHOG_HOST` names the project's region and defaults to EU cloud, `https://eu.i.posthog.com`. Both are read at build time, from the environment or `site/.env`, and the `site` workflow fills them from the repo variables `POSTHOG_KEY` and `POSTHOG_HOST`, the same ones the `release` workflow uses.

`site/src/analytics/PostHog.astro` adds PostHog's snippet to the home page and, through an override of Starlight's `Head`, to every docs page. It runs in cookieless mode, so it stores nothing in the browser and the site needs no cookie banner. PostHog drops cookieless events unless the project has cookieless tracking turned on, under Settings, Project, Web analytics. Visitors with Do Not Track or Global Privacy Control on don't load the script at all, since PostHog's own `respect_dnt` does nothing in cookieless mode. There is no session replay on the site.

Every event carries `app: 'site'`. PostHog captures pageviews, page leaves, clicks with heatmaps, and web vitals by itself, and the script adds two events:

- `install_command_copy`, when the Copy button on the home page or a code block's copy button in the docs copies an install command, with `method` (`binary` or `source`) and `platform`, such as `darwin-arm64`.
- `github_link_click`, for any link to the repo, with `link_url`.

The docs search has no event: Pagefind's search box exposes no hook for it.

On bica.sh the page sends to `/relay` on its own domain, and a small Worker, `site/src/analytics/relay.ts`, forwards it to PostHog, so blockers that list PostHog's hosts let it through. It strips cookies and passes the visitor's IP on, which cookieless mode needs to tell visitors apart. `astro dev` has no Worker, so there the page talks to the PostHog host directly.

## Deploy

`site/wrangler.jsonc` deploys the site as static assets on a Cloudflare Worker named `bica-site`, on the custom domain `bica.sh`, with Starlight's 404 page for unknown paths. The Worker's code runs only for `/relay/*`, and the deploy script hands it `PUBLIC_POSTHOG_HOST` from the environment, not from `site/.env`. The `site` workflow runs the deploy on every push to `main` that touches the site, the client's source (demos import it), or the lockfile. It stays skipped until the repo has the `CLOUDFLARE_ACCOUNT_ID` variable and the `CLOUDFLARE_API_TOKEN` secret, a token made from Cloudflare's "Edit Cloudflare Workers" template. The `bica.sh` zone must be on the same Cloudflare account. From a machine, `bunx wrangler login` once, then `bun run deploy:site`.
