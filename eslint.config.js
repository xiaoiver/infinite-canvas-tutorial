import js from '@eslint/js';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  // 忽略的文件和目录（从 .eslintignore 迁移）
  {
    ignores: [
      'coverage/**',
      'es/**',
      'lib/**',
      'dist/**',
      'node_modules/**',
      'examples/**',
      'rust/**',
      '__tests__/**',
      'packages/site/docs/.vitepress/**',
      'packages/app/**', // app 包有自己的 eslint.config.mjs
    ],
  },
  
  // 基础推荐配置
  js.configs.recommended,
  
  // 全局配置
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        window: 'readonly',
        document: 'readonly',
        module: 'readonly',
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      // TypeScript ESLint 推荐规则（手动配置，因为 v6 可能不支持 flat config 的 configs）
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/ban-ts-comment': 'off', // 覆盖为 off
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'off', // 覆盖为 off
      '@typescript-eslint/no-empty-function': 'off', // 覆盖为 off
      '@typescript-eslint/no-empty-interface': 'off', // 覆盖为 off
      '@typescript-eslint/no-explicit-any': 'off', // 覆盖为 off
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      'no-fallthrough': 'off',
      'no-empty': 'off',
      'no-param-reassign': 'off',
      'no-redeclare': 'off',
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'no-constant-condition': 'off',
      // 覆盖 TypeScript ESLint 规则
      '@typescript-eslint/no-restricted-types': 'error',
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/no-invalid-this': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, classes: false },
      ],
      '@typescript-eslint/no-redeclare': ['error'],
    },
  },
];

