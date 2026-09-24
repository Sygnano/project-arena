import { globalIgnores } from "eslint/config";
import { next } from "@arena/eslint-config/next";

const config = [
  ...next,
  // Third-party source copied in as-is (see src/vendor/*/README.md).
  globalIgnores(["src/vendor/**"]),
];

export default config;
