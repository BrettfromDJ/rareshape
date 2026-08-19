import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * The layer rule is the important part of this file. A tool is a param schema
 * plus a pure render function; if a render function can reach React or the
 * export pipeline, that promise quietly stops being true and ejecting to
 * standalone HTML breaks. See TOOL_SPEC.md §2.
 */
const LAYER_RULE = {
  files: ['tools/**/*.ts', 'tools/**/*.tsx'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'react', message: 'Tools are framework-free. render.ts may import @rareshape/core only.' },
          { name: 'react-dom', message: 'Tools are framework-free.' },
          { name: 'next', message: 'Tools are framework-free.' },
          { name: '@rareshape/kit', message: 'The kit consumes tools, never the other way round.' },
          { name: '@rareshape/export', message: 'Export is applied to a tool, never imported by one.' },
          { name: '@rareshape/eject', message: 'Eject is applied to a tool, never imported by one.' },
        ],
        patterns: [
          { group: ['react/*', 'next/*', 'react-dom/*'], message: 'Tools are framework-free.' },
          { group: ['@rareshape/kit/*', '@rareshape/export/*', '@rareshape/eject/*'], message: 'Layer violation.' },
          { group: ['@/*'], message: 'Tools may not reach into the app. Keep them self-contained.' },
          { group: ['../*'], message: 'Tools may not import from other tools.' },
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      { name: 'window', message: 'Render functions must be pure — no DOM. See TOOL_SPEC.md §5.' },
      { name: 'document', message: 'Render functions must be pure — no DOM.' },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
        message: 'Use frame.rng — Math.random breaks determinism. See TOOL_SPEC.md §5.',
      },
      {
        selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
        message: 'Render functions have no clock. Use frame.t.',
      },
      {
        selector: "NewExpression[callee.name='Date']",
        message: 'Render functions have no clock. Use frame.t.',
      },
      {
        selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
        message: 'Render functions have no clock. Use frame.t.',
      },
    ],
  },
}

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['out/**', '.next/**', 'node_modules/**', 'registry.generated.ts', 'public/**'],
  },
  LAYER_RULE,
]

export default config
