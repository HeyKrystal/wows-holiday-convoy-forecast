(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { createId, cssEscape, normalizeNonNegativeInteger } = app.utils;
  const { createToggle } = app.uiCommon;

  function create({ config, body, getState, onSave, onDerivedChange }) {
    let draggedSourceId = null;
    let dropTargetSourceId = null;
    let dropPosition = null;

    function getResource(resourceId) {
      return config.resources.find((resource) => resource.id === resourceId);
    }

    function bind() {
      body.addEventListener("input", handleInput);
      body.addEventListener("change", handleChange);
      body.addEventListener("click", handleClick);
      body.addEventListener("dragstart", handleDragStart);
      body.addEventListener("dragover", handleDragOver);
      body.addEventListener("drop", handleDrop);
      body.addEventListener("dragend", resetDragState);
    }

    function render() {
      const state = getState();
      body.replaceChildren();

      for (const [sourceIndex, source] of state.sources.entries()) {
        const resource = getResource(source.resourceId);
        const row = document.createElement("tr");
        row.dataset.sourceId = source.id;
        row.style.setProperty("--resource-color", resource.color);
        row.style.setProperty("--resource-accent", resource.accent);

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

        const moveUpButton = createMoveButton(source, "up", "↑", sourceIndex === 0);
        const moveDownButton = createMoveButton(
          source,
          "down",
          "↓",
          sourceIndex === state.sources.length - 1,
        );
        reorderButtons.append(dragHandle, moveUpButton, moveDownButton);
        reorderCell.append(reorderButtons);

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
        body.append(row);
      }
    }

    function createMoveButton(source, direction, glyph, disabled) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-button move-source-button";
      button.dataset.action = `move-source-${direction}`;
      button.title = `Move source ${direction}`;
      button.setAttribute(
        "aria-label",
        `Move ${source.name || "source"} ${direction}`,
      );
      button.textContent = glyph;
      button.disabled = disabled;
      return button;
    }

    function updateRows(calculations) {
      for (const source of getState().sources) {
        const row = body.querySelector(
          `tr[data-source-id="${cssEscape(source.id)}"]`,
        );
        const result = calculations.rowResults.get(source.id);
        if (!row || !result) {
          continue;
        }
        row.classList.toggle("is-excluded", !result.included);
        row.classList.toggle("is-cap-limited", result.excludedByCap > 0);
        row.querySelector(".row-token-value").textContent =
          app.utils.formatNumber(result.directTokens);
        const note = row.querySelector(".row-token-note");
        if (!result.included) {
          note.textContent = "Not included";
        } else if (result.excludedByCap > 0) {
          note.textContent = `${app.utils.formatNumber(result.excludedByCap)} over cap`;
        } else if (result.remainder > 0) {
          note.textContent = `${app.utils.formatNumber(result.remainder)} pooled`;
        } else {
          note.textContent = "";
        }
      }
    }

    function add() {
      const state = getState();
      state.sources.push({
        id: createId("source"),
        name: "New Source",
        resourceId: config.resources[0].id,
        value: 0,
        included: true,
      });
      onSave();
      render();
      onDerivedChange();
      const newestInput = body.querySelector("tr:last-child .source-name-input");
      newestInput?.focus();
      newestInput?.select();
    }

    function handleInput(event) {
      const row = event.target.closest("tr[data-source-id]");
      const field = event.target.dataset.field;
      if (!row || !field) {
        return;
      }
      const source = getState().sources.find((item) => item.id === row.dataset.sourceId);
      if (!source) {
        return;
      }
      if (field === "name") {
        source.name = event.target.value;
        event.target.title = source.name;
        onSave();
      } else if (field === "value") {
        source.value = normalizeNonNegativeInteger(event.target.value);
        onSave();
        onDerivedChange();
      }
    }

    function handleChange(event) {
      const row = event.target.closest("tr[data-source-id]");
      const field = event.target.dataset.field;
      if (!row || !field) {
        return;
      }
      const source = getState().sources.find((item) => item.id === row.dataset.sourceId);
      if (!source) {
        return;
      }
      if (field === "resourceId") {
        source.resourceId = event.target.value;
        onSave();
        render();
        onDerivedChange();
      } else if (field === "included") {
        source.included = event.target.checked;
        onSave();
        onDerivedChange();
      }
    }

    function handleClick(event) {
      const button = event.target.closest("button[data-action]");
      const row = button?.closest("tr[data-source-id]");
      if (!button || !row) {
        return;
      }
      if (button.dataset.action === "remove-source") {
        remove(row.dataset.sourceId);
      } else if (button.dataset.action === "move-source-up") {
        move(row.dataset.sourceId, -1);
      } else if (button.dataset.action === "move-source-down") {
        move(row.dataset.sourceId, 1);
      }
    }

    function move(sourceId, direction) {
      const sources = getState().sources;
      const currentIndex = sources.findIndex((source) => source.id === sourceId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sources.length) {
        return;
      }
      const [source] = sources.splice(currentIndex, 1);
      sources.splice(targetIndex, 0, source);
      onSave();
      render();
      onDerivedChange();
    }

    function remove(sourceId) {
      const state = getState();
      state.sources = state.sources.filter((source) => source.id !== sourceId);
      onSave();
      render();
      onDerivedChange();
    }

    function handleDragStart(event) {
      const handle = event.target.closest("[data-drag-handle]");
      const row = handle?.closest("tr[data-source-id]");
      if (!handle || !row || window.matchMedia("(max-width: 900px)").matches) {
        event.preventDefault();
        return;
      }
      draggedSourceId = row.dataset.sourceId;
      dropTargetSourceId = null;
      dropPosition = null;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedSourceId);
      event.dataTransfer.setDragImage(row, 24, row.offsetHeight / 2);
      requestAnimationFrame(() => row.classList.add("is-dragging"));
    }

    function handleDragOver(event) {
      if (!draggedSourceId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropIndicators();
      const targetRow = event.target.closest("tr[data-source-id]");
      if (!targetRow || targetRow.dataset.sourceId === draggedSourceId) {
        dropTargetSourceId = null;
        dropPosition = null;
        return;
      }
      const bounds = targetRow.getBoundingClientRect();
      dropTargetSourceId = targetRow.dataset.sourceId;
      dropPosition = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      targetRow.classList.add(dropPosition === "before" ? "drop-before" : "drop-after");
    }

    function handleDrop(event) {
      if (!draggedSourceId) {
        return;
      }
      event.preventDefault();
      const sourceId = draggedSourceId;
      const targetId = dropTargetSourceId;
      const position = dropPosition;
      resetDragState();
      if (!targetId || !position) {
        return;
      }

      const sources = getState().sources;
      const sourceIndex = sources.findIndex((source) => source.id === sourceId);
      if (sourceIndex < 0) {
        return;
      }
      const [source] = sources.splice(sourceIndex, 1);
      const targetIndex = sources.findIndex((item) => item.id === targetId);
      sources.splice(
        targetIndex < 0 ? sources.length : targetIndex + (position === "after" ? 1 : 0),
        0,
        source,
      );
      onSave();
      render();
      onDerivedChange();
    }

    function clearDropIndicators() {
      for (const row of body.querySelectorAll(".drop-before, .drop-after")) {
        row.classList.remove("drop-before", "drop-after");
      }
    }

    function resetDragState() {
      clearDropIndicators();
      body.querySelector(".is-dragging")?.classList.remove("is-dragging");
      draggedSourceId = null;
      dropTargetSourceId = null;
      dropPosition = null;
    }

    return { add, bind, render, updateRows };
  }

  app.sourcesUI = { create };
})();
