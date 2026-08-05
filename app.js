(() => {
  "use strict";

  const config = window.HOLIDAY_CONVOY_CONFIG;

  if (!config) {
    throw new Error("HOLIDAY_CONVOY_CONFIG was not loaded before app.js.");
  }

  // Keep the original storage prefix so existing single-forecast saves migrate
  // automatically instead of appearing to disappear after this update.
  const STORAGE_PREFIX = "holiday-convoy-budget";
  const storageKey = `${STORAGE_PREFIX}:${config.eventId}`;
  const SCENARIO_LIBRARY_VERSION = 1;

  // Change these labels in one place if you later prefer "Budgets",
  // "Forecasts", or another name for saved instances.
  const SCENARIO_COPY = Object.freeze({
    singular: "Scenario",
    plural: "Scenarios",
    defaultName: "Main Scenario",
    newName: "New Scenario",
  });

  const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });

  const elements = {};
  let scenarioLibrary = loadScenarioLibrary();
  let state = getActiveScenario().state;
  let saveStatusTimer = null;

  let draggedSourceId = null;
  let dropTargetSourceId = null;
  let dropPosition = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    validateConfig();
    cacheElements();
    applyEventCopy();
    renderScenarioManager();
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
    elements.storageNoticeHeading = document.querySelector(
      "#storageNoticeHeading",
    );
    elements.storageNoticeText = document.querySelector("#storageNoticeText");
    elements.scenarioManager = document.querySelector("#scenarioManager");
    elements.scenarioManagerHeading = document.querySelector(
      "#scenarioManagerHeading",
    );
    elements.scenarioSelectLabel = document.querySelector(
      "#scenarioSelectLabel",
    );
    elements.scenarioSelect = document.querySelector("#scenarioSelect");
    elements.scenarioCount = document.querySelector("#scenarioCount");
    elements.newScenarioButton = document.querySelector("#newScenarioButton");
    elements.renameScenarioButton = document.querySelector(
      "#renameScenarioButton",
    );
    elements.duplicateScenarioButton = document.querySelector(
      "#duplicateScenarioButton",
    );
    elements.deleteScenarioButton = document.querySelector(
      "#deleteScenarioButton",
    );
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

    const singularLower = SCENARIO_COPY.singular.toLocaleLowerCase();
    const pluralLower = SCENARIO_COPY.plural.toLocaleLowerCase();
    elements.scenarioManagerHeading.textContent = SCENARIO_COPY.plural;
    elements.scenarioSelectLabel.textContent = `Current ${singularLower}`;
    elements.storageNoticeHeading.textContent =
      `Your ${pluralLower} are saved on this device.`;
    elements.storageNoticeText.textContent =
      ` Data is saved in your browser using local storage. You should export or share important ${pluralLower} before clearing browser data or moving to another device.`;

    // The footer year is optional. Removing its span from index.html will no
    // longer stop the rest of the app from loading.
    if (elements.footerYear) {
      elements.footerYear.textContent = config.eventYear;
    }
  }

  function bindEvents() {
    elements.addSourceButton.addEventListener("click", addSourceRow);
    elements.resetButton.addEventListener("click", resetPlanner);
    elements.exportButton.addEventListener("click", exportPlannerData);
    elements.importButton.addEventListener("click", () =>
      elements.importInput.click(),
    );
    elements.importInput.addEventListener("change", importPlannerData);

    elements.scenarioSelect.addEventListener("change", handleScenarioChange);
    elements.newScenarioButton.addEventListener("click", createNewScenario);
    elements.renameScenarioButton.addEventListener(
      "click",
      renameCurrentScenario,
    );
    elements.duplicateScenarioButton.addEventListener(
      "click",
      duplicateCurrentScenario,
    );
    elements.deleteScenarioButton.addEventListener(
      "click",
      deleteCurrentScenario,
    );

    elements.sourcesBody.addEventListener("input", handleSourceInput);
    elements.sourcesBody.addEventListener("change", handleSourceChange);
    elements.sourcesBody.addEventListener("click", handleSourceClick);

    elements.sourcesBody.addEventListener(
      "dragstart",
      handleSourceDragStart,
    );
    elements.sourcesBody.addEventListener(
      "dragover",
      handleSourceDragOver,
    );
    elements.sourcesBody.addEventListener(
      "drop",
      handleSourceDrop,
    );
    elements.sourcesBody.addEventListener(
      "dragend",
      handleSourceDragEnd,
    );

    elements.rewardsBody.addEventListener("input", handleRewardInput);
    elements.rewardsBody.addEventListener("change", handleRewardChange);
  }

  function createDefaultPlannerState() {
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

  function createScenarioRecord(name, plannerState = createDefaultPlannerState()) {
    const now = new Date().toISOString();

    return {
      id: createScenarioId(),
      name: normalizeScenarioName(name) || SCENARIO_COPY.defaultName,
      createdAt: now,
      updatedAt: now,
      state: normalizePlannerState(plannerState),
    };
  }

  function createDefaultScenarioLibrary() {
    const scenario = createScenarioRecord(SCENARIO_COPY.defaultName);

    return {
      libraryVersion: SCENARIO_LIBRARY_VERSION,
      eventId: config.eventId,
      activeScenarioId: scenario.id,
      scenarios: [scenario],
    };
  }

  function loadScenarioLibrary() {
    const defaults = createDefaultScenarioLibrary();

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return defaults;
      }

      const saved = JSON.parse(raw);
      if (saved.eventId !== config.eventId) {
        return defaults;
      }

      // Current multi-scenario format.
      if (Array.isArray(saved.scenarios)) {
        const scenarios = saved.scenarios
          .map((scenario, index) => normalizeScenarioRecord(scenario, index))
          .filter(Boolean);

        if (!scenarios.length) {
          return defaults;
        }

        const activeScenarioId = scenarios.some(
          (scenario) => scenario.id === saved.activeScenarioId,
        )
          ? saved.activeScenarioId
          : scenarios[0].id;

        return {
          libraryVersion: SCENARIO_LIBRARY_VERSION,
          eventId: config.eventId,
          activeScenarioId,
          scenarios,
        };
      }

      // Migrate the original single-state save into a scenario library.
      if (Array.isArray(saved.sources)) {
        const migratedScenario = createScenarioRecord(
          SCENARIO_COPY.defaultName,
          saved,
        );
        const migratedLibrary = {
          libraryVersion: SCENARIO_LIBRARY_VERSION,
          eventId: config.eventId,
          activeScenarioId: migratedScenario.id,
          scenarios: [migratedScenario],
        };

        localStorage.setItem(storageKey, JSON.stringify(migratedLibrary));
        return migratedLibrary;
      }

      return defaults;
    } catch (error) {
      console.warn("Could not load saved scenario data.", error);
      return defaults;
    }
  }

  function normalizeScenarioRecord(scenario, index) {
    if (!scenario || typeof scenario !== "object") {
      return null;
    }

    const plannerState = scenario.state ?? scenario.data;
    if (!plannerState || typeof plannerState !== "object") {
      return null;
    }

    const createdAt = isValidDateString(scenario.createdAt)
      ? scenario.createdAt
      : new Date().toISOString();
    const updatedAt = isValidDateString(scenario.updatedAt)
      ? scenario.updatedAt
      : createdAt;

    return {
      id: String(scenario.id || createScenarioId()),
      name:
        normalizeScenarioName(scenario.name) ||
        `${SCENARIO_COPY.singular} ${index + 1}`,
      createdAt,
      updatedAt,
      state: normalizePlannerState(plannerState),
    };
  }

  function normalizePlannerState(savedState) {
    const defaults = createDefaultPlannerState();

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
      const savedSelection = savedState.rewardSelections?.[reward.id];
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
      sources,
      rewardSelections,
    };
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
    const activeScenario = getActiveScenario();
    activeScenario.state = state;
    activeScenario.updatedAt = new Date().toISOString();
    persistScenarioLibrary();
  }

  function persistScenarioLibrary(showStatus = true) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(scenarioLibrary));
      if (showStatus) {
        showSavedStatus();
      }
    } catch (error) {
      console.error("Could not save scenario data.", error);
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

  function getActiveScenario() {
    let activeScenario = scenarioLibrary.scenarios.find(
      (scenario) => scenario.id === scenarioLibrary.activeScenarioId,
    );

    if (!activeScenario) {
      activeScenario = scenarioLibrary.scenarios[0];
      scenarioLibrary.activeScenarioId = activeScenario.id;
    }

    return activeScenario;
  }

  function renderScenarioManager() {
    const activeScenario = getActiveScenario();
    elements.scenarioSelect.replaceChildren();

    for (const scenario of scenarioLibrary.scenarios) {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.name;
      option.selected = scenario.id === activeScenario.id;
      elements.scenarioSelect.append(option);
    }

    const scenarioCount = scenarioLibrary.scenarios.length;
    elements.scenarioCount.textContent = `${scenarioCount} saved`;
    elements.deleteScenarioButton.disabled = scenarioCount === 1;
    elements.deleteScenarioButton.title =
      scenarioCount === 1
        ? `At least one ${SCENARIO_COPY.singular.toLowerCase()} must remain.`
        : `Delete ${activeScenario.name}`;
  }

  function handleScenarioChange(event) {
    const scenarioId = event.target.value;
    if (
      !scenarioLibrary.scenarios.some((scenario) => scenario.id === scenarioId)
    ) {
      renderScenarioManager();
      return;
    }

    scenarioLibrary.activeScenarioId = scenarioId;
    state = getActiveScenario().state;
    persistScenarioLibrary(false);
    renderScenarioManager();
    renderSources();
    renderRewards();
    updateDerivedViews();
    showToast(`Loaded "${getActiveScenario().name}".`, "success");
  }

  function createNewScenario() {
    const suggestedName = makeUniqueScenarioName(SCENARIO_COPY.newName);
    const name = requestScenarioName(
      `Name the new ${SCENARIO_COPY.singular.toLowerCase()}:`,
      suggestedName,
    );

    if (!name) {
      return;
    }

    const scenario = createScenarioRecord(name);
    scenarioLibrary.scenarios.push(scenario);
    activateScenario(scenario.id);
    showToast(`Created "${scenario.name}".`, "success");
  }

  function renameCurrentScenario() {
    const activeScenario = getActiveScenario();
    const name = requestScenarioName(
      `Rename this ${SCENARIO_COPY.singular.toLowerCase()}:`,
      activeScenario.name,
      activeScenario.id,
    );

    if (!name || name === activeScenario.name) {
      return;
    }

    activeScenario.name = name;
    activeScenario.updatedAt = new Date().toISOString();
    persistScenarioLibrary();
    renderScenarioManager();
    showToast(`Renamed to "${name}".`, "success");
  }

  function duplicateCurrentScenario() {
    const activeScenario = getActiveScenario();
    const suggestedName = makeUniqueScenarioName(`${activeScenario.name} Copy`);
    const name = requestScenarioName(
      `Name the duplicated ${SCENARIO_COPY.singular.toLowerCase()}:`,
      suggestedName,
    );

    if (!name) {
      return;
    }

    const scenario = createScenarioRecord(
      name,
      clonePlannerState(activeScenario.state),
    );
    scenarioLibrary.scenarios.push(scenario);
    activateScenario(scenario.id);
    showToast(`Duplicated as "${scenario.name}".`, "success");
  }

  function deleteCurrentScenario() {
    if (scenarioLibrary.scenarios.length === 1) {
      showToast(
        `At least one ${SCENARIO_COPY.singular.toLowerCase()} must remain.`,
        "error",
      );
      return;
    }

    const activeScenario = getActiveScenario();
    const confirmed = window.confirm(
      `Delete "${activeScenario.name}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    const currentIndex = scenarioLibrary.scenarios.findIndex(
      (scenario) => scenario.id === activeScenario.id,
    );
    scenarioLibrary.scenarios.splice(currentIndex, 1);

    const nextIndex = Math.min(
      Math.max(currentIndex - 1, 0),
      scenarioLibrary.scenarios.length - 1,
    );
    const nextScenario = scenarioLibrary.scenarios[nextIndex];
    scenarioLibrary.activeScenarioId = nextScenario.id;
    state = nextScenario.state;

    persistScenarioLibrary();
    renderScenarioManager();
    renderSources();
    renderRewards();
    updateDerivedViews();
    showToast(`Deleted "${activeScenario.name}".`, "success");
  }

  function activateScenario(scenarioId) {
    scenarioLibrary.activeScenarioId = scenarioId;
    state = getActiveScenario().state;
    persistScenarioLibrary();
    renderScenarioManager();
    renderSources();
    renderRewards();
    updateDerivedViews();
  }

  function requestScenarioName(message, defaultValue, excludedScenarioId = null) {
    const enteredName = window.prompt(message, defaultValue);
    if (enteredName === null) {
      return null;
    }

    const name = normalizeScenarioName(enteredName);
    if (!name) {
      showToast(`${SCENARIO_COPY.singular} names cannot be blank.`, "error");
      return null;
    }

    const nameAlreadyExists = scenarioLibrary.scenarios.some(
      (scenario) =>
        scenario.id !== excludedScenarioId &&
        scenario.name.localeCompare(name, undefined, {
          sensitivity: "accent",
        }) === 0,
    );

    if (nameAlreadyExists) {
      showToast(`A ${SCENARIO_COPY.singular.toLowerCase()} named "${name}" already exists.`, "error");
      return null;
    }

    return name;
  }

  function makeUniqueScenarioName(baseName) {
    const normalizedBase = normalizeScenarioName(baseName) || SCENARIO_COPY.newName;
    const existingNames = new Set(
      scenarioLibrary.scenarios.map((scenario) => scenario.name.toLocaleLowerCase()),
    );

    if (!existingNames.has(normalizedBase.toLocaleLowerCase())) {
      return normalizedBase;
    }

    let suffix = 2;
    while (
      existingNames.has(`${normalizedBase} ${suffix}`.toLocaleLowerCase())
    ) {
      suffix += 1;
    }

    return `${normalizedBase} ${suffix}`;
  }

  function normalizeScenarioName(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  function clonePlannerState(plannerState) {
    if (window.structuredClone) {
      return window.structuredClone(plannerState);
    }

    return JSON.parse(JSON.stringify(plannerState));
  }

  function isValidDateString(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
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

      const sourceIndex = state.sources.findIndex(
        (item) => item.id === source.id,
      );

      // Rearrangement controls
      const reorderCell = document.createElement("td");
      reorderCell.className = "reorder-cell";

      const reorderButtons = document.createElement("div");
      reorderButtons.className = "source-reorder-actions";

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "icon-button drag-handle";
      dragHandle.draggable = true;
      dragHandle.dataset.dragHandle = "true";
      dragHandle.title = "Drag to rearrange";
      dragHandle.setAttribute(
        "aria-label",
        `Drag ${source.name || "source"} to rearrange`,
      );
      dragHandle.textContent = "⠿";

      const moveUpButton = document.createElement("button");
      moveUpButton.type = "button";
      moveUpButton.className = "icon-button move-source-button";
      moveUpButton.dataset.action = "move-source-up";
      moveUpButton.title = "Move source up";
      moveUpButton.setAttribute(
        "aria-label",
        `Move ${source.name || "source"} up`,
      );
      moveUpButton.textContent = "↑";
      moveUpButton.disabled = sourceIndex === 0;

      const moveDownButton = document.createElement("button");
      moveDownButton.type = "button";
      moveDownButton.className = "icon-button move-source-button";
      moveDownButton.dataset.action = "move-source-down";
      moveDownButton.title = "Move source down";
      moveDownButton.setAttribute(
        "aria-label",
        `Move ${source.name || "source"} down`,
      );
      moveDownButton.textContent = "↓";
      moveDownButton.disabled =
        sourceIndex === state.sources.length - 1;

      reorderButtons.append(
        dragHandle,
        moveUpButton,
        moveDownButton,
      );

      reorderCell.append(reorderButtons);

      // Source description
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

      // Resource type
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

      // Resource value
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

      // Include toggle
      const includeCell = document.createElement("td");
      includeCell.className = "checkbox-cell";
      includeCell.append(
        createToggle(
          source.included,
          "included",
          "Include this source",
        ),
      );

      // Calculated tokens
      const tokenCell = document.createElement("td");
      tokenCell.className = "calculated-cell";

      const tokenValue = document.createElement("strong");
      tokenValue.className = "row-token-value";

      const tokenNote = document.createElement("small");
      tokenNote.className = "row-token-note";

      tokenCell.append(tokenValue, tokenNote);

      // Remove control
      const actionCell = document.createElement("td");
      actionCell.className = "row-action-cell";

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className =
        "icon-button remove-source-button";
      removeButton.dataset.action = "remove-source";
      removeButton.title = "Remove source";
      removeButton.setAttribute(
        "aria-label",
        `Remove ${source.name || "source"}`,
      );
      removeButton.textContent = "×";

      actionCell.append(removeButton);

      row.append(
        reorderCell,
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
    const button = event.target.closest(
      "button[data-action]",
    );

    if (!button) {
      return;
    }

    const rowElement = button.closest(
      "tr[data-source-id]",
    );

    if (!rowElement) {
      return;
    }

    const sourceId = rowElement.dataset.sourceId;

    switch (button.dataset.action) {
      case "move-source-up":
        moveSource(sourceId, -1);
        break;

      case "move-source-down":
        moveSource(sourceId, 1);
        break;

      case "remove-source":
        removeSource(sourceId);
        break;
    }
  }

  function moveSource(sourceId, direction) {
    const currentIndex = state.sources.findIndex(
      (source) => source.id === sourceId,
    );

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = currentIndex + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= state.sources.length
    ) {
      return;
    }

    const [source] = state.sources.splice(
      currentIndex,
      1,
    );

    state.sources.splice(targetIndex, 0, source);

    saveState();
    renderSources();
    updateDerivedViews();
  }

  function removeSource(sourceId) {
    state.sources = state.sources.filter(
      (source) => source.id !== sourceId,
    );

    saveState();
    renderSources();
    updateDerivedViews();
  }

  function handleSourceDragStart(event) {
    const dragHandle = event.target.closest(
      "[data-drag-handle]",
    );

    const rowElement = dragHandle?.closest(
      "tr[data-source-id]",
    );

    const isMobile = window.matchMedia(
      "(max-width: 900px)",
    ).matches;

    if (!dragHandle || !rowElement || isMobile) {
      event.preventDefault();
      return;
    }

    draggedSourceId = rowElement.dataset.sourceId;
    dropTargetSourceId = null;
    dropPosition = null;

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "text/plain",
      draggedSourceId,
    );

    event.dataTransfer.setDragImage(
      rowElement,
      24,
      rowElement.offsetHeight / 2,
    );

    requestAnimationFrame(() => {
      rowElement.classList.add("is-dragging");
    });
  }

  function handleSourceDragOver(event) {
    if (!draggedSourceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    clearSourceDropIndicators();

    const targetRow = event.target.closest(
      "tr[data-source-id]",
    );

    if (
      !targetRow ||
      targetRow.dataset.sourceId === draggedSourceId
    ) {
      dropTargetSourceId = null;
      dropPosition = null;
      return;
    }

    const targetBounds =
      targetRow.getBoundingClientRect();

    const targetMiddle =
      targetBounds.top + targetBounds.height / 2;

    dropTargetSourceId =
      targetRow.dataset.sourceId;

    dropPosition =
      event.clientY < targetMiddle
        ? "before"
        : "after";

    targetRow.classList.add(
      dropPosition === "before"
        ? "drop-before"
        : "drop-after",
    );
  }

  function handleSourceDrop(event) {
    if (!draggedSourceId) {
      return;
    }

    event.preventDefault();

    const sourceId = draggedSourceId;
    const targetId = dropTargetSourceId;
    const position = dropPosition;

    resetSourceDragState();

    if (!targetId || !position) {
      return;
    }

    const sourceIndex = state.sources.findIndex(
      (source) => source.id === sourceId,
    );

    if (sourceIndex === -1) {
      return;
    }

    const [source] = state.sources.splice(
      sourceIndex,
      1,
    );

    const targetIndex = state.sources.findIndex(
      (item) => item.id === targetId,
    );

    if (targetIndex === -1) {
      state.sources.push(source);
    } else {
      const insertionIndex =
        position === "before"
          ? targetIndex
          : targetIndex + 1;

      state.sources.splice(
        insertionIndex,
        0,
        source,
      );
    }

    saveState();
    renderSources();
    updateDerivedViews();
  }

  function handleSourceDragEnd() {
    resetSourceDragState();
  }

  function clearSourceDropIndicators() {
    for (const row of elements.sourcesBody.querySelectorAll(
      ".drop-before, .drop-after",
    )) {
      row.classList.remove(
        "drop-before",
        "drop-after",
      );
    }
  }

  function resetSourceDragState() {
    clearSourceDropIndicators();

    elements.sourcesBody
      .querySelector(".is-dragging")
      ?.classList.remove("is-dragging");

    draggedSourceId = null;
    dropTargetSourceId = null;
    dropPosition = null;
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
        tokenNote.textContent = `${formatNumber(result.excludedByCap)} over cap`;
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
    const activeScenario = getActiveScenario();
    const confirmed = window.confirm(
      `Reset "${activeScenario.name}" to its default rows and selections?`,
    );
    if (!confirmed) {
      return;
    }

    state = createDefaultPlannerState();
    activeScenario.state = state;
    saveState();
    renderSources();
    renderRewards();
    updateDerivedViews();
    showToast(`"${activeScenario.name}" reset to defaults.`, "success");
  }

  function exportPlannerData() {
    const activeScenario = getActiveScenario();
    const payload = createScenarioTransferPayload(activeScenario);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = [
      "holiday-convoy-forecast",
      config.eventYear,
      createFileSafeName(activeScenario.name),
    ].join("-") + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported "${activeScenario.name}".`, "success");
  }

  async function importPlannerData(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      const imported = parseScenarioTransferPayload(payload);
      const suggestedName = makeUniqueScenarioName(
        imported.name || removeFileExtension(file.name) || SCENARIO_COPY.newName,
      );
      const requestedName = requestScenarioName(
        `Name the imported ${SCENARIO_COPY.singular.toLowerCase()}:`,
        suggestedName,
      );

      if (!requestedName) {
        return;
      }

      const scenario = createScenarioRecord(requestedName, imported.state);
      scenarioLibrary.scenarios.push(scenario);
      activateScenario(scenario.id);
      showToast(`Imported "${scenario.name}".`, "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not import that file.", "error");
    }
  }

  function createScenarioTransferPayload(scenario = getActiveScenario()) {
    return {
      app: config.appTitle,
      format: "holiday-convoy-scenario",
      formatVersion: 1,
      schemaVersion: config.schemaVersion,
      eventId: config.eventId,
      eventYear: config.eventYear,
      exportedAt: new Date().toISOString(),
      scenarioName: scenario.name,
      state: clonePlannerState(scenario.state),
    };
  }

  function parseScenarioTransferPayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("The imported file does not contain forecast data.");
    }

    if (payload.eventId !== config.eventId) {
      throw new Error(
        `This file is not for ${config.eventName} ${config.eventYear}.`,
      );
    }

    const importedState = payload.state ?? payload.scenario?.state;
    if (!importedState || !Array.isArray(importedState.sources)) {
      throw new Error("The imported source list is missing.");
    }

    return {
      name: normalizeScenarioName(
        payload.scenarioName ?? payload.scenario?.name,
      ),
      state: normalizePlannerState(importedState),
    };
  }

  function createFileSafeName(value) {
    const safeName = normalizeScenarioName(value)
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return safeName || "scenario";
  }

  function removeFileExtension(fileName) {
    return String(fileName ?? "").replace(/\.[^.]+$/, "");
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

  function createScenarioId() {
    if (window.crypto?.randomUUID) {
      return `scenario-${window.crypto.randomUUID()}`;
    }
    return `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
