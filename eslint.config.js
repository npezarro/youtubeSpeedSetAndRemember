import globals from "globals";

export default [
  {
    files: ["core.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.es2021,
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["script.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        GM_getValue: "readonly",
        GM_setValue: "readonly",
        GM_addStyle: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["core.test.js", "vitest.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ["node_modules/"],
  },
];
