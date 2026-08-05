(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const {
    clone,
    createId,
    isValidDateString,
    normalizeScenarioName,
  } = app.utils;

  const LIBRARY_VERSION = 1;
  const COPY = Object.freeze({
    singular: "Scenario",
    plural: "Scenarios",
    defaultName: "Default Scenario",
    newName: "New Scenario",
  });

  function create({ config, onSaved, onError }) {
    const storageKey = `holiday-convoy-budget:${config.eventId}`;
    let library = load();

    function createRecord(name, state = app.plannerState.createDefault(config)) {
      const now = new Date().toISOString();
      return {
        id: createId("scenario"),
        name: normalizeScenarioName(name) || COPY.defaultName,
        createdAt: now,
        updatedAt: now,
        state: app.plannerState.normalize(state, config),
      };
    }

    function createDefaultLibrary() {
      const scenario = createRecord(COPY.defaultName);
      return {
        libraryVersion: LIBRARY_VERSION,
        eventId: config.eventId,
        activeScenarioId: scenario.id,
        scenarios: [scenario],
      };
    }

    function normalizeRecord(scenario, index) {
      if (!scenario || typeof scenario !== "object") {
        return null;
      }
      const state = scenario.state ?? scenario.data;
      if (!state || typeof state !== "object") {
        return null;
      }
      const createdAt = isValidDateString(scenario.createdAt)
        ? scenario.createdAt
        : new Date().toISOString();
      return {
        id: String(scenario.id || createId("scenario")),
        name:
          normalizeScenarioName(scenario.name) || `${COPY.singular} ${index + 1}`,
        createdAt,
        updatedAt: isValidDateString(scenario.updatedAt)
          ? scenario.updatedAt
          : createdAt,
        state: app.plannerState.normalize(state, config),
      };
    }

    function load() {
      const defaultsFactory = () => createDefaultLibrary();
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          return defaultsFactory();
        }
        const saved = JSON.parse(raw);
        if (saved.eventId !== config.eventId) {
          return defaultsFactory();
        }

        if (Array.isArray(saved.scenarios)) {
          const scenarios = saved.scenarios
            .map(normalizeRecord)
            .filter(Boolean);
          if (!scenarios.length) {
            return defaultsFactory();
          }
          return {
            libraryVersion: LIBRARY_VERSION,
            eventId: config.eventId,
            activeScenarioId: scenarios.some(
              (scenario) => scenario.id === saved.activeScenarioId,
            )
              ? saved.activeScenarioId
              : scenarios[0].id,
            scenarios,
          };
        }

        if (Array.isArray(saved.sources)) {
          const migrated = createRecord(COPY.defaultName, saved);
          const migratedLibrary = {
            libraryVersion: LIBRARY_VERSION,
            eventId: config.eventId,
            activeScenarioId: migrated.id,
            scenarios: [migrated],
          };
          localStorage.setItem(storageKey, JSON.stringify(migratedLibrary));
          return migratedLibrary;
        }
      } catch (error) {
        console.warn("Could not load saved scenario data.", error);
      }
      return defaultsFactory();
    }

    function persist(showStatus = true) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(library));
        if (showStatus) {
          onSaved?.();
        }
      } catch (error) {
        console.error("Could not save scenario data.", error);
        onError?.("Your changes could not be saved in this browser.");
      }
    }

    function getActive() {
      let active = library.scenarios.find(
        (scenario) => scenario.id === library.activeScenarioId,
      );
      if (!active) {
        active = library.scenarios[0];
        library.activeScenarioId = active.id;
      }
      return active;
    }

    function activate(id) {
      if (!library.scenarios.some((scenario) => scenario.id === id)) {
        return false;
      }
      library.activeScenarioId = id;
      persist(false);
      return true;
    }

    function saveActiveState(state) {
      const active = getActive();
      active.state = state;
      active.updatedAt = new Date().toISOString();
      persist();
    }

    function add(name, state) {
      const scenario = createRecord(name, state);
      library.scenarios.push(scenario);
      library.activeScenarioId = scenario.id;
      persist();
      return scenario;
    }

    function rename(id, name) {
      const scenario = library.scenarios.find((item) => item.id === id);
      if (!scenario) {
        return null;
      }
      scenario.name = normalizeScenarioName(name);
      scenario.updatedAt = new Date().toISOString();
      persist();
      return scenario;
    }

    function duplicate(id, name) {
      const source = library.scenarios.find((item) => item.id === id);
      if (!source) {
        return null;
      }
      return add(name, clone(source.state));
    }

    function remove(id) {
      if (library.scenarios.length === 1) {
        return null;
      }
      const index = library.scenarios.findIndex((item) => item.id === id);
      if (index < 0) {
        return null;
      }
      const [removed] = library.scenarios.splice(index, 1);
      const nextIndex = Math.min(Math.max(index - 1, 0), library.scenarios.length - 1);
      library.activeScenarioId = library.scenarios[nextIndex].id;
      persist();
      return removed;
    }

    function resetActive() {
      const active = getActive();
      active.state = app.plannerState.createDefault(config);
      active.updatedAt = new Date().toISOString();
      persist();
      return active;
    }

    function makeUniqueName(baseName) {
      const base = normalizeScenarioName(baseName) || COPY.newName;
      const names = new Set(
        library.scenarios.map((scenario) => scenario.name.toLocaleLowerCase()),
      );
      if (!names.has(base.toLocaleLowerCase())) {
        return base;
      }
      let suffix = 2;
      while (names.has(`${base} ${suffix}`.toLocaleLowerCase())) {
        suffix += 1;
      }
      return `${base} ${suffix}`;
    }

    function validateName(name, excludedId = null) {
      const normalized = normalizeScenarioName(name);
      if (!normalized) {
        return `${COPY.singular} names cannot be blank.`;
      }
      const duplicateName = library.scenarios.some(
        (scenario) =>
          scenario.id !== excludedId &&
          scenario.name.localeCompare(normalized, undefined, {
            sensitivity: "accent",
          }) === 0,
      );
      return duplicateName
        ? `A ${COPY.singular.toLowerCase()} named "${normalized}" already exists.`
        : "";
    }

    function createTransferPayload(scenario = getActive()) {
      return {
        app: config.appTitle,
        format: "holiday-convoy-scenario",
        formatVersion: 1,
        schemaVersion: config.schemaVersion,
        eventId: config.eventId,
        eventYear: config.eventYear,
        exportedAt: new Date().toISOString(),
        scenarioName: scenario.name,
        state: clone(scenario.state),
      };
    }

    function parseTransferPayload(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("The imported file does not contain forecast data.");
      }
      if (payload.eventId !== config.eventId) {
        throw new Error(`This file is not for ${config.eventName} ${config.eventYear}.`);
      }
      const importedState = payload.state ?? payload.scenario?.state;
      if (!importedState || !Array.isArray(importedState.sources)) {
        throw new Error("The imported source list is missing.");
      }
      return {
        name: normalizeScenarioName(payload.scenarioName ?? payload.scenario?.name),
        state: app.plannerState.normalize(importedState, config),
      };
    }

    return {
      COPY,
      activate,
      add,
      createTransferPayload,
      duplicate,
      getActive,
      getLibrary: () => library,
      makeUniqueName,
      parseTransferPayload,
      persist,
      remove,
      rename,
      resetActive,
      saveActiveState,
      validateName,
    };
  }

  app.scenarioStore = { create };
})();
