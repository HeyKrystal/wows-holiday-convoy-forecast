(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const {
    createId,
    decodeBase64Url,
    encodeBase64Url,
    normalizeNonNegativeInteger,
  } = app.utils;

  const SHARE_PARAMETER = "scenario";
  const SHARE_VERSION = 1;

  function encodeScenario(scenario, config) {
    const payload = {
      v: SHARE_VERSION,
      e: config.eventId,
      n: scenario.name,
      s: scenario.state.sources.map((source) => [
        source.name,
        source.resourceId,
        source.value,
        source.included ? 1 : 0,
      ]),
      r: Object.entries(scenario.state.rewardSelections).map(
        ([rewardId, selection]) => [
          rewardId,
          selection.quantity,
          selection.included ? 1 : 0,
        ],
      ),
    };
    return encodeBase64Url(JSON.stringify(payload));
  }

  function decodeScenario(encoded, config) {
    const payload = JSON.parse(decodeBase64Url(encoded));
    if (payload.v !== SHARE_VERSION) {
      throw new Error("This shared scenario uses an unsupported link format.");
    }
    if (payload.e !== config.eventId) {
      throw new Error(
        `This shared scenario is not for ${config.eventName} ${config.eventYear}.`,
      );
    }
    if (!Array.isArray(payload.s) || !Array.isArray(payload.r)) {
      throw new Error("This shared scenario is missing required data.");
    }

    const sources = payload.s.map((source) => ({
      id: createId("source"),
      name: String(source?.[0] ?? ""),
      resourceId: String(source?.[1] ?? ""),
      value: normalizeNonNegativeInteger(source?.[2]),
      included: Boolean(source?.[3]),
    }));
    const rewardSelections = Object.fromEntries(
      payload.r.map((selection) => [
        String(selection?.[0] ?? ""),
        {
          quantity: normalizeNonNegativeInteger(selection?.[1]),
          included: Boolean(selection?.[2]),
        },
      ]),
    );

    return {
      name: String(payload.n ?? ""),
      state: app.plannerState.normalize(
        {
          schemaVersion: config.schemaVersion,
          eventId: config.eventId,
          sources,
          rewardSelections,
        },
        config,
      ),
    };
  }

  function create({ config, store, scenarioUI, elements, onScenarioChanged, showToast }) {
    function bind() {
      elements.shareScenarioButton.addEventListener("click", openShareDialog);
      elements.shareDialogCloseButton.addEventListener("click", closeShareDialog);
      elements.shareDialogDoneButton.addEventListener("click", closeShareDialog);
      elements.copyShareLinkButton.addEventListener("click", copyShareLink);
      elements.shareLinkInput.addEventListener("focus", (event) => event.target.select());

      /*
       * Handle share links clicked from within the already-open application.
       * Changing only the URL fragment does not reload the page.
       */
      window.addEventListener("hashchange", handleIncomingLink);
    }

    function createShareUrl() {
      const url = new URL(window.location.href);
      url.hash = new URLSearchParams({
        [SHARE_PARAMETER]: encodeScenario(store.getActive(), config),
      }).toString();
      return url.toString();
    }

    function openShareDialog() {
      const active = store.getActive();
      const url = createShareUrl();
      elements.shareDialogTitle.textContent = `Share “${active.name}”`;
      elements.shareLinkInput.value = url;
      elements.shareLinkLength.textContent = `${url.length.toLocaleString()} characters`;
      elements.shareLocalFileWarning.hidden = window.location.protocol !== "file:";
      elements.shareLinkWarning.hidden = url.length < 7000;
      elements.shareDialog.showModal();
      requestAnimationFrame(() => elements.shareLinkInput.select());
    }

    function closeShareDialog() {
      if (elements.shareDialog.open) {
        elements.shareDialog.close();
      }
    }

    async function copyShareLink() {
      const value = elements.shareLinkInput.value;
      let copied = false;
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch {
        elements.shareLinkInput.focus();
        elements.shareLinkInput.select();
        copied = document.execCommand?.("copy") === true;
      }
      showToast(
        copied ? "Share link copied." : "Select and copy the link manually.",
        copied ? "success" : "error",
      );
    }

    function readIncomingPayload() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const encoded = params.get(SHARE_PARAMETER);
      return encoded ? decodeScenario(encoded, config) : null;
    }

    function handleIncomingLink() {
      let imported;
      try {
        imported = readIncomingPayload();
      } catch (error) {
        console.error(error);
        clearShareHash();
        showToast(error.message || "Could not read that shared scenario.", "error");
        return;
      }
      if (!imported) {
        return;
      }
      
      const existingScenario = store
        .getLibrary()
        .scenarios
        .find(
          (scenario) =>
            scenario.name.localeCompare(imported.name, undefined, {
              sensitivity: "accent",
            }) === 0,
        );

      if (existingScenario) {
        store.activate(existingScenario.id);
        scenarioUI.render();
        onScenarioChanged();
        clearShareHash();

        showToast(
          `Loaded existing scenario “${existingScenario.name}”.`,
          "success",
        );

        return;
      }

      scenarioUI.openNameDialog({
        title: `Import Shared ${store.COPY.singular}`,
        description:
          "This link contains one scenario. Name it before adding it to the scenarios already saved on this device.",
        submitLabel: "Import",
        initialValue: store.makeUniqueName(
          imported.name || `Shared ${store.COPY.singular}`,
        ),
        onSubmit(name) {
          const scenario = store.add(name, imported.state);
          scenarioUI.render();
          onScenarioChanged();
          clearShareHash();
          showToast(`Imported shared scenario as “${scenario.name}”.`, "success");
        },
        onCancel: clearShareHash,
      });
    }

    function clearShareHash() {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.hash.slice(1));
      params.delete(SHARE_PARAMETER);
      const remaining = params.toString();
      const nextLocation = `${url.pathname}${url.search}${remaining ? `#${remaining}` : ""}`;
      try {
        history.replaceState(null, "", nextLocation);
      } catch {
        window.location.hash = remaining;
      }
    }

    return { bind, handleIncomingLink };
  }

  app.share = { create, decodeScenario, encodeScenario };
})();
