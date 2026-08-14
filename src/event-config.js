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
  eventName: "World of Warships",
  eventYear: 2026,
  appTitle: "Holiday Convoy Forecast",
  appSubtitle:
    "Estimate Convoy Tokens, compare reward costs, and save or share different what-if Scenarios before committing valuable resources in game.",

  /**
   * Event schedule and official information
   *
   * All event timestamps use ISO 8601 UTC.
   *
   * IMPORTANT:
   * The regional timestamps below are PLACEHOLDERS until the official
   * server-specific Holiday Convoy schedule is confirmed.
   */
  eventInfo: {
    defaultRegion: "na",

    regions: {
      na: {
        label: "NA",
        earnStart: "2026-08-12T10:00:00Z",
        earnEnd: "2027-02-01T08:00:00Z",
        spendEnd: "2027-02-10T08:00:00Z",
      },

      eu: {
        label: "EU",
        earnStart: "2026-08-13T03:00:00Z",
        earnEnd: "2027-02-02T01:00:00Z",
        spendEnd: "2027-02-11T01:00:00Z",
      },

      asia: {
        label: "ASIA",
        earnStart: "2026-08-12T20:00:00Z",
        earnEnd: "2027-02-01T19:00:00Z",
        spendEnd: "2027-02-10T19:00:00Z",
      },
    },

    eventPageUrl:
      "https://blog.worldofwarships.com/blog/holiday-convoy-sets-sail",
  },

  /**
   * Shared normalized Wargaming data.
   *
   * The Pages URL is preferred. The raw GitHub URL is a fallback while Pages
   * is unavailable or being configured.
   */
  shipData: {
    urls: [
      "https://heykrystal.github.io/wows-shared-data/public/v1/ships.json",
      "https://raw.githubusercontent.com/HeyKrystal/wows-shared-data/main/public/v1/ships.json",
    ],
    requestTimeoutMs: 8000,
  },

  /**
   * Resource conversion rules
   *
   * sourceRate: Amount of the resource required for one exchange.
   * targetTokens: Tokens received for one exchange.
   * cap: Maximum total amount of this resource that may be counted.
   *      Use null when there is no cap.
   * showCappedLeftover: Set to false for capped non-resource activities,
   *      such as missions, that should not appear in resource leftovers.
   * tooltip: Optional explanatory text shown from the resource badge in the
   *      Token Exchange Rates table.
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
      label: "Daily Mission Sets",
      sourceRate: 1,
      targetTokens: 1200,
      cap: 173,
      showCappedLeftover: false,
      color: "#3f6f2a",
      accent: "#dcebd4",
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
    {
      id: "convoy-tokens",
      label: "Owned Tokens",
      sourceRate: 1,
      targetTokens: 1,
      cap: null,
      color: "#7a5a14",
      accent: "#f4e7b2",
      tooltip: "Not an exchange rate, just available in case you want to include your already exchanged token balance below.",
    },
  ],

  /**
   * Rows shown upon a scenario reset.
   * This is just for debugging now.
   */
  defaultSources: [
    {
      id: "default-daily-missions",
      name: "Mission Set Completion Goal",
      resourceId: "daily-missions",
      value: 120,
      included: true,
    },
  ],

  /**
   * First-run example Scenarios
   *
   * These are created only when no saved Scenario library exists for this
   * eventId. Existing users and migrated saves are never modified.
   * Values are based on examples from the official event announcement.
   */
  starterScenarios: [
    {
      name: "Casual Example",
      sources: [
        {
          id: "starter-casual-missions",
          name: "Expected Daily Mission Sets",
          resourceId: "daily-missions",
          value: 50,
          included: true,
        },
        {
          id: "starter-casual-coal",
          name: "Planned Coal Exchange",
          resourceId: "coal",
          value: 30000,
          included: true,
        },
      ],
      rewardSelections: {
        "bismarck-41": {
          quantity: 1,
          included: true,
        },
        "doubloons-3000": {
          quantity: 1,
          included: true,
        },
      },
    },
    {
      name: "Consistent Example",
      sources: [
        {
          id: "starter-consistent-missions",
          name: "Expected Daily Mission Sets",
          resourceId: "daily-missions",
          value: 120,
          included: true,
        },
        {
          id: "starter-casual-coal",
          name: "Planned Coal Exchange",
          resourceId: "coal",
          value: 180000,
          included: true,
        },
      ],
      rewardSelections: {
        "bismarck-41": {
          quantity: 1,
          included: true,
        },
        "yimeng": {
          quantity: 1,
          included: true,
        },
        "doubloons-3000": {
          quantity: 4,
          included: true,
        },
      },
    },
    {
      name: "Dedicated Example",
      sources: [
        {
          id: "starter-dedicated-missions",
          name: "All Daily Mission Sets",
          resourceId: "daily-missions",
          value: 173,
          included: true,
        },
        {
          id: "starter-dedicated-coal",
          name: "Maximum Coal Exchange",
          resourceId: "coal",
          value: 650000,
          included: true,
        },
        {
          id: "starter-dedicated-steel",
          name: "Planned Steel Exchange",
          resourceId: "steel",
          value: 40000,
          included: true,
        },
        {
          id: "starter-dedicated-research-points",
          name: "Planned RP Exchange",
          resourceId: "research-points",
          value: 88000,
          included: true,
        },
      ],
      rewardSelections: {
        "bismarck-41": {
          quantity: 1,
          included: true,
        },
        "prinz-van-oranje": {
          quantity: 1,
          included: true,
        },
        "new-jersey": {
          quantity: 1,
          included: true,
        },
        "doubloons-3000": {
          quantity: 6,
          included: true,
        },
      },
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
      shipId: "3552524080",
      rarity: "rare",
      availability: "Update 15.7",
      tokenCost: 60000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "yimeng",
      name: "Yimeng",
      shipId: "3540989136",
      rarity: "rare",
      availability: "Update 15.7",
      tokenCost: 84000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "messina",
      name: "Messina",
      shipId: "3530471152",
      rarity: "rare",
      availability: "Update 15.7",
      tokenCost: 84000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "independencia",
      name: "Independencia",
      shipId: "3550459216",
      rarity: "rare",
      availability: "Update 15.7",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "prinz-van-oranje",
      name: "Prinz van Oranje",
      shipId: "3550394128",
      rarity: "rare",
      availability: "Update 15.7",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "georg-hoffmann",
      name: "Georg Hoffmann",
      shipId: "3550361392",
      rarity: "rare",
      availability: "Update 15.7",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "kitakami",
      name: "Kitakami",
      shipId: "3655251664",
      rarity: "legendary",
      availability: "Update 15.7",
      tokenCost: 540000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,
    },
    {
      id: "new-jersey",
      name: "New Jersey",
      shipId: null,
      rarity: "epic",
      availability: "Update 15.11",
      tokenCost: 400000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,

      details: {
        image: "images/rewards/new-jersey.webp",
        description:
          "Complete ship details will become available once they have been published on Wargaming API.",

        facts: [
          {
            label: "Nation",
            value: "United States",
          },
          {
            label: "Type",
            value: "Battleship",
          },
          {
            label: "Tier",
            value: "X",
          },
        ],
      },
    },
    {
      id: "unannounced-rare-ship-2",
      name: "Rodina",
      shipId: null,
      rarity: "rare",
      availability: "Update 15.11",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,

      details: {
        image: "images/rewards/rodina.webp",
        description:
          "Complete ship details will become available once they have been published on Wargaming API.",

        facts: [
          {
            label: "Nation",
            value: "U.S.S.R.",
          },
          {
            label: "Type",
            value: "Battleship",
          },
          {
            label: "Tier",
            value: "X",
          },
        ],
      },
    },
    {
      id: "unannounced-rare-ship-3",
      name: "Tōgasa",
      shipId: null,
      rarity: "rare",
      availability: "Update 15.11",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,

      details: {
        image: "images/rewards/togasa.webp",
        description:
          "Complete ship details will become available once they have been published on Wargaming API.",

        facts: [
          {
            label: "Nation",
            value: "Japan",
          },
          {
            label: "Type",
            value: "Battleship",
          },
          {
            label: "Tier",
            value: "X",
          },
        ],
      },
    },
    {
      id: "unannounced-rare-ship-4",
      name: "Tréville",
      shipId: null,
      rarity: "rare",
      availability: "Update 15.11",
      tokenCost: 140000,
      maxQuantity: 1,
      category: "Ship",
      defaultQuantity: 1,
      defaultIncluded: false,

      details: {
        image: "images/rewards/latouche-skadoosh.webp",
        description:
          "Complete ship details will become available once they have been published on Wargaming API.",

        facts: [
          {
            label: "Nation",
            value: "France",
          },
          {
            label: "Type",
            value: "Cruiser",
          },
          {
            label: "Tier",
            value: "X",
          },
        ],
      },
    },
    {
      id: "doubloons-3000",
      name: "3,000 Doubloon Pack",
      availability: "Update 15.7 through 16.0",
      tokenCost: 9000,
      maxQuantity: 6,
      category: "Doubloons",
      defaultQuantity: 6,
      defaultIncluded: false,

      details: {
        description:
          "One bundle of 3,000 Doubloons will during each of the six updates.",

        facts: [
          {
            label: "Contents",
            value: "3,000 Doubloons",
          },
          {
            label: "Purchase limit",
            value: "One per eligible update",
          },
        ],
      },
    },
  ],
};
