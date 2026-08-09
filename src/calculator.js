(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { clampInteger, normalizeNonNegativeInteger } = app.utils;

  function calculate(state, config) {
    const rowResults = new Map();
    const resourceBreakdowns = [];

    for (const resource of config.resources) {
      const includedRows = state.sources.filter(
        (source) => source.included && source.resourceId === resource.id,
      );
      const totalRequested = includedRows.reduce(
        (sum, source) => sum + normalizeNonNegativeInteger(source.value),
        0,
      );
      const countedTotal =
        resource.cap == null ? totalRequested : Math.min(totalRequested, resource.cap);
      let remainingCountable = countedTotal;
      let directTokens = 0;
      let pooledRemainders = 0;

      for (const source of state.sources) {
        if (source.resourceId !== resource.id) {
          continue;
        }

        const requested = normalizeNonNegativeInteger(source.value);
        if (!source.included) {
          rowResults.set(source.id, {
            included: false,
            requested,
            counted: 0,
            excludedByCap: 0,
            directTokens: 0,
            remainder: 0,
            resource,
          });
          continue;
        }

        const counted = Math.min(requested, Math.max(remainingCountable, 0));
        remainingCountable -= counted;
        const exchanges = Math.floor(counted / resource.sourceRate);
        const rowDirectTokens = exchanges * resource.targetTokens;
        const remainder = counted % resource.sourceRate;
        const excludedByCap = requested - counted;

        directTokens += rowDirectTokens;
        pooledRemainders += remainder;
        rowResults.set(source.id, {
          included: true,
          requested,
          counted,
          excludedByCap,
          directTokens: rowDirectTokens,
          remainder,
          resource,
        });
      }

      const pooledExchanges = Math.floor(pooledRemainders / resource.sourceRate);
      const pooledBonusTokens = pooledExchanges * resource.targetTokens;
      const finalRemainder = pooledRemainders % resource.sourceRate;
      const totalTokens = directTokens + pooledBonusTokens;
      const excludedByCap = Math.max(totalRequested - countedTotal, 0);

      resourceBreakdowns.push({
        resource,
        totalRequested,
        countedTotal,
        excludedByCap,
        directTokens,
        pooledRemainders,
        pooledBonusTokens,
        finalRemainder,
        totalTokens,
      });
    }

    const budgetTokens = resourceBreakdowns.reduce(
      (sum, item) => sum + item.totalTokens,
      0,
    );

    const rewardResults = new Map();
    let plannedCost = 0;
    for (const reward of config.rewards) {
      const selection = state.rewardSelections[reward.id];
      const quantity = clampInteger(selection?.quantity ?? 0, 0, reward.maxQuantity);
      const included = Boolean(selection?.included);
      const totalCost = included ? quantity * reward.tokenCost : 0;
      plannedCost += totalCost;
      rewardResults.set(reward.id, { quantity, included, totalCost });
    }

    return {
      rowResults,
      resourceBreakdowns,
      budgetTokens,
      rewardResults,
      plannedCost,
      difference: budgetTokens - plannedCost,
    };
  }

  app.calculator = { calculate };
})();
