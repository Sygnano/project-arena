import { globalIgnores } from "eslint/config";
import { architecture, next } from "@arena/eslint-config/next";

const config = [
  ...next,
  ...architecture(import.meta.dirname),
  // Third-party source copied in as-is (see src/vendor/*/README.md).
  globalIgnores(["src/vendor/**"]),
];

export default config;
