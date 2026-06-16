// Native flat config. eslint-config-next (16.2.9+) ships flat-config arrays
// directly, so we no longer need the legacy `@eslint/eslintrc` FlatCompat shim
// (which crashes when validating the bundled plugins' flat configs).
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    // Honour the project's `_`-prefix convention for intentionally-unused
    // bindings (e.g. ignored catch errors in the service worker).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
