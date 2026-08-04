/**
 * Holiday Convoy event data
 *
 * This is the main file to update when a new Holiday Convoy event begins.
 * The application logic reads resource rules, rewards, limits, labels, and
 * starter rows from this object.
 */
window.HOLIDAY_CONVOY_CONFIG = {
  schemaVersion: 1,
  eventId: "holiday-convoy-2026",
  eventName: "Holiday Convoy",
  eventYear: 2026,
  appTitle: "Holiday Convoy Forecast",
  appSubtitle:
    "Forecast your Holiday Convoy token budget, account for multiple outcomes, and plan your rewards before committing resources.",

  /**
   * Resource conversion rules
   *
   * sourceRate: Amount of the resource required for one exchange.
   * targetTokens: Tokens received for one exchange.
   * cap: Maximum total amount of this resource that may be counted.
   *      Use null when there is no cap.
   */
  resources: [
    {
      id: "coal",
      label: "Coal",
      sourceRate: 5000,
      targetTokens: 1500,
      cap: 650000,
      color: "#334e68",
      accent: "#d9e2ec",
    },
    {
      id: "daily-missions",
      label: "Daily Missions",
      sourceRate: 1,
      targetTokens: 1200,
      cap: 173,
      color: "#416614",
      accent: "#d5e4d5",
    },
    {
      id: "research-points",
      label: "Research Points",
      sourceRate: 1000,
      targetTokens: 1500,
      cap: null,
      color: "#7c3f00",
      accent: "#ffe8cc",
    },
    {
      id: "steel",
      label: "Steel",
      sourceRate: 500,
      targetTokens: 1500,
      cap: null,
      color: "#3d4852",
      accent: "#e4e7eb",
    },
  ],

  /**
   * Rows shown the first time the app is opened for this eventId.
   * Keep this list generic so it works for any player.
   */
  defaultSources: [
    {
      id: "default-current-coal",
      name: "Current Coal",
      resourceId: "coal",
      value: 123456,
      included: true,
    },
    {
      id: "default-projected-coal-1",
      name: "Coal Goal for 15.7 - 15.10",
      resourceId: "coal",
      value: 234000,
      included: true,
    },
    {
      id: "default-daily-missions",
      name: "Mission Completion Goal",
      resourceId: "daily-missions",
      value: 100,
      included: true,
    },
  ],

  /**
   * Reward catalog
   *
   * maxQuantity controls the largest quantity a user can select.
   * Use 1 for one-time ships and a larger number for repeatable rewards.
   * The values below were transcribed from the supplied workbook.
   */
  rewards: [
    {
      id: "bismarck-41",
      name: "Bismarck '41",
      tokenCost: 64000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "yimeng",
      name: "Yimeng",
      tokenCost: 84000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "messina",
      name: "Messina",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "independencia",
      name: "Independencia",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "prins-van-oranje",
      name: "Prins van Oranje",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "georg-hoffmann",
      name: "Georg Hoffmann",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "kitakami",
      name: "Kitakami",
      tokenCost: 540000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "unannounced-epic-ship",
      name: "Unannounced Ship 1 (New Jersey)",
      tokenCost: 400000,
      maxQuantity: 1,
      category: "Placeholder",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "unannounced-rare-ship-1",
      name: "Unannounced Ship 2",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Placeholder",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "unannounced-rare-ship-2",
      name: "Unannounced Ship 3",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Placeholder",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "unannounced-rare-ship-3",
      name: "Unannounced Ship 4",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Placeholder",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "doubloons-3000",
      name: "3,000 Doubloons",
      tokenCost: 9000,
      maxQuantity: 6,
      category: "Doubloons",
      defaultQuantity: 6,
      defaultIncluded: false,
    },
  ],
};
