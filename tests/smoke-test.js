"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextDecoder, TextEncoder } = require("node:util");

const projectRoot = path.resolve(__dirname, "..");
const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

const context = {
  console,
  localStorage,
  TextDecoder,
  TextEncoder,
  atob,
  btoa,
  window: {
    crypto: {
      randomUUID: (() => {
        let value = 0;
        return () => `test-${++value}`;
      })(),
    },
    structuredClone,
  },
};
context.window.window = context.window;
context.window.localStorage = localStorage;
context.window.TextDecoder = TextDecoder;
context.window.TextEncoder = TextEncoder;
context.window.atob = atob;
context.window.btoa = btoa;
vm.createContext(context);

for (const file of [
  "scripts/event-config.js",
  "scripts/namespace.js",
  "scripts/utils.js",
  "scripts/planner-state.js",
  "scripts/calculator.js",
  "scripts/about-ui.js",
  "scripts/scenario-store.js",
  "scripts/share.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(projectRoot, file), "utf8"), context, {
    filename: file,
  });
}

const config = context.window.HOLIDAY_CONVOY_CONFIG;
const app = context.window.HolidayConvoy;
const storageKey = `holiday-convoy-budget:${config.eventId}`;
app.plannerState.validateConfig(config);
app.aboutUI.validateEventInfo(config.eventInfo);

function getReward(id) {
  const reward = config.rewards.find((item) => item.id === id);
  if (!reward) {
    throw new Error(`Missing reward: ${id}`);
  }
  return reward;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, received ${actual}.`);
  }
}

assertEqual(getReward("bismarck-41").tokenCost, 60000, "Bismarck cost mismatch.");
assertEqual(getReward("messina").tokenCost, 84000, "Messina cost mismatch.");
assertEqual(
  getReward("prins-van-oranje").name,
  "Prinz van Oranje",
  "Prinz spelling mismatch.",
);

for (const reward of config.rewards) {
  if (typeof reward.availability !== "string" || !reward.availability.trim()) {
    throw new Error(`Reward availability is missing for ${reward.id}.`);
  }
}

const countdownStatus = app.aboutUI.getEventStatus(
  config.eventInfo,
  new Date(2026, 7, 5),
);
assertEqual(countdownStatus, "Event starts in 7 days", "Unexpected countdown.");

const encoded = app.utils.encodeBase64Url("Scenario: Coal + 日本語");
assertEqual(
  app.utils.decodeBase64Url(encoded),
  "Scenario: Coal + 日本語",
  "Base64 URL round-trip failed.",
);

const defaultState = app.plannerState.createDefault(config);
const defaultCalculations = app.calculator.calculate(defaultState, config);
if (!Number.isFinite(defaultCalculations.budgetTokens)) {
  throw new Error("Calculator did not return a numeric budget.");
}

const sharedScenario = {
  name: "Shared 日本語 Scenario",
  state: defaultState,
};
const sharedEncoded = app.share.encodeScenario(sharedScenario, config);
const sharedDecoded = app.share.decodeScenario(sharedEncoded, config);
assertEqual(
  sharedDecoded.name,
  sharedScenario.name,
  "Shared Scenario name mismatch.",
);
assertEqual(
  sharedDecoded.state.sources.length,
  defaultState.sources.length,
  "Shared Scenario source count mismatch.",
);

// A new browser receives the configured starter Scenarios.
storage.clear();
let savedCount = 0;
const store = app.scenarioStore.create({
  config,
  onSaved: () => savedCount++,
  onError: (message) => {
    throw new Error(message);
  },
});

const starterNames = store.getLibrary().scenarios.map((scenario) => scenario.name);
assertEqual(starterNames.length, 3, "Starter Scenario count mismatch.");
assertEqual(starterNames.join("|"), "Casual Example|Consistent Example|Dedicated Example", "Starter Scenario names mismatch.");

const expectedPresets = {
  "Casual Example": { budget: 60000, cost: 60000 },
  "Consistent Example": { budget: 84000, cost: 84000 },
  "Dedicated Example": { budget: 540600, cost: 540000 },
};

for (const scenario of store.getLibrary().scenarios) {
  const calculations = app.calculator.calculate(scenario.state, config);
  const expected = expectedPresets[scenario.name];
  assertEqual(calculations.budgetTokens, expected.budget, `${scenario.name} budget mismatch.`);
  assertEqual(calculations.plannedCost, expected.cost, `${scenario.name} cost mismatch.`);
}

const second = store.add("Coal Focus", defaultState);
store.rename(second.id, "Coal Focus Revised");
const copy = store.duplicate(second.id, "Coal Focus Copy");
assertEqual(store.getActive().id, copy.id, "Scenario duplicate was not activated.");
assertEqual(store.getLibrary().scenarios.length, 5, "Scenario create count mismatch.");
store.remove(copy.id);
assertEqual(store.getLibrary().scenarios.length, 4, "Scenario deletion failed.");
if (savedCount < 4) {
  throw new Error("Scenario changes were not persisted.");
}

// Existing named Scenario libraries are not injected with starter Scenarios.
storage.set(
  storageKey,
  JSON.stringify({
    libraryVersion: 1,
    eventId: config.eventId,
    activeScenarioId: "existing-1",
    scenarios: [
      {
        id: "existing-1",
        name: "My Existing Plan",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: defaultState,
      },
    ],
  }),
);
const existingStore = app.scenarioStore.create({ config });
assertEqual(existingStore.getLibrary().scenarios.length, 1, "Existing library was modified.");
assertEqual(existingStore.getActive().name, "My Existing Plan", "Existing Scenario was replaced.");

// The original single-state format still migrates to one Scenario.
storage.set(storageKey, JSON.stringify(defaultState));
const migratedStore = app.scenarioStore.create({ config });
assertEqual(migratedStore.getLibrary().scenarios.length, 1, "Old save migration count mismatch.");
assertEqual(migratedStore.getActive().state.eventId, config.eventId, "Old save migration failed.");

console.log("Holiday Convoy starter Scenario smoke tests passed.");
