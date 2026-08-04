(() => {
  "use strict";

  const config = window.HOLIDAY_CONVOY_CONFIG;

  if (!config) {
    throw new Error("HOLIDAY_CONVOY_CONFIG was not loaded before app.js.");
  }

  const STORAGE_PREFIX = "holiday-convoy-budget";
  const storageKey = `${STORAGE_PREFIX}:${config.eventId}`;
  const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });

  const elements = {};
  let state = loadState();
  let saveStatusTimer = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    validateConfig();
    cacheElements();
    applyEventCopy();
    renderResourceRules();
    renderSources();
    renderRewards();
    bindEvents();
    updateDerivedViews();
  }

  function validateConfig() {
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

  function cacheElements() {
    elements.eventEyebrow = document.querySelector("#eventEyebrow");
    elements.appTitle = document.querySelector("#appTitle");
    elements.appSubtitle = document.querySelector("#appSubtitle");
    elements.resourceRulesBody = document.querySelector("#resourceRulesBody");
    elements.sourcesBody = document.querySelector("#sourcesBody");
    elements.resourceBreakdownBody = document.querySelector(
      "#resourceBreakdownBody",
    );
    elements.rewardsBody = document.querySelector("#rewardsBody");
    elements.addSourceButton = document.querySelector("#addSourceButton");
    elements.resetButton = document.querySelector("#resetButton");
    elements.exportButton = document.querySelector("#exportButton");
    elements.importButton = document.querySelector("#importButton");
    elements.importInput = document.querySelector("#importInput");
    elements.savedStatus = document.querySelector("#savedStatus");
    elements.budgetValue = document.querySelector("#budgetValue");
    elements.costValue = document.querySelector("#costValue");
    elements.differenceLabel = document.querySelector("#differenceLabel");
    elements.differenceValue = document.querySelector("#differenceValue");
    elements.budgetProgress = document.querySelector("#budgetProgress");
    elements.budgetProgressText = document.querySelector("#budgetProgressText");
    elements.cappedLeftovers = document.querySelector("#cappedLeftovers");
    elements.toast = document.querySelector("#toast");
    elements.footerYear = document.querySelector("#footerYear");
  }

  function applyEventCopy() {
    document.title = config.appTitle;
    elements.eventEyebrow.textContent = `${config.eventName} ${config.eventYear}`;
    elements.appTitle.textContent = config.appTitle;
    elements.appSubtitle.textContent = config.appSubtitle;
    elements.footerYear.textContent = config.eventYear;
  }

  function bindEvents() {
    elements.addSourceButton.addEventListener("click", addSourceRow);
    elements.resetButton.addEventListener("click", resetPlanner);
    elements.exportButton.addEventListener("click", exportPlannerData);
    elements.importButton.addEventListener("click", () =>
      elements.importInput.click(),
    );
    elements.importInput.addEventListener("change", importPlannerData);

    elements.sourcesBody.addEventListener("input", handleSourceInput);
    elements.sourcesBody.addEventListener("change", handleSourceChange);
    elements.sourcesBody.addEventListener("click", handleSourceClick);

    elements.rewardsBody.addEventListener("input", handleRewardInput);
    elements.rewardsBody.addEventListener("change", handleRewardChange);
  }

  function createDefaultState() {
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

  function loadState() {
    const defaults = createDefaultState();

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return defaults;
      }

      const saved = JSON.parse(raw);
      if (saved.eventId !== config.eventId || !Array.isArray(saved.sources)) {
        return defaults;
      }

      const validResourceIds = new Set(config.resources.map((item) => item.id));
      const sources = saved.sources
        .filter((row) => row && validResourceIds.has(row.resourceId))
        .map(normalizeSourceRow);

      const rewardSelections = { ...defaults.rewardSelections };
      for (const reward of config.rewards) {
        const savedSelection = saved.rewardSelections?.[reward.id];
        if (!savedSelection) {
          continue;
        }
        rewardSelections[reward.id] = {
          quantity: clampInteger(
            savedSelection.quantity,
            0,
            reward.maxQuantity,
          ),
          included: Boolean(savedSelection.included),
        };
      }

      return {
        schemaVersion: config.schemaVersion,
        eventId: config.eventId,
        sources: sources.length ? sources : defaults.sources,
        rewardSelections,
      };
    } catch (error) {
      console.warn("Could not load saved planner data.", error);
      return defaults;
    }
  }

  function normalizeSourceRow(row) {
    return {
      id: String(row.id || createId()),
      name: String(row.name || ""),
      resourceId: String(row.resourceId),
      value: normalizeNonNegativeInteger(row.value),
      included: Boolean(row.included),
    };
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      showSavedStatus();
    } catch (error) {
      console.error("Could not save planner data.", error);
      showToast("Your changes could not be saved in this browser.", "error");
    }
  }

  function showSavedStatus() {
    elements.savedStatus.textContent = "Saved locally";
    elements.savedStatus.classList.add("is-visible");
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => {
      elements.savedStatus.classList.remove("is-visible");
    }, 1600);
  }

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

  function renderSources() {
    elements.sourcesBody.replaceChildren();

    for (const source of state.sources) {
      const resource = getResource(source.resourceId);
      const row = document.createElement("tr");
      row.dataset.sourceId = source.id;
      row.style.setProperty("--resource-color", resource.color);
      row.style.setProperty("--resource-accent", resource.accent);

      const sourceCell = document.createElement("td");
      sourceCell.className = "source-name-cell";
      const sourceInput = document.createElement("input");
      sourceInput.type = "text";
      sourceInput.className = "table-input source-name-input";
      sourceInput.dataset.field = "name";
      sourceInput.value = source.name;
      sourceInput.title = source.name;
      sourceInput.placeholder = "Describe this source";
      sourceInput.setAttribute("aria-label", "Source description");
      sourceCell.append(sourceInput);

      const resourceCell = document.createElement("td");
      const resourceSelect = document.createElement("select");
      resourceSelect.className = "table-input resource-select";
      resourceSelect.dataset.field = "resourceId";
      resourceSelect.setAttribute("aria-label", "Resource type");
      for (const optionResource of config.resources) {
        const option = document.createElement("option");
        option.value = optionResource.id;
        option.textContent = optionResource.label;
        option.selected = optionResource.id === source.resourceId;
        resourceSelect.append(option);
      }
      resourceCell.append(resourceSelect);

      const valueCell = document.createElement("td");
      const valueInput = document.createElement("input");
      valueInput.type = "number";
      valueInput.className = "table-input numeric-input";
      valueInput.dataset.field = "value";
      valueInput.value = source.value;
      valueInput.min = "0";
      valueInput.step = "1";
      valueInput.inputMode = "numeric";
      valueInput.setAttribute("aria-label", "Resource amount");
      valueCell.append(valueInput);

      const includeCell = document.createElement("td");
      includeCell.className = "checkbox-cell";
      includeCell.append(
        createToggle(source.included, "included", "Include this source"),
      );

      const tokenCell = document.createElement("td");
      tokenCell.className = "calculated-cell";
      const tokenValue = document.createElement("strong");
      tokenValue.className = "row-token-value";
      const tokenNote = document.createElement("small");
      tokenNote.className = "row-token-note";
      tokenCell.append(tokenValue, tokenNote);

      const actionCell = document.createElement("td");
      actionCell.className = "row-action-cell";
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "icon-button remove-source-button";
      removeButton.dataset.action = "remove-source";
      removeButton.title = "Remove source";
      removeButton.setAttribute("aria-label", `Remove ${source.name || "source"}`);
      removeButton.textContent = "×";
      actionCell.append(removeButton);

      row.append(
        sourceCell,
        resourceCell,
        valueCell,
        includeCell,
        tokenCell,
        actionCell,
      );
      elements.sourcesBody.append(row);
    }
  }

  function renderRewards() {
    elements.rewardsBody.replaceChildren();

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

      row.append(
        rewardCell,
        costCell,
        maxCell,
        quantityCell,
        includeCell,
        totalCell,
      );
      elements.rewardsBody.append(row);
    }
  }

  function createToggle(checked, field, label) {
    const wrapper = document.createElement("label");
    wrapper.className = "toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.field = field;
    input.checked = checked;
    input.setAttribute("aria-label", label);
    const visual = document.createElement("span");
    visual.className = "toggle-visual";
    visual.setAttribute("aria-hidden", "true");
    wrapper.append(input, visual);
    return wrapper;
  }

  function createResourceBadge(resource) {
    const badge = document.createElement("span");
    badge.className = "resource-badge";
    badge.textContent = resource.label;
    badge.style.setProperty("--badge-color", resource.color);
    badge.style.setProperty("--badge-accent", resource.accent);
    return badge;
  }

  function handleSourceInput(event) {
    const field = event.target.dataset.field;
    const rowElement = event.target.closest("tr[data-source-id]");
    if (!field || !rowElement) {
      return;
    }

    const source = state.sources.find((item) => item.id === rowElement.dataset.sourceId);
    if (!source) {
      return;
    }

    if (field === "name") {
      source.name = event.target.value;
      event.target.title = source.name;
      saveState();
      return;
    }

    if (field === "value") {
      source.value = normalizeNonNegativeInteger(event.target.value);
      saveState();
      updateDerivedViews();
    }
  }

  function handleSourceChange(event) {
    const field = event.target.dataset.field;
    const rowElement = event.target.closest("tr[data-source-id]");
    if (!field || !rowElement) {
      return;
    }

    const source = state.sources.find((item) => item.id === rowElement.dataset.sourceId);
    if (!source) {
      return;
    }

    if (field === "resourceId") {
      source.resourceId = event.target.value;
      saveState();
      renderSources();
      updateDerivedViews();
      return;
    }

    if (field === "included") {
      source.included = event.target.checked;
      saveState();
      updateDerivedViews();
    }
  }

  function handleSourceClick(event) {
    const button = event.target.closest("button[data-action='remove-source']");
    if (!button) {
      return;
    }

    const rowElement = button.closest("tr[data-source-id]");
    state.sources = state.sources.filter(
      (source) => source.id !== rowElement.dataset.sourceId,
    );
    saveState();
    renderSources();
    updateDerivedViews();
  }

  function handleRewardInput(event) {
    if (event.target.dataset.field !== "quantity") {
      return;
    }

    const rowElement = event.target.closest("tr[data-reward-id]");
    const reward = getReward(rowElement?.dataset.rewardId);
    if (!rowElement || !reward) {
      return;
    }

    const selection = state.rewardSelections[reward.id];
    selection.quantity = clampInteger(event.target.value, 0, reward.maxQuantity);
    saveState();
    updateDerivedViews();
  }

  function handleRewardChange(event) {
    const field = event.target.dataset.field;
    const rowElement = event.target.closest("tr[data-reward-id]");
    const reward = getReward(rowElement?.dataset.rewardId);
    if (!field || !rowElement || !reward) {
      return;
    }

    const selection = state.rewardSelections[reward.id];

    if (field === "included") {
      selection.included = event.target.checked;
    } else if (field === "quantity") {
      selection.quantity = clampInteger(
        event.target.value,
        0,
        reward.maxQuantity,
      );
      event.target.value = selection.quantity;
    }

    saveState();
    updateDerivedViews();
  }

  function addSourceRow() {
    state.sources.push({
      id: createId(),
      name: "New Source",
      resourceId: config.resources[0].id,
      value: 0,
      included: true,
    });
    saveState();
    renderSources();
    updateDerivedViews();

    const newestInput = elements.sourcesBody.querySelector(
      "tr:last-child .source-name-input",
    );
    newestInput?.focus();
    newestInput?.select();
  }

  function updateDerivedViews() {
    const calculations = calculatePlanner();
    updateSourceRows(calculations);
    renderResourceBreakdown(calculations);
    updateRewardRows(calculations);
    updateTotals(calculations);
  }

  function calculatePlanner() {
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
        resource.cap == null
          ? totalRequested
          : Math.min(totalRequested, resource.cap);
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

      const pooledExchanges = Math.floor(
        pooledRemainders / resource.sourceRate,
      );
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
      const quantity = clampInteger(
        selection?.quantity ?? 0,
        0,
        reward.maxQuantity,
      );
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

  function updateSourceRows(calculations) {
    for (const source of state.sources) {
      const rowElement = elements.sourcesBody.querySelector(
        `tr[data-source-id="${cssEscape(source.id)}"]`,
      );
      const result = calculations.rowResults.get(source.id);
      if (!rowElement || !result) {
        continue;
      }

      rowElement.classList.toggle("is-excluded", !result.included);
      rowElement.classList.toggle("is-cap-limited", result.excludedByCap > 0);

      const tokenValue = rowElement.querySelector(".row-token-value");
      const tokenNote = rowElement.querySelector(".row-token-note");
      tokenValue.textContent = formatNumber(result.directTokens);

      if (!result.included) {
        tokenNote.textContent = "Not included";
      } else if (result.excludedByCap > 0) {
        tokenNote.textContent = `${formatNumber(result.excludedByCap)} excluded by cap`;
      } else if (result.remainder > 0) {
        tokenNote.textContent = `${formatNumber(result.remainder)} pooled`;
      } else {
        tokenNote.textContent = "";
      }
    }
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

  function updateRewardRows(calculations) {
    for (const reward of config.rewards) {
      const rowElement = elements.rewardsBody.querySelector(
        `tr[data-reward-id="${cssEscape(reward.id)}"]`,
      );
      const result = calculations.rewardResults.get(reward.id);
      if (!rowElement || !result) {
        continue;
      }
      rowElement.classList.toggle("is-excluded", !result.included);
      rowElement.querySelector(".reward-total-value").textContent =
        formatNumber(result.totalCost);
    }
  }

  function updateTotals(calculations) {
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
        : Math.min(
          100,
          (calculations.budgetTokens / calculations.plannedCost) * 100,
        );
    elements.budgetProgress.style.width = `${progress}%`;
    elements.budgetProgress.parentElement.setAttribute(
      "aria-valuenow",
      String(Math.round(progress)),
    );
    elements.budgetProgressText.textContent =
      calculations.plannedCost === 0
        ? "No rewards selected"
        : hasSurplus
          ? "Budget covers the current plan"
          : `${Math.round(progress)}% of the planned cost covered`;

    elements.cappedLeftovers.replaceChildren();
    const cappedResources = calculations.resourceBreakdowns.filter(
      (item) =>
        item.resource.cap != null &&
        item.resource.showCappedLeftover !== false,
    );
    if (cappedResources.length === 0) {
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

  function resetPlanner() {
    const confirmed = window.confirm(
      `Reset the ${config.eventYear} planner to its default rows and selections?`,
    );
    if (!confirmed) {
      return;
    }

    state = createDefaultState();
    saveState();
    renderSources();
    renderRewards();
    updateDerivedViews();
    showToast("Planner reset to defaults.", "success");
  }

  function exportPlannerData() {
    const payload = {
      app: config.appTitle,
      schemaVersion: config.schemaVersion,
      eventId: config.eventId,
      eventYear: config.eventYear,
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `holiday-convoy-budget-${config.eventYear}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Planner data exported.", "success");
  }

  async function importPlannerData(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      if (payload.eventId !== config.eventId || !payload.state) {
        throw new Error(
          `This file is not for ${config.eventName} ${config.eventYear}.`,
        );
      }

      const importedState = payload.state;
      const validResourceIds = new Set(config.resources.map((item) => item.id));
      if (!Array.isArray(importedState.sources)) {
        throw new Error("The imported source list is missing.");
      }

      const sources = importedState.sources
        .filter((row) => validResourceIds.has(row.resourceId))
        .map(normalizeSourceRow);
      const rewardSelections = createDefaultState().rewardSelections;

      for (const reward of config.rewards) {
        const importedSelection = importedState.rewardSelections?.[reward.id];
        if (!importedSelection) {
          continue;
        }
        rewardSelections[reward.id] = {
          quantity: clampInteger(
            importedSelection.quantity,
            0,
            reward.maxQuantity,
          ),
          included: Boolean(importedSelection.included),
        };
      }

      state = {
        schemaVersion: config.schemaVersion,
        eventId: config.eventId,
        sources,
        rewardSelections,
      };
      saveState();
      renderSources();
      renderRewards();
      updateDerivedViews();
      showToast("Planner data imported.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not import that file.", "error");
    }
  }

  function showToast(message, type = "success") {
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.classList.add("is-visible");
    window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
  }

  function getResource(resourceId) {
    return config.resources.find((resource) => resource.id === resourceId);
  }

  function getReward(rewardId) {
    return config.rewards.find((reward) => reward.id === rewardId);
  }

  function normalizeNonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return 0;
    }
    return Math.floor(number);
  }

  function clampInteger(value, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return minimum;
    }
    return Math.min(maximum, Math.max(minimum, Math.floor(number)));
  }

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function createId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();
