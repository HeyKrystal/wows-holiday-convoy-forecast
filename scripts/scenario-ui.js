(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const {
    createFileSafeName,
    normalizeScenarioName,
    removeFileExtension,
  } = app.utils;

  function create({ config, store, elements, onScenarioChanged, showToast }) {
    let dialogRequest = null;
    let dialogSubmitted = false;

    function bind() {
      elements.scenarioSelect.addEventListener("change", handleScenarioChange);
      elements.newScenarioButton.addEventListener("click", createNewScenario);
      elements.renameScenarioButton.addEventListener("click", renameCurrentScenario);
      elements.duplicateScenarioButton.addEventListener(
        "click",
        duplicateCurrentScenario,
      );
      elements.deleteScenarioButton.addEventListener("click", deleteCurrentScenario);
      elements.resetButton.addEventListener("click", resetCurrentScenario);
      elements.exportButton.addEventListener("click", exportCurrentScenario);
      elements.importButton.addEventListener("click", () => elements.importInput.click());
      elements.importInput.addEventListener("change", importScenarioFile);

      elements.scenarioDialogForm.addEventListener("submit", handleDialogSubmit);
      elements.scenarioDialogCancelButton.addEventListener("click", closeDialog);
      elements.scenarioDialogCloseButton.addEventListener("click", closeDialog);
      elements.scenarioDialog.addEventListener("close", resetDialog);
      elements.scenarioNameInput.addEventListener("input", clearDialogError);
    }

    function applyCopy() {
      const singularLower = store.COPY.singular.toLocaleLowerCase();
      const pluralLower = store.COPY.plural.toLocaleLowerCase();
      elements.scenarioManagerHeading.textContent = store.COPY.plural;
      elements.scenarioSelectLabel.textContent = `Current ${singularLower}`;
      elements.storageNoticeHeading.textContent =
        `Your ${pluralLower} are saved on this device.`;
      elements.storageNoticeText.textContent =
        ` Data is saved in your browser using local storage. You should export or share important ${pluralLower} before clearing browser data or moving to another device.`;
    }

    function render() {
      const active = store.getActive();
      const library = store.getLibrary();
      elements.scenarioSelect.replaceChildren();
      for (const scenario of library.scenarios) {
        const option = document.createElement("option");
        option.value = scenario.id;
        option.textContent = scenario.name;
        option.selected = scenario.id === active.id;
        elements.scenarioSelect.append(option);
      }
      const count = library.scenarios.length;
      elements.scenarioCount.textContent = `${count} saved`;
      elements.deleteScenarioButton.disabled = count === 1;
      elements.deleteScenarioButton.title =
        count === 1
          ? `At least one ${store.COPY.singular.toLowerCase()} must remain.`
          : `Delete ${active.name}`;
    }

    function handleScenarioChange(event) {
      if (!store.activate(event.target.value)) {
        render();
        return;
      }
      render();
      onScenarioChanged();
      showToast(`Loaded "${store.getActive().name}".`, "success");
    }

    function createNewScenario() {
      openNameDialog({
        title: `New ${store.COPY.singular}`,
        description: "Create a fresh set of token sources and planned acquisitions.",
        submitLabel: "Create",
        initialValue: store.makeUniqueName(store.COPY.newName),
        onSubmit(name) {
          const scenario = store.add(name, app.plannerState.createDefault(config));
          render();
          onScenarioChanged();
          showToast(`Created "${scenario.name}".`, "success");
        },
      });
    }

    function renameCurrentScenario() {
      const active = store.getActive();
      openNameDialog({
        title: `Rename ${store.COPY.singular}`,
        description: "Choose a name that will make this scenario easier to recognize.",
        submitLabel: "Rename",
        initialValue: active.name,
        excludedScenarioId: active.id,
        onSubmit(name) {
          if (name === active.name) {
            return;
          }
          store.rename(active.id, name);
          render();
          showToast(`Renamed to "${name}".`, "success");
        },
      });
    }

    function duplicateCurrentScenario() {
      const active = store.getActive();
      openNameDialog({
        title: `Duplicate ${store.COPY.singular}`,
        description: `Create a copy of "${active.name}" that you can modify independently.`,
        submitLabel: "Duplicate",
        initialValue: store.makeUniqueName(`${active.name} Copy`),
        onSubmit(name) {
          const scenario = store.duplicate(active.id, name);
          render();
          onScenarioChanged();
          showToast(`Duplicated as "${scenario.name}".`, "success");
        },
      });
    }

    function deleteCurrentScenario() {
      const active = store.getActive();
      if (store.getLibrary().scenarios.length === 1) {
        showToast(
          `At least one ${store.COPY.singular.toLowerCase()} must remain.`,
          "error",
        );
        return;
      }
      if (!window.confirm(`Delete "${active.name}"? This cannot be undone.`)) {
        return;
      }
      store.remove(active.id);
      render();
      onScenarioChanged();
      showToast(`Deleted "${active.name}".`, "success");
    }

    function resetCurrentScenario() {
      const active = store.getActive();
      if (!window.confirm(`Reset "${active.name}" to its default rows and selections?`)) {
        return;
      }
      store.resetActive();
      onScenarioChanged();
      showToast(`"${active.name}" reset to defaults.`, "success");
    }

    function exportCurrentScenario() {
      const active = store.getActive();
      const payload = store.createTransferPayload(active);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = [
        "holiday-convoy-forecast",
        config.eventYear,
        createFileSafeName(active.name),
      ].join("-") + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported "${active.name}".`, "success");
    }

    async function importScenarioFile(event) {
      const [file] = event.target.files;
      event.target.value = "";
      if (!file) {
        return;
      }
      try {
        const imported = store.parseTransferPayload(JSON.parse(await file.text()));
        const suggestedName = store.makeUniqueName(
          imported.name || removeFileExtension(file.name) || store.COPY.newName,
        );
        openNameDialog({
          title: `Import ${store.COPY.singular}`,
          description: "Name the imported scenario before adding it to this device.",
          submitLabel: "Import",
          initialValue: suggestedName,
          onSubmit(name) {
            const scenario = store.add(name, imported.state);
            render();
            onScenarioChanged();
            showToast(`Imported "${scenario.name}".`, "success");
          },
        });
      } catch (error) {
        console.error(error);
        showToast(error.message || "Could not import that file.", "error");
      }
    }

    function openNameDialog({
      title,
      description,
      submitLabel,
      initialValue,
      excludedScenarioId = null,
      onSubmit,
      onCancel = null,
    }) {
      dialogRequest = { excludedScenarioId, onSubmit, onCancel };
      dialogSubmitted = false;
      elements.scenarioDialogKicker.textContent = store.COPY.singular;
      elements.scenarioDialogTitle.textContent = title;
      elements.scenarioDialogDescription.textContent = description;
      elements.scenarioDialogSubmitButton.textContent = submitLabel;
      elements.scenarioNameInput.value = initialValue;
      clearDialogError();
      elements.scenarioDialog.showModal();
      requestAnimationFrame(() => {
        elements.scenarioNameInput.focus();
        elements.scenarioNameInput.select();
      });
    }

    function handleDialogSubmit(event) {
      event.preventDefault();
      if (!dialogRequest) {
        closeDialog();
        return;
      }
      const name = normalizeScenarioName(elements.scenarioNameInput.value);
      const error = store.validateName(name, dialogRequest.excludedScenarioId);
      if (error) {
        elements.scenarioDialogError.textContent = error;
        elements.scenarioNameInput.setAttribute("aria-invalid", "true");
        elements.scenarioNameInput.focus();
        return;
      }
      const submit = dialogRequest.onSubmit;
      dialogSubmitted = true;
      elements.scenarioDialog.close();
      submit(name);
    }

    function closeDialog() {
      if (elements.scenarioDialog.open) {
        elements.scenarioDialog.close();
      }
    }

    function clearDialogError() {
      elements.scenarioDialogError.textContent = "";
      elements.scenarioNameInput.removeAttribute("aria-invalid");
    }

    function resetDialog() {
      const request = dialogRequest;
      const wasSubmitted = dialogSubmitted;
      dialogRequest = null;
      dialogSubmitted = false;
      clearDialogError();
      elements.scenarioDialogForm.reset();
      if (!wasSubmitted) {
        request?.onCancel?.();
      }
    }

    return { applyCopy, bind, openNameDialog, render };
  }

  app.scenarioUI = { create };
})();
