import {
  arr,
  bool,
  lit,
  obj,
  opt,
  str,
  union,
} from '@earendil-works/pi-schema';
import { defineExtension, defineTool } from '@earendil-works/pi-durable';

// Exa does both jobs: search, and fetching a page as clean text.
// https://exa.ai/docs/reference/search · https://exa.ai/docs/reference/get-contents

type ExaResult = {
  id?: string;
  title?: string;
  url?: string;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
};

type ExaResponse = {
  results?: ExaResult[];
  statuses?: {
    id: string;
    status: string;
    error?: { tag?: string; httpStatusCode?: number };
  }[];
};

const DAYS = { day: 1, week: 7, month: 30, year: 365 } as const;

// One fetch returns at most this much page text, split evenly between its
// URLs, so a long list costs no more context than one full page.
const FETCH_BUDGET = 50_000;

async function exa(
  apiKey: () => Promise<string | undefined>,
  path: string,
  body: object,
  signal: AbortSignal | undefined,
): Promise<ExaResponse> {
  const key = await apiKey();
  if (!key)
    throw new Error(
      'No Exa key: the user can add one in Bica under Settings → Providers',
    );
  const timeout = AbortSignal.timeout(60_000);
  const response = await fetch(`https://api.exa.ai${path}`, {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Exa ${path} failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }
  return (await response.json()) as ExaResponse;
}

function heading(result: ExaResult) {
  const date = result.publishedDate
    ? ` (${result.publishedDate.slice(0, 10)})`
    : '';
  return result.title
    ? `## ${result.title}${date}\n${result.url}`
    : `## ${result.url}${date}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createWebTools(apiKey: () => Promise<string | undefined>) {
  const webSearch = defineTool({
    name: 'web_search',
    description:
      'Search the web. Returns the top results with title, URL, date and the most relevant passages. Use web_fetch to read a result in full.',
    parameters: obj(
      {
        queries: arr(str(), {
          minItems: 1,
          description: 'What to search for, in natural language',
        }),
        recency: opt(
          union([lit('day'), lit('week'), lit('month'), lit('year')], {
            description: 'Only results published within this period',
          }),
        ),
        domains: opt(
          arr(str(), {
            description:
              'Limit to these domains; prefix with - to exclude one (e.g. "-reddit.com")',
          }),
        ),
      },
      { open: true },
    ),
    replay: 'safe',
    async execute({ queries, recency, domains }, _api, context) {
      const include = domains?.filter((d) => !d.startsWith('-'));
      const exclude = domains
        ?.filter((d) => d.startsWith('-'))
        .map((d) => d.slice(1));
      const search = async (query: string) => {
        const data = await exa(
          apiKey,
          '/search',
          {
            query,
            type: 'auto',
            numResults: 5,
            ...(include?.length && { includeDomains: include }),
            ...(exclude?.length && { excludeDomains: exclude }),
            ...(recency && {
              startPublishedDate: new Date(
                Date.now() - DAYS[recency] * 86_400_000,
              ).toISOString(),
            }),
            // Exa sizes each excerpt by its relevance, as its docs recommend.
            contents: { highlights: true },
          },
          context.abortSignal,
        );
        const results = data.results ?? [];
        if (!results.length) return 'No results.';
        return results
          .map((r) => `${heading(r)}\n\n${(r.highlights ?? []).join('\n\n')}`)
          .join('\n\n');
      };
      // Exa answers 429 to most of 25 searches started at once.
      const settled: PromiseSettledResult<string>[] = [];
      for (let i = 0; i < queries.length; i += 5)
        settled.push(
          ...(await Promise.allSettled(queries.slice(i, i + 5).map(search))),
        );
      if (settled.every((s) => s.status === 'rejected'))
        throw (settled[0] as PromiseRejectedResult).reason;
      const parts = settled.map((s) =>
        s.status === 'fulfilled' ? s.value : `Failed: ${errorText(s.reason)}`,
      );
      const text =
        parts.length === 1
          ? parts[0]!
          : parts.map((p, i) => `# Search: ${queries[i]}\n\n${p}`).join('\n\n');
      return { output: [{ type: 'text', text }] };
    },
  });

  const webFetch = defineTool({
    name: 'web_fetch',
    description:
      'Read public web pages (articles, docs, PDFs) as clean text. A YouTube video link returns its transcript, sometimes translated to English. Pass `query` to get only the passages relevant to it instead of the whole page. Cannot reach localhost or private networks; use bash (curl) for those.',
    parameters: obj(
      {
        urls: arr(str(), {
          minItems: 1,
          description: 'The page URLs',
        }),
        query: opt(
          str({
            description: 'Return only the passages relevant to this question',
          }),
        ),
        fresh: opt(
          bool({
            description: 'Skip the cache and fetch the live page (slower)',
          }),
        ),
      },
      { open: true },
    ),
    replay: 'safe',
    async execute({ urls, query, fresh }, _api, context) {
      const data = await exa(
        apiKey,
        '/contents',
        {
          urls,
          ...(query
            ? { highlights: { query } }
            : {
                text: {
                  maxCharacters: Math.floor(FETCH_BUDGET / urls.length),
                },
              }),
          ...(fresh && { maxAgeHours: 0 }),
        },
        context.abortSignal,
      );
      const pages = urls.map((url) => {
        const failed = data.statuses?.find(
          (s) => s.id === url && s.status !== 'success',
        );
        const result = data.results?.find((r) => (r.id ?? r.url) === url);
        if (failed || !result) {
          const reason = failed?.error?.tag ?? 'no content';
          const status = failed?.error?.httpStatusCode;
          return {
            ok: false,
            text: `Could not fetch ${url}: ${reason}${status ? ` (HTTP ${status})` : ''}`,
          };
        }
        const body = query
          ? (result.highlights ?? []).join('\n\n')
          : (result.text ?? '');
        return { ok: true, text: `${heading(result)}\n\n${body}` };
      });
      if (!pages.some((p) => p.ok))
        throw new Error(pages.map((p) => p.text).join('\n'));
      const text = pages.map((p) => p.text).join('\n\n');
      return { output: [{ type: 'text', text }] };
    },
  });

  return defineExtension({
    name: 'web',
    tools: [webSearch, webFetch],
  });
}
