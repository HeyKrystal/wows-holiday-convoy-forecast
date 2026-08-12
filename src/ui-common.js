(() => {
  "use strict";

  const app = window.HolidayConvoy;
  let resourceTooltipId = 0;

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

  let resourceTooltipId = 0;

  function createResourceBadge(
    resource,
    { showTooltip = false } = {},
  ) {
    const badge = document.createElement("span");
    badge.className = "resource-badge";
    badge.textContent = resource.label;
    badge.style.setProperty("--badge-color", resource.color);
    badge.style.setProperty("--badge-accent", resource.accent);

    const tooltipText = String(resource.tooltip ?? "").trim();

    if (!showTooltip || !tooltipText) {
      return badge;
    }

    resourceTooltipId += 1;

    const tooltipId = `resourceTooltip${resourceTooltipId}`;

    badge.classList.add("has-tooltip");
    badge.tabIndex = 0;
    badge.setAttribute("aria-describedby", tooltipId);

    const tooltip = document.createElement("span");
    tooltip.className = "resource-badge-tooltip";
    tooltip.id = tooltipId;
    tooltip.role = "tooltip";
    tooltip.textContent = tooltipText;

    badge.append(tooltip);

    return badge;
  }

  function createToast(element) {
    let timer = null;
    return (message, type = "success") => {
      element.textContent = message;
      element.dataset.type = type;
      element.classList.add("is-visible");
      clearTimeout(timer);
      timer = window.setTimeout(() => element.classList.remove("is-visible"), 3000);
    };
  }

  app.uiCommon = { createResourceBadge, createToast, createToggle };
})();
