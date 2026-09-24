# @arena/eslint-config

The ESLint setup every package in the repo lints with (Turborepo's recommended layout: one shared
config package, one small `eslint.config.mjs` per package, `lint` run per package so Turborepo
caches it per package). ESLint 10, flat config.

| Export | For |
|---|---|
| `@arena/eslint-config/base` | TypeScript on Node: apps/api, apps/riot-gateway, packages/* |
| `@arena/eslint-config/next` | apps/web: Next's own presets, wrapped for ESLint 10 |

A package's config:

```js
import { base } from "@arena/eslint-config/base";

export default base;
```

It adds its own ignores or rules after the profile when it needs them (apps/web ignores its
vendored nivo copy). A package that lints lists `@arena/eslint-config` and `eslint` in its
devDependencies and has `"lint": "eslint ."`.

Both profiles end with `eslint-config-prettier`: formatting is Prettier's (one config at the repo
root, `pnpm format`), never ESLint's.
