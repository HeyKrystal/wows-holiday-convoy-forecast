# Holiday Convoy Budget Planner

A small, dependency-free web app for planning a World of Warships Holiday Convoy token budget. Add expected resources, pool conversion remainders, and compare your token budget against the rewards you want.

> [!NOTE]
> The initial 2026 conversion rates, caps, rewards, and costs were transcribed from the supplied `Holiday Convoy Budget.xlsx` workbook. Review `event-config.js` before publishing the planner publicly.

## Quick Start

1. Extract the ZIP file.
2. Open `index.html` in a modern browser.
3. Edit the starter source rows or add your own.
4. Select planned rewards and quantities.

No server, build step, package manager, or internet connection is required.

## Features

- [x] Add, edit, include, or remove token-source rows
- [x] Resource dropdown generated from yearly event configuration
- [x] Per-row token estimates with tight single-line descriptions
- [x] Pooled resource remainders that can create bonus exchanges
- [x] Coal and Daily Mission caps enforced across all included rows
- [x] Reward quantities limited by configurable maximums
- [x] Sticky totals panel on desktop and normal summary panel on mobile
- [x] Automatic browser saving with `localStorage`
- [x] JSON export and import for backups or moving between devices
- [x] Responsive layout with no external libraries

## Updating the Event Next Year

Most yearly maintenance is isolated in [`event-config.js`](event-config.js).

Update these top-level values:

```js
schemaVersion: 1,
eventId: "holiday-convoy-2027",
eventName: "Holiday Convoy",
eventYear: 2027,
```

Then update the two data lists:

### Resource conversions

```js
{
  id: "coal",
  label: "Coal",
  sourceRate: 5000,
  targetTokens: 1500,
  cap: 650000,
  color: "#334e68",
  accent: "#d9e2ec",
}
```

- `sourceRate`: Resource required for one exchange
- `targetTokens`: Tokens awarded for one exchange
- `cap`: Maximum total resource counted, or `null` for no cap

### Rewards

```js
{
  id: "example-ship",
  name: "Example Ship",
  tokenCost: 140000,
  maxQuantity: 1,
  category: "Ship",
  defaultQuantity: 1,
  defaultIncluded: false,
}
```

Changing `eventId` gives the new event its own browser storage. Data from the previous event remains stored under its old ID instead of being silently overwritten.

> [!TIP]
> Keep IDs stable while correcting names or prices during the same event. Change the event ID when starting a new yearly event.

## How Resource Calculations Work

For each resource type, the planner:

1. Adds all included row values.
2. Applies the event-wide cap, when one exists.
3. Converts complete multiples within each row.
4. Pools the remainders from those rows.
5. Converts any additional complete multiples created by the pooled remainder.

This preserves useful per-row token estimates while making the total budget equivalent to converting the allowed resource amount as a combined pool.

When a cap is exceeded, countable resources are attributed to included rows from top to bottom. This only affects the per-row explanation; the final token total is independent of row order.

## Saved Data

The planner uses browser `localStorage`, not cookies.

- Data persists after closing or refreshing the page.
- Data is specific to the browser, device, and event ID.
- Clearing browser data removes the saved planner.
- Export creates a JSON backup that can be imported later.

## Project Files

```text
index.html       Page structure
event-config.js  Yearly resource rules, caps, rewards, and defaults
app.js           Calculations, rendering, saving, import, and export
styles.css       Layout, table styling, colors, and responsive behavior
README.md        Setup and maintenance notes
```

## Issues

This is an initial conversion intended for local review. Before publishing it, verify the final event costs, reward names, conversion rates, and limits against the event announcement.

## Contributing

Suggestions and corrections are welcome. Keep yearly data changes in `event-config.js` whenever possible so the calculation and interface code stay reusable.
