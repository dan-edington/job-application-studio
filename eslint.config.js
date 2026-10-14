import tsParser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';

const functionVariable = {
  selector:
    'VariableDeclaration[declarations.length=1][declarations.0.init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'data/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@stylistic': stylistic },
    // Prettier handles layout. ESLint only adds the function spacing it preserves.
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: '*', next: functionVariable },
        { blankLine: 'always', prev: functionVariable, next: '*' },
      ],
      '@stylistic/lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'always', prev: 'method', next: '*' },
          ],
        },
      ],
    },
  },
];
