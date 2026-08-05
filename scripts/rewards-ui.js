(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { clampInteger, cssEscape, formatNumber } = app.utils;
  const { createToggle } = app.uiCommon;
  const { createNationFlag, createTypeIcon } = app.shipIcons;

  function getAvailability(reward) {
    const configuredValue = String(reward.availability ?? "").trim();
    return configuredValue
      ? { label: configuredValue, isUnspecified: false }
      : { label: "Not specified", isUnspecified: true };
  }

  function tierToRoman(tier) {
    const numerals = {
      1: "I",
      2: "II",
      3: "III",
      4: "IV",
      5: "V",
      6: "VI",
      7: "VII",
      8: "VIII",
      9: "IX",
      10: "X",
    };
    return numerals[Number(tier)] ?? String(tier ?? "");
  }

  function create({
    config,
    body,
    getState,
    onSave,
    onDerivedChange,
    shipCatalog,
  }) {
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
        if (reward.rarity) {
          row.dataset.rarity = reward.rarity;
        }

        const rewardCell = document.createElement("td");
        rewardCell.className = "reward-identity-cell";
        const identity = createRewardIdentity(reward);

        const availability = getAvailability(reward);
        const mobileAvailability = document.createElement("small");
        mobileAvailability.className = "reward-availability-mobile";
        mobileAvailability.textContent = `Available: ${availability.label}`;
        mobileAvailability.classList.toggle(
          "is-unspecified",
          availability.isUnspecified,
        );

        rewardCell.append(identity, mobileAvailability);

        const availabilityCell = document.createElement("td");
        availabilityCell.className =
          "reward-availability-cell reward-availability-column";

        const availabilityLabel = document.createElement("span");
        availabilityLabel.className = "reward-availability-label";
        availabilityLabel.textContent = availability.label;
        availabilityLabel.classList.toggle(
          "is-unspecified",
          availability.isUnspecified,
        );
        availabilityCell.append(availabilityLabel);

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

        row.append(
          rewardCell,
          availabilityCell,
          costCell,
          maxCell,
          quantityCell,
          includeCell,
          totalCell,
        );
        body.append(row);
      }

      refreshShipMetadata();
    }

    function createRewardIdentity(reward) {
      const wrapper = document.createElement("div");
      wrapper.className = "reward-identity";

      const hasDetails = Boolean(reward.shipId || reward.rarity);
      const nameElement = document.createElement(hasDetails ? "button" : "strong");
      nameElement.className = hasDetails
        ? "reward-ship-trigger"
        : "reward-name-static";
      nameElement.textContent = reward.name;

      if (hasDetails) {
        nameElement.type = "button";
        nameElement.dataset.rewardId = reward.id;
        nameElement.setAttribute("aria-haspopup", "dialog");
        nameElement.setAttribute("aria-expanded", "false");
        nameElement.setAttribute(
          "aria-label",
          `View details for ${reward.name}`,
        );
      }

      const metadata = document.createElement("small");
      metadata.className = "reward-ship-inline-meta";
      metadata.dataset.shipMetadata = "";
      renderMetadata(metadata, reward, shipCatalog?.get(reward.shipId));

      wrapper.append(nameElement, metadata);
      return wrapper;
    }

    function renderMetadata(element, reward, ship) {
      element.replaceChildren();

      if (ship) {
        const typeIcon = createTypeIcon(ship, "reward-ship-type-icon");
        if (typeIcon) {
          element.append(typeIcon);
        }

        const nationFlag = createNationFlag(ship, "reward-ship-nation-flag");
        if (nationFlag) {
          element.append(nationFlag);
        }

        const details = document.createElement("span");
        details.textContent = [
          `Tier ${tierToRoman(ship.tier)}`,
          ship.nation?.label,
          ship.type?.label,
        ]
          .filter(Boolean)
          .join(" · ");
        element.append(details);
      } else {
        const category = document.createElement("span");
        category.textContent = reward.category;
        element.append(category);
      }
    }

    function refreshShipMetadata() {
      if (!shipCatalog) {
        return;
      }

      for (const reward of config.rewards) {
        const row = body.querySelector(
          `tr[data-reward-id="${cssEscape(reward.id)}"]`,
        );
        const metadata = row?.querySelector("[data-ship-metadata]");
        if (!metadata) {
          continue;
        }
        renderMetadata(metadata, reward, shipCatalog.get(reward.shipId));
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

    return { bind, refreshShipMetadata, render, updateRows };
  }

  app.rewardsUI = { create };
})();
