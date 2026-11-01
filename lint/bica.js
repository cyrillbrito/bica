import { definePlugin, defineRule } from '@oxlint/plugins';

// The type scale lives in client/src/App.css (@theme). Tailwind's own sizes and
// families are removed there, so they would silently do nothing; raw sizes
// would bypass the scale. Both fail here. See docs/UI.md, Tokens.
const REMOVED =
  /(?:^|[\s:'"`])(text-(?:xs|sm|base|lg|[2-9]?xl)|font-(?:sans|serif))(?=$|[\s'"`])/;
const RAW = /(?:^|[\s:'"`])((?:text|font)-\[[^\]]*\])/;

function check(context, node, value) {
  if (typeof value !== 'string') return;
  const removed = REMOVED.exec(value);
  if (removed) {
    context.report({
      node,
      messageId: 'removed',
      data: { cls: removed[1] },
    });
  }
  const raw = RAW.exec(value);
  // Colors like text-[var(--x)] are fine; em keeps markdown headings relative.
  if (raw && /\d(px|rem)?\]$|font-\[/.test(raw[1])) {
    context.report({ node, messageId: 'raw', data: { cls: raw[1] } });
  }
}

const typeTokens = defineRule({
  meta: {
    messages: {
      removed:
        '`{{cls}}` is not part of the type scale. Use text-meta, text-ui, text-code, text-read, text-display or font-ui, font-reading, font-mono.',
      raw: '`{{cls}}` bypasses the type scale. Use a role token from App.css @theme.',
    },
  },
  create(context) {
    return {
      Literal: (node) => check(context, node, node.value),
      TemplateElement: (node) => check(context, node, node.value.cooked),
    };
  },
});

// Radii are trimmed the same way (client/src/App.css @theme): Tailwind's other sizes
// do nothing, and raw ones break the set.
const RADIUS =
  /(?:^|[\s:'"`])(rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?(?:-([\w[\].%-]+))?)(?=$|[\s'"`])/g;
const RADII = new Set([
  'sm',
  'md',
  'lg',
  'card',
  'sheet',
  'tray',
  'cell',
  'full',
  'none',
]);

function checkRadius(context, node, value) {
  if (typeof value !== 'string') return;
  for (const m of value.matchAll(RADIUS)) {
    if (!RADII.has(m[2])) {
      context.report({ node, messageId: 'radius', data: { cls: m[1] } });
    }
  }
}

const radiusTokens = defineRule({
  meta: {
    messages: {
      radius:
        '`{{cls}}` is not part of the radius set. Use rounded-sm, -md, -lg (controls), -card, -sheet, -tray (surfaces), -cell (meter cells), -full or -none.',
    },
  },
  create(context) {
    return {
      Literal: (node) => checkRadius(context, node, node.value),
      TemplateElement: (node) => checkRadius(context, node, node.value.cooked),
    };
  },
});

// The server runs git only from server/src/git/commands.ts, so every git
// command reads in one place, typed. Tests set up their repos with raw git.
const gitCommands = defineRule({
  meta: {
    messages: {
      raw: 'Run git through a function in server/src/git/commands.ts, not here.',
    },
  },
  create(context) {
    const file = context.filename;
    if (/git\/commands\.ts$|\.test\.ts$|\/testing\//.test(file)) return {};
    return {
      // Bun.spawn(['git', ...]) and the like.
      ArrayExpression(node) {
        const first = node.elements[0];
        if (first?.type === 'Literal' && first.value === 'git')
          context.report({ node, messageId: 'raw' });
      },
      // Bun Shell: $`git ...`.
      TaggedTemplateExpression(node) {
        if (/^\s*git(\s|$)/.test(node.quasi.quasis[0].value.cooked))
          context.report({ node, messageId: 'raw' });
      },
    };
  },
});

// A named function at the top of a file reads as one: `function x()`, not
// `const x = () =>`. A type on the constant is the real need for an arrow, as
// it types the parameters; nested arrows are fine.
const topLevelFunctions = defineRule({
  meta: {
    fixable: 'code',
    messages: {
      declaration:
        'Write top-level `{{name}}` as `function {{name}}()`, not as a constant.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    function toDeclaration(name, arrow) {
      const between = source.text.slice(arrow.range[0], arrow.body.range[0]);
      let head = between.replace(/\s*=>\s*\(?\s*$/, '');
      if (arrow.async) head = head.replace(/^async\s*/, '');
      if (!/^[(<]/.test(head)) head = `(${head})`;
      const body =
        arrow.body.type === 'BlockStatement'
          ? source.getText(arrow.body)
          : `{\nreturn ${source.getText(arrow.body)};\n}`;
      const async = arrow.async ? 'async ' : '';
      return `${async}function ${name}${head} ${body}`;
    }
    return {
      VariableDeclaration(node) {
        const parent = node.parent;
        const top =
          parent.type === 'Program' ||
          (parent.type === 'ExportNamedDeclaration' &&
            parent.parent.type === 'Program');
        if (!top || node.kind !== 'const') return;
        for (const declarator of node.declarations) {
          const init = declarator.init;
          if (
            !init ||
            declarator.id.type !== 'Identifier' ||
            declarator.id.typeAnnotation ||
            (init.type !== 'ArrowFunctionExpression' &&
              init.type !== 'FunctionExpression')
          )
            continue;
          const name = declarator.id.name;
          const fixable =
            init.type === 'ArrowFunctionExpression' &&
            node.declarations.length === 1;
          context.report({
            node: declarator,
            messageId: 'declaration',
            data: { name },
            fix: fixable
              ? (fixer) => fixer.replaceText(node, toDeclaration(name, init))
              : undefined,
          });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: 'bica' },
  rules: {
    'type-tokens': typeTokens,
    'radius-tokens': radiusTokens,
    'top-level-functions': topLevelFunctions,
    'git-commands': gitCommands,
  },
});
