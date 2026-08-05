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
    normalize,
    normalizeSourceRow,
    validateConfig,
  };
})();
