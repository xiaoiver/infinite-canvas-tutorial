import js from '@eslint/js';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

const typescriptRules = {
  ...tseslintPlugin.configs.recommended.rules,
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-namespace': 'off',
  '@typescript-eslint/no-duplicate-enum-values': 'off',
  '@typescript-eslint/no-unused-expressions': [
    'error',
    { allowShortCircuit: true, allowTernary: true },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'none',
      ignoreRestSiblings: true,
      caughtErrors: 'none',
      varsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-use-before-define': [
    'error',
    { functions: false, classes: false, variables: false },
  ],
  '@typescript-eslint/no-redeclare': 'error',
  // TypeScript performs name resolution; the core rule misreports type-only names.
  'no-undef': 'off',
  'no-unused-vars': 'off',
  'no-redeclare': 'off',
};

export default [
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    ignores: [
      '**/node_modules/**',
      '**/esm/**',
      'packages/*/lib/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.next/**',
      '**/vendor/**',
      '.test-results/**',
      'test-results/**',
      'playwright-report/**',
      'playwright/.cache/**',
      'blob-report/**',
      'rust/**',
      'packages/site/docs/.vitepress/cache/**',
      'packages/site/docs/.vitepress/dist/**',
      // This application owns a separate ESLint configuration.
      'packages/app/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue'].map(
      (ext) => `**/*.${ext}`,
    ),
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-empty': 'off',
      'no-fallthrough': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'off',
      'no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
  {
    files: ['ts', 'tsx', 'vue'].map((ext) => `**/*.${ext}`),
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslintPlugin },
    rules: typescriptRules,
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsparser, extraFileExtensions: ['.vue'] },
    },
  },
  {
    files: [
      '**/*.cjs',
      '**/*.mjs',
      '**/*.config.js',
      '**/*.config.ts',
      'scripts/**/*.js',
      'scripts/**/*.ts',
      '__tests__/**/*.js',
      '__tests__/**/*.ts',
      '__tests__/**/*.tsx',
      'packages/ecs/src/systems/SetupDevice.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      '__tests__/**/*.js',
      '__tests__/**/*.ts',
      '__tests__/**/*.tsx',
    ],
    languageOptions: { globals: globals.jest },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-loss-of-precision': 'off',
    },
  },
  {
    files: ['**/examples/**/*.js', '**/examples/**/*.ts', '**/examples/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
];
