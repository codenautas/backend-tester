module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: ["tsconfig-common.json"]
    },
    plugins: ['@typescript-eslint'],
    root: true,
    rules: {
        "no-unused-vars": ["error", { "argsIgnorePattern": "_\\w*" }],
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "_\\w*" }],
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/return-await": "error"
    }
};