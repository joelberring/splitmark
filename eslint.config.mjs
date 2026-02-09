import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local scripts / utilities (not part of app bundle):
    "simulate_race.js",
    "jest.config.js",
    "jest.setup.js",
  ]),
  {
    rules: {
      // The codebase is still evolving; allow pragmatic typing during iteration.
      "@typescript-eslint/no-explicit-any": "off",
      // Not worth blocking deploys over JSX quote escaping.
      "react/no-unescaped-entities": "off",
      // These React 19-era lint rules are noisy for this codebase right now.
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
