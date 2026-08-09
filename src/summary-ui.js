(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { formatNumber } = app.utils;
  const { createResourceBadge } = app.uiCommon;

  function create({ config, elements }) {
    function renderResourceRules() {
      elements.resourceRulesBody.replaceChildren();
      for (const resource of config.resources) {
        const row = document.createElement("tr");
        const resourceCell = document.createElement("td");
        const rateCell = document.createElement("td");
        const tokensCell = document.createElement("td");
        const capCell = document.createElement("td");
        resourceCell.append(createResourceBadge(resource));
        rateCell.textContent = formatNumber(resource.sourceRate);
        tokensCell.textContent = formatNumber(resource.targetTokens);
        capCell.textContent = resource.cap == null ? "No cap" : formatNumber(resource.cap);
        row.append(resourceCell, rateCell, tokensCell, capCell);
        elements.resourceRulesBody.append(row);
      }
    }

    function render(calculations) {
      renderResourceBreakdown(calculations);
      renderTotals(calculations);
    }

    function renderResourceBreakdown(calculations) {
      elements.resourceBreakdownBody.replaceChildren();
      for (const breakdown of calculations.resourceBreakdowns) {
        const row = document.createElement("tr");
        const resourceCell = document.createElement("td");
        resourceCell.append(createResourceBadge(breakdown.resource));

        const countedCell = document.createElement("td");
        countedCell.className = "numeric-cell";
        const countedValue = document.createElement("strong");
        countedValue.textContent = formatNumber(breakdown.countedTotal);
        const countedNote = document.createElement("small");
        countedNote.className = "cell-note";
        countedNote.textContent =
          breakdown.resource.cap == null
            ? "No cap"
            : `of ${formatNumber(breakdown.resource.cap)} cap`;
        countedCell.append(countedValue, countedNote);

        const remainderCell = document.createElement("td");
        remainderCell.className = "numeric-cell";
        const remainderValue = document.createElement("strong");
        remainderValue.textContent = formatNumber(breakdown.finalRemainder);
        const remainderNote = document.createElement("small");
        remainderNote.className = "cell-note";
        remainderNote.textContent = breakdown.pooledBonusTokens
          ? `${formatNumber(breakdown.pooledBonusTokens)} bonus tokens created`
          : "After pooling row remainders";
        remainderCell.append(remainderValue, remainderNote);

        const totalCell = document.createElement("td");
        totalCell.className = "numeric-cell emphasized-cell";
        totalCell.textContent = formatNumber(breakdown.totalTokens);
        row.append(resourceCell, countedCell, remainderCell, totalCell);
        elements.resourceBreakdownBody.append(row);
      }
    }

    function renderTotals(calculations) {
      elements.budgetValue.textContent = formatNumber(calculations.budgetTokens);
      elements.costValue.textContent = formatNumber(calculations.plannedCost);
      const hasSurplus = calculations.difference >= 0;
      elements.differenceLabel.textContent = hasSurplus
        ? "Leftover Tokens"
        : "Token Shortfall";
      elements.differenceValue.textContent = formatNumber(
        Math.abs(calculations.difference),
      );
      elements.differenceValue.classList.toggle("is-positive", hasSurplus);
      elements.differenceValue.classList.toggle("is-negative", !hasSurplus);

      const progress =
        calculations.plannedCost === 0
          ? 100
          : Math.min(100, (calculations.budgetTokens / calculations.plannedCost) * 100);
      elements.budgetProgress.style.width = `${progress}%`;
      elements.budgetProgress.parentElement.setAttribute(
        "aria-valuenow",
        String(Math.round(progress)),
      );
      elements.budgetProgressText.textContent =
        calculations.plannedCost === 0
          ? "No rewards selected"
          : hasSurplus
            ? "Budget covers the current scenario"
            : `${Math.round(progress)}% of the expected cost covered`;

      elements.cappedLeftovers.replaceChildren();
      const cappedResources = calculations.resourceBreakdowns.filter(
        (item) =>
          item.resource.cap != null && item.resource.showCappedLeftover !== false,
      );
      if (!cappedResources.length) {
        const message = document.createElement("p");
        message.className = "empty-summary";
        message.textContent = "No resource types qualify for leftovers";
        elements.cappedLeftovers.append(message);
        return;
      }
      for (const item of cappedResources) {
        const line = document.createElement("div");
        line.className = "summary-line compact-summary-line";
        const label = document.createElement("span");
        label.textContent = `${item.resource.label} excluded by cap`;
        const value = document.createElement("strong");
        value.textContent = formatNumber(item.excludedByCap);
        line.append(label, value);
        elements.cappedLeftovers.append(line);
      }
    }

    return { render, renderResourceRules };
  }

  app.summaryUI = { create };
})();
