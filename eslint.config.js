import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/.turbo/**",
      "supabase/**",
      "**/*.d.ts",
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules for .ts/.tsx
  ...tseslint.configs.recommended,

  // Next.js + React rules scoped to apps/web
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "@next/next/no-html-link-for-pages": ["error", "apps/web/app"],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Prettier last to disable formatting rules
  eslintConfigPrettier,
];
