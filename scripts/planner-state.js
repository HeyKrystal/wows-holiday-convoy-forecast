(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { clampInteger, createId, normalizeNonNegativeInteger } = app.utils;

  function validateConfig(config) {
    const resourceIds = new Set();
    const rewardIds = new Set();

    for (const resource of config.resources) {
      if (!resource.id || resourceIds.has(resource.id)) {
        throw new Error(`Resource IDs must be unique. Problem ID: ${resource.id}`);
      }
      if (resource.sourceRate <= 0 || resource.targetTokens <= 0) {
        throw new Error(`Resource rates must be positive for ${resource.label}.`);
      }
      resourceIds.add(resource.id);
    }

    for (const reward of config.rewards) {
      if (!reward.id || rewardIds.has(reward.id)) {
        throw new Error(`Reward IDs must be unique. Problem ID: ${reward.id}`);
      }
      if (reward.tokenCost < 0 || reward.maxQuantity < 1) {
        throw new Error(`Reward values are invalid for ${reward.name}.`);
      }
      rewardIds.add(reward.id);
    }

    validateStarterScenarios(config.starterScenarios, resourceIds, rewardIds);
  }

  function validateStarterScenarios(starterScenarios, resourceIds, rewardIds) {
    if (starterScenarios == null) {
      return;
    }
    if (!Array.isArray(starterScenarios)) {
      throw new Error("starterScenarios must be an array when provided.");
    }

    const scenarioNames = new Set();
    for (const [index, starter] of starterScenarios.entries()) {
      if (!starter || typeof starter !== "object") {
        throw new Error(`Starter Scenario ${index + 1} must be an object.`);
      }

      const name = String(starter.name ?? "").trim();
      const normalizedName = name.toLocaleLowerCase();
      if (!name) {
        throw new Error(`Starter Scenario ${index + 1} must have a name.`);
      }
      if (scenarioNames.has(normalizedName)) {
        throw new Error(`Starter Scenario names must be unique: ${name}.`);
      }
      scenarioNames.add(normalizedName);

      if (!Array.isArray(starter.sources) || starter.sources.length === 0) {
        throw new Error(`${name} must contain at least one token source.`);
      }
      for (const source of starter.sources) {
        if (!resourceIds.has(source?.resourceId)) {
          throw new Error(
            `${name} uses an unknown resource: ${source?.resourceId}.`,
          );
        }
      }

      const selections = starter.rewardSelections ?? {};
      if (!selections || typeof selections !== "object" || Array.isArray(selections)) {
        throw new Error(`${name} rewardSelections must be an object.`);
      }
      for (const rewardId of Object.keys(selections)) {
        if (!rewardIds.has(rewardId)) {
          throw new Error(`${name} uses an unknown reward: ${rewardId}.`);
        }
      }
    }
  }

  function createDefault(config) {
    return {
      schemaVersion: config.schemaVersion,
      eventId: config.eventId,
      sources: config.defaultSources.map((row) => ({ ...row })),
      rewardSelections: Object.fromEntries(
        config.rewards.map((reward) => [
          reward.id,
          {
            quantity: clampInteger(
              reward.defaultQuantity ?? 1,
              0,
              reward.maxQuantity,
            ),
            included: Boolean(reward.defaultIncluded),
          },
        ]),
      ),
    };
  }

  function createStarter(config, starter) {
    const rewardSelections = Object.fromEntries(
      config.rewards.map((reward) => [
        reward.id,
        {
          quantity: clampInteger(
            reward.defaultQuantity ?? 1,
            0,
            reward.maxQuantity,
          ),
          included: false,
        },
      ]),
    );

    for (const reward of config.rewards) {
      const selection = starter.rewardSelections?.[reward.id];
      if (!selection) {
        continue;
      }
      rewardSelections[reward.id] = {
        quantity: clampInteger(selection.quantity ?? 1, 0, reward.maxQuantity),
        included: selection.included !== false,
      };
    }

    return normalize(
      {
        schemaVersion: config.schemaVersion,
        eventId: config.eventId,
        sources: starter.sources.map((source) => ({ ...source })),
        rewardSelections,
      },
      config,
    );
  }

  function normalizeSourceRow(row) {
    return {
      id: String(row.id || createId("source")),
      name: String(row.name || ""),
      resourceId: String(row.resourceId),
      value: normalizeNonNegativeInteger(row.value),
      included: Boolean(row.included),
    };
  }

  function normalize(savedState, config) {
    const defaults = createDefault(config);
    if (
      !savedState ||
      typeof savedState !== "object" ||
      savedState.eventId !== config.eventId ||
      !Array.isArray(savedState.sources)
    ) {
      return defaults;
    }

    const validResourceIds = new Set(config.resources.map((item) => item.id));
    const sources = savedState.sources
      .filter((row) => row && validResourceIds.has(row.resourceId))
      .map(normalizeSourceRow);

    const rewardSelections = { ...defaults.rewardSelections };
    for (const reward of config.rewards) {
      const selection = savedState.rewardSelections?.[reward.id];
      if (!selection) {
        continue;
      }
      rewardSelections[reward.id] = {
        quantity: clampInteger(selection.quantity, 0, reward.maxQuantity),
        included: Boolean(selection.included),
      };
    }

    return {
      schemaVersion: config.schemaVersion,
      eventId: config.eventId,
      sources,
      rewardSelections,
    };
  }

  app.plannerState = {
    createDefault,
    createStarter,
    normalize,
    normalizeSourceRow,
    validateConfig,
  };
})();
