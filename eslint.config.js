import js from "@eslint/js";

const ignoredPaths = [
  "node_modules/**",
  "dist/**",
  "coverage/**",
  "bmad-method/**",
  "**/bmad-method/**",
  "scripts/**",
  "*.min.js",
  "mini-translate*.zip"
];

export default [
  { ignores: ignoredPaths },
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
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  }
];
