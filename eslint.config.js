import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'types/', 'node_modules/', 'coverage/', 'out/', 'docs/app/lib/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-control-regex': 'off',
    },
  },
];
