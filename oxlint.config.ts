import { defineConfig } from 'oxlint';
import solidV2 from 'eslint-plugin-solid/configs/v2';

export default defineConfig({
  // Oxlint's defaults plus import, which no-cycle below needs on at the top.
  plugins: ['unicorn', 'typescript', 'oxc', 'import'],
  jsPlugins: ['eslint-plugin-solid', './lint/bica.js'],
  ignorePatterns: ['**/*.gen.*', '**/dist', '**/node_modules'],
  settings: solidV2.settings,
  rules: {
    ...solidV2.rules,
    // Pierre's `subscribe` calls back on every change, like an event handler.
    'solid/reactivity': ['warn', { customReactiveFunctions: ['subscribe'] }],
    'bica/type-tokens': 'error',
    'bica/radius-tokens': 'error',
    'bica/color-tokens': 'error',
    'bica/top-level-functions': 'error',
  },
  overrides: [
    {
      // Features import each other freely, so a cycle is the one mistake left
      // in the layout (docs/architecture.md).
      files: ['client/**', 'server/**', 'shared/**'],
      rules: { 'import/no-cycle': ['error', { ignoreTypes: true }] },
    },
    { files: ['server/**'], rules: { 'bica/git-commands': 'error' } },
  ],
  options: {
    typeAware: true,
    typeCheck: true,
  },
});
