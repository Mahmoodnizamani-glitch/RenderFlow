/** @type {import('eslint').Linter.Config} */
module.exports = {
    extends: ['../../.eslintrc.js'],
    plugins: ['react-hooks'],
    rules: {
        // React Native legitimately uses require() for images, lazy loading, and test mocks
        '@typescript-eslint/no-require-imports': 'off',
    },
    overrides: [
        {
            files: ['**/*.tsx'],
            rules: {
                'react-hooks/rules-of-hooks': 'error',
                'react-hooks/exhaustive-deps': 'warn',
            },
        },
    ],
};
