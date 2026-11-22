import type { Artifacts } from '@bica/shared/protocol';

import type { Mode } from './data';

const THEMES = [
  { id: 'bica', label: 'Bica' },
  { id: 'paper', label: 'Paper' },
  { id: 'dashboard', label: 'Dashboard' },
];

const HOUR = 3_600_000;

/** The artifact list for a test data mode; their pages aren't test data. */
export function fixtureArtifacts(mode: Mode): Artifacts {
  const now = Date.now();
  const folder = '/home/dev/.bica/data/artifacts';
  const demo = [
    { name: 'q3-sales', title: 'Q3 sales', updated: now - 0.2 * HOUR },
    { name: 'auth-flow', title: 'How sign-in works', updated: now - 5 * HOUR },
    { name: 'deps-audit', title: 'Dependency audit', updated: now - 50 * HOUR },
  ];
  const worst = [
    {
      name: 'a-very-long-file-name-that-never-breaks-because-it-has-no-spaces-at-all-and-keeps-going',
      title:
        'Quarterly revenue, churn, and retention across every region, product line, and pricing plan, with the forecast for next year and the assumptions behind it',
      updated: now - 30_000,
    },
    { name: 'x', title: 'x', updated: now - 2 * HOUR },
    {
      name: '売上',
      title: '第3四半期の売上レポート 📈',
      updated: now - 40 * 86_400_000,
    },
    { name: 'untitled', title: 'untitled', updated: now - 400 * 86_400_000 },
  ];
  const list =
    mode === 'empty'
      ? []
      : mode === 'one'
        ? demo.slice(0, 1)
        : mode === 'worst'
          ? worst
          : mode === 'huge'
            ? Array.from({ length: 300 }, (_, i) => ({
                name: `report-${i}`,
                title: `Report ${i + 1}`,
                updated: now - i * HOUR,
              }))
            : demo;
  return { folder, themes: THEMES, list };
}
