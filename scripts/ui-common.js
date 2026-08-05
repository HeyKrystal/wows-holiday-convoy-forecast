(() => {
  "use strict";

  const app = window.HolidayConvoy;

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
