import js from "@eslint/js";
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        chrome: "readonly",
        browser: "readonly",
        NodeFilter: "readonly",
        document: "readonly",
        location: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "args": "none" }],
      "no-undef": "off",
      "no-console": "warn"
    },
    ignores: ["node_modules/**", "dist/**", "*.min.js"]
  }
];
