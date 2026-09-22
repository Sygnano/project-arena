# nivo-calendar (vendored subset)

The `TimeRange` chart from [`@nivo/calendar`](https://github.com/plouc/nivo/tree/master/packages/calendar)
0.99.0, copied here as source with our fix applied, used by the summoner page's activity calendar
(`src/modules/TimePlayed/Calendar.tsx`). MIT licensed, see `LICENSE.md`.

## Why a copy

Upstream `TimeRange` ignores its `align` prop, so the day grid always renders flush top-left
and leaves uncentered dead space when `square` cells are bound by one axis. `computeOrigin` in
`compute/timeRange.ts` fixes that, mirroring `Calendar`'s own `alignBox` layout. It also fixes
an off-by-one in `computeMonthLegends` that left a blank column between adjacent month labels.
Before this copy, the fix lived in a fork (`vendor/nivo`, github.com/Sygnano/nivo) consumed as a
packed tarball, which a fresh clone couldn't install.

## What was changed from upstream

- Only the files `TimeRange` needs: no `Calendar`, `CalendarCanvas` or their pieces.
- `compute/calendar.ts` and `hooks.ts` keep only `computeDomain`, `computeMonthLegendPositions`,
  `useColorScale` and `useMonthLegends`.
- lodash's `isDate` became `instanceof Date` (the one lodash use left).
- Two type fixes for our stricter settings: `textAnchor="left"` (not a valid SVG value, so
  browsers already rendered it as the default `start`) is now `start`, and `computeDomain`'s map
  callback is annotated.
- The `align` and month-legend fixes above.

Its nivo dependencies (`@nivo/core`, `theming`, `legends`, `text`, `tooltip`) are pinned to the
same version as the other `@nivo/*` charts in `apps/web/package.json`; keep them in step.
