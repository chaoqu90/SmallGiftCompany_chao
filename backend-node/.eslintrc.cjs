/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Allow explicit any in limited cases during migration
    '@typescript-eslint/no-explicit-any': 'warn',
    // Require explicit return types on functions (helps catch type errors early)
    '@typescript-eslint/explicit-function-return-type': 'off',
    // No unused variables
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.cjs'],
};
