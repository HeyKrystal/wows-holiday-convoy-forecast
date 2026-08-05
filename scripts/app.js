(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const config = window.HOLIDAY_CONVOY_CONFIG;
  if (!config) {
    throw new Error("HOLIDAY_CONVOY_CONFIG was not loaded before app.js.");
  }

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    app.plannerState.validateConfig(config);
    const elements = cacheElements();
    const showToast = app.uiCommon.createToast(elements.toast);
    const showSavedStatus = createSavedStatus(elements.savedStatus);
    const theme = app.theme.create({ control: elements.themeSelect });
    const aboutUI = app.aboutUI.create({ config, elements });

    const store = app.scenarioStore.create({
      config,
      onSaved: showSavedStatus,
      onError: (message) => showToast(message, "error"),
    });

    let sourcesUI;
    let rewardsUI;
    let summaryUI;

    function getState() {
      return store.getActive().state;
    }

    function saveState() {
      store.saveActiveState(getState());
    }

    function updateDerivedViews() {
      const calculations = app.calculator.calculate(getState(), config);
      sourcesUI.updateRows(calculations);
      rewardsUI.updateRows(calculations);
      summaryUI.render(calculations);
    }

    function renderPlanner() {
      sourcesUI.render();
      rewardsUI.render();
      updateDerivedViews();
    }

    const scenarioUI = app.scenarioUI.create({
      config,
      store,
      elements,
      onScenarioChanged: renderPlanner,
      showToast,
    });

    sourcesUI = app.sourcesUI.create({
      config,
      body: elements.sourcesBody,
      getState,
      onSave: saveState,
      onDerivedChange: updateDerivedViews,
    });

    rewardsUI = app.rewardsUI.create({
      config,
      body: elements.rewardsBody,
      getState,
      onSave: saveState,
      onDerivedChange: updateDerivedViews,
    });

    summaryUI = app.summaryUI.create({ config, elements });

    const share = app.share.create({
      config,
      store,
      scenarioUI,
      elements,
      onScenarioChanged: renderPlanner,
      showToast,
    });

    theme.bind();
    aboutUI.start();
    applyEventCopy(elements);
    scenarioUI.applyCopy();
    scenarioUI.bind();
    sourcesUI.bind();
    rewardsUI.bind();
    share.bind();
    elements.addSourceButton.addEventListener("click", sourcesUI.add);

    scenarioUI.render();
    summaryUI.renderResourceRules();
    renderPlanner();
    share.handleIncomingLink();
  }

  function applyEventCopy(elements) {
    document.title = config.appTitle;
    elements.eventEyebrow.textContent = `${config.eventName} ${config.eventYear}`;
    elements.appTitle.textContent = config.appTitle;
    elements.appSubtitle.textContent = config.appSubtitle;
  }

  function createSavedStatus(element) {
    let timer = null;
    return () => {
      element.textContent = "Saved locally";
      element.classList.add("is-visible");
      clearTimeout(timer);
      timer = window.setTimeout(() => element.classList.remove("is-visible"), 1600);
    };
  }

  function cacheElements() {
    const ids = [
      "eventEyebrow",
      "appTitle",
      "appSubtitle",
      "resourceRulesBody",
      "sourcesBody",
      "resourceBreakdownBody",
      "rewardsBody",
      "addSourceButton",
      "resetButton",
      "exportButton",
      "importButton",
      "importInput",
      "savedStatus",
      "storageNoticeHeading",
      "storageNoticeText",
      "eventStatusText",
      "earnDateRange",
      "spendDateRange",
      "officialEventLink",
      "scenarioManagerHeading",
      "scenarioSelectLabel",
      "scenarioSelect",
      "scenarioCount",
      "newScenarioButton",
      "renameScenarioButton",
      "duplicateScenarioButton",
      "deleteScenarioButton",
      "shareScenarioButton",
      "scenarioDialog",
      "scenarioDialogForm",
      "scenarioDialogKicker",
      "scenarioDialogTitle",
      "scenarioDialogDescription",
      "scenarioNameInput",
      "scenarioDialogError",
      "scenarioDialogSubmitButton",
      "scenarioDialogCancelButton",
      "scenarioDialogCloseButton",
      "deleteScenarioDialog",
      "deleteScenarioDialogTitle",
      "deleteScenarioDialogDescription",
      "deleteScenarioDialogCloseButton",
      "deleteScenarioDialogCancelButton",
      "confirmDeleteScenarioButton",
      "shareDialog",
      "shareDialogTitle",
      "shareDialogCloseButton",
      "shareLinkInput",
      "copyShareLinkButton",
      "shareDialogDoneButton",
      "shareLinkLength",
      "shareLocalFileWarning",
      "shareLinkWarning",
      "budgetValue",
      "costValue",
      "differenceLabel",
      "differenceValue",
      "budgetProgress",
      "budgetProgressText",
      "cappedLeftovers",
      "toast",
      "themeSelect",
    ];
    return Object.fromEntries(
      ids.map((id) => {
        const element = document.getElementById(id);
        if (!element) {
          throw new Error(`Required page element #${id} was not found.`);
        }
        return [id, element];
      }),
    );
  }
})();
