(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { clampInteger, cssEscape, formatNumber } = app.utils;
  const { createToggle } = app.uiCommon;

  function create({ config, body, getState, onSave, onDerivedChange }) {
    function bind() {
      body.addEventListener("input", handleInput);
      body.addEventListener("change", handleChange);
    }

    function render() {
      const state = getState();
      body.replaceChildren();
      for (const reward of config.rewards) {
        const selection = state.rewardSelections[reward.id];
        const row = document.createElement("tr");
        row.dataset.rewardId = reward.id;

        const rewardCell = document.createElement("td");
        const rewardName = document.createElement("strong");
        rewardName.textContent = reward.name;
        const category = document.createElement("small");
        category.className = "category-label";
        category.textContent = reward.category;
        rewardCell.append(rewardName, category);

        const costCell = document.createElement("td");
        costCell.className = "numeric-cell";
        costCell.textContent = formatNumber(reward.tokenCost);

        const maxCell = document.createElement("td");
        maxCell.className = "numeric-cell max-quantity-cell";
        maxCell.textContent = formatNumber(reward.maxQuantity);

        const quantityCell = document.createElement("td");
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.className = "table-input numeric-input quantity-input";
        quantityInput.dataset.field = "quantity";
        quantityInput.value = selection.quantity;
        quantityInput.min = "0";
        quantityInput.max = String(reward.maxQuantity);
        quantityInput.step = "1";
        quantityInput.inputMode = "numeric";
        quantityInput.setAttribute(
          "aria-label",
          `Quantity for ${reward.name}; maximum ${reward.maxQuantity}`,
        );
        quantityCell.append(quantityInput);

        const includeCell = document.createElement("td");
        includeCell.className = "checkbox-cell";
        includeCell.append(
          createToggle(selection.included, "included", `Include ${reward.name}`),
        );

        const totalCell = document.createElement("td");
        totalCell.className = "calculated-cell numeric-cell";
        const totalValue = document.createElement("strong");
        totalValue.className = "reward-total-value";
        totalCell.append(totalValue);

        row.append(rewardCell, costCell, maxCell, quantityCell, includeCell, totalCell);
        body.append(row);
      }
    }

    function updateRows(calculations) {
      for (const reward of config.rewards) {
        const row = body.querySelector(
          `tr[data-reward-id="${cssEscape(reward.id)}"]`,
        );
        const result = calculations.rewardResults.get(reward.id);
        if (!row || !result) {
          continue;
        }
        row.classList.toggle("is-excluded", !result.included);
        row.querySelector(".reward-total-value").textContent =
          formatNumber(result.totalCost);
      }
    }

    function getTarget(event) {
      const row = event.target.closest("tr[data-reward-id]");
      const reward = config.rewards.find((item) => item.id === row?.dataset.rewardId);
      const field = event.target.dataset.field;
      if (!row || !reward || !field) {
        return null;
      }
      return {
        field,
        reward,
        selection: getState().rewardSelections[reward.id],
      };
    }

    function handleInput(event) {
      const target = getTarget(event);
      if (!target || target.field !== "quantity") {
        return;
      }
      target.selection.quantity = clampInteger(
        event.target.value,
        0,
        target.reward.maxQuantity,
      );
      onSave();
      onDerivedChange();
    }

    function handleChange(event) {
      const target = getTarget(event);
      if (!target) {
        return;
      }
      if (target.field === "included") {
        target.selection.included = event.target.checked;
      } else if (target.field === "quantity") {
        target.selection.quantity = clampInteger(
          event.target.value,
          0,
          target.reward.maxQuantity,
        );
        event.target.value = target.selection.quantity;
      }
      onSave();
      onDerivedChange();
    }

    return { bind, render, updateRows };
  }

  app.rewardsUI = { create };
})();
