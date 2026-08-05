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
app.plannerState.validateConfig(config);
app.aboutUI.validateEventInfo(config.eventInfo);

const countdownStatus = app.aboutUI.getEventStatus(
  config.eventInfo,
  new Date(2026, 7, 5),
);
if (countdownStatus !== "Event starts in 7 days") {
  throw new Error(`Unexpected event countdown: ${countdownStatus}`);
}

const encoded = app.utils.encodeBase64Url("Scenario: Coal + 日本語");
if (app.utils.decodeBase64Url(encoded) !== "Scenario: Coal + 日本語") {
  throw new Error("Base64 URL round-trip failed.");
}

const defaultState = app.plannerState.createDefault(config);
const calculations = app.calculator.calculate(defaultState, config);
if (!Number.isFinite(calculations.budgetTokens)) {
  throw new Error("Calculator did not return a numeric budget.");
}

const sharedScenario = {
  name: "Shared 日本語 Scenario",
  state: defaultState,
};
const sharedEncoded = app.share.encodeScenario(sharedScenario, config);
const sharedDecoded = app.share.decodeScenario(sharedEncoded, config);
if (
  sharedDecoded.name !== sharedScenario.name ||
  sharedDecoded.state.sources.length !== defaultState.sources.length
) {
  throw new Error("Shared Scenario URL encoding failed.");
}

let savedCount = 0;
const store = app.scenarioStore.create({
  config,
  onSaved: () => savedCount++,
  onError: (message) => {
    throw new Error(message);
  },
});

if (store.getLibrary().scenarios.length !== 1) {
  throw new Error("Default scenario library was not created.");
}

const second = store.add("Coal Focus", defaultState);
store.rename(second.id, "Coal Focus Revised");
const copy = store.duplicate(second.id, "Coal Focus Copy");
if (store.getActive().id !== copy.id || store.getLibrary().scenarios.length !== 3) {
  throw new Error("Scenario create/duplicate behavior failed.");
}
store.remove(copy.id);
if (store.getLibrary().scenarios.length !== 2) {
  throw new Error("Scenario deletion failed.");
}
if (savedCount < 4) {
  throw new Error("Scenario changes were not persisted.");
}

// Verify migration from the original single-state format.
const storageKey = `holiday-convoy-budget:${config.eventId}`;
storage.set(storageKey, JSON.stringify(defaultState));
const migratedStore = app.scenarioStore.create({ config });
if (
  migratedStore.getLibrary().scenarios.length !== 1 ||
  migratedStore.getActive().state.eventId !== config.eventId
) {
  throw new Error("Original single-state migration failed.");
}

console.log("Holiday Convoy modular smoke tests passed.");
