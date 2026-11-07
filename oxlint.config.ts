import { defineConfig } from 'oxlint';
import solidV2 from 'eslint-plugin-solid/configs/v2';

export default defineConfig({
  // Oxlint's defaults plus import, which no-cycle below needs on at the top.
  plugins: ['unicorn', 'typescript', 'oxc', 'import'],
  jsPlugins: ['eslint-plugin-solid', './lint/bica.js'],
  ignorePatterns: ['**/*.gen.*', '**/dist', '**/node_modules'],
  settings: solidV2.settings,
  rules: {
    'bica/top-level-functions': 'error',
  },
  overrides: [
    {
      // The Solid app and site. The token rules check the type scale, radii,
      // and colors of the Solid app's own design (docs/UI.md).
      files: ['packages/client/**', 'packages/site/**'],
      rules: {
        ...solidV2.rules,
        // Pierre's `subscribe` calls back on every change, like an event handler.
        'solid/reactivity': [
          'warn',
          { customReactiveFunctions: ['subscribe'] },
        ],
        'bica/type-tokens': 'error',
        'bica/radius-tokens': 'error',
        'bica/color-tokens': 'error',
      },
    },
    {
      // The React mock, on BoardUI's tokens instead (packages/web/README.md).
      files: ['packages/web/**'],
      plugins: ['unicorn', 'typescript', 'oxc', 'import', 'react'],
      rules: {
        'react/rules-of-hooks': 'error',
        'react/exhaustive-deps': 'warn',
        'react/jsx-key': 'error',
      },
    },
    {
      // Features import each other freely, so a cycle is the one mistake left
      // in the layout (docs/architecture.md).
      files: ['packages/client/**', 'packages/server/**', 'packages/shared/**'],
      rules: { 'import/no-cycle': ['error', { ignoreTypes: true }] },
    },
    { files: ['packages/server/**'], rules: { 'bica/git-commands': 'error' } },
  ],
  options: {
    typeAware: true,
    typeCheck: true,
  },
});
