import { fixupPluginRules } from "@eslint/compat";
import eslint from "@eslint/js";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import tseslint from "typescript-eslint";

// eslint-plugin-react still uses context APIs removed in ESLint 10; wrap it until it ships native support.
const reactPlugin = fixupPluginRules(pluginReact);

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const baseConfig = defineConfig({
  extends: [eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  },
});

const reactConfig = defineConfig({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [eslintPluginReactHooks.configs.flat["recommended-latest"]],
  plugins: { react: reactPlugin },
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      window: true,
      document: true,
    },
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...pluginReact.configs.flat.recommended.rules,
    "react/react-in-jsx-scope": "off",
  },
});

// eslint-plugin-astro's jsx-a11y config covers .astro files only; this gives the React views the same rules.
// eslint-plugin-jsx-a11y ships no type declarations, so its config is typed here by hand.
/** @type {import("eslint").Linter.Config} */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- untyped plugin, see above
const jsxA11yRecommended = jsxA11y.flatConfigs.recommended;
const jsxA11yConfig = defineConfig({ ...jsxA11yRecommended, files: ["**/*.tsx"] });

// The hardcoded-value scan as a lint rule, pinned to the views on the design-system contract.
// Each pattern is checked in string literals (className values included) and template literal text.
const literalValuePatterns = [
  // A hex colour as the whole string or after "[", "(", ":" or ",", so prose such as "Task #123" passes.
  String.raw`(^|[\[(:,])#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b`,
  String.raw`\b(rgba?|hsla?|hwb|(ok)?lab|(ok)?lch|color)\(`,
  // Any arbitrary value (w-[50%], bg-[var(--x)], grid-cols-[…]); variants such as data-[state=open]: end in ":" and pass.
  String.raw`-\[[^\]]+\](?!:)`,
  String.raw`\b(bg|text|border(-[xytrblse])?|ring(-offset)?|inset-ring|outline|from|via|to|fill|stroke|shadow|inset-shadow|divide|decoration|accent|caret|placeholder)-(slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b`,
];
const literalValueMessage =
  "Use a token class from src/styles/global.css instead of a literal colour, palette class or arbitrary value (PROJECT_RULES.md → UI).";
const plannerLiteralValuesConfig = defineConfig({
  files: ["src/components/planner/**/*.{ts,tsx,astro}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      ...literalValuePatterns.flatMap((pattern) => [
        { selector: `Literal[value=/${pattern}/]`, message: literalValueMessage },
        { selector: `TemplateElement[value.raw=/${pattern}/]`, message: literalValueMessage },
      ]),
      // Inline styles bypass the tokens, and React sets them through the CSSOM, out of the CSP's reach.
      { selector: "JSXAttribute[name.name='style']", message: literalValueMessage },
    ],
  },
});

const astroConfig = defineConfig({
  files: ["**/*.astro"],
  languageOptions: {
    // astro-eslint-parser does not support projectService yet and warns on every file; hand it a project path instead.
    parserOptions: { projectService: false, project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    "astro/no-set-html-directive": "error",
    "astro/no-unused-css-selector": "warn",
    "astro/prefer-class-list-directive": "warn",
  },
});

const scriptsConfig = defineConfig({
  files: ["scripts/**/*.mjs"],
  extends: [tseslint.configs.disableTypeChecked],
  languageOptions: { globals: { console: true, process: true, fetch: true, URLSearchParams: true } },
  rules: { "no-console": "off" },
});

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  baseConfig,
  reactConfig,
  jsxA11yConfig,
  eslintPluginAstro.configs["flat/recommended"],
  eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
  astroConfig,
  plannerLiteralValuesConfig,
  scriptsConfig,
  eslintPluginPrettier,
);
