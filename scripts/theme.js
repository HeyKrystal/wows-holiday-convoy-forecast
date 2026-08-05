(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const STORAGE_KEY = "holiday-convoy-theme";
  const SYSTEM_QUERY = "(prefers-color-scheme: dark)";
  const VALID_PREFERENCES = new Set(["system", "light", "dark"]);

  function create({ control }) {
    const systemPreference = window.matchMedia(SYSTEM_QUERY);
    let preference = readPreference();

    function readPreference() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return VALID_PREFERENCES.has(saved) ? saved : "system";
      } catch (error) {
        console.warn("Could not read the saved theme preference.", error);
        return "system";
      }
    }

    function resolveTheme() {
      if (preference === "system") {
        return systemPreference.matches ? "dark" : "light";
      }
      return preference;
    }

    function applyTheme() {
      document.documentElement.dataset.theme = resolveTheme();
      document.documentElement.dataset.themePreference = preference;
      control.value = preference;
    }

    function savePreference() {
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch (error) {
        console.warn("Could not save the theme preference.", error);
      }
    }

    function handleControlChange(event) {
      const nextPreference = event.target.value;
      if (!VALID_PREFERENCES.has(nextPreference)) {
        return;
      }
      preference = nextPreference;
      savePreference();
      applyTheme();
    }

    function handleSystemChange() {
      if (preference === "system") {
        applyTheme();
      }
    }

    function bind() {
      control.addEventListener("change", handleControlChange);
      systemPreference.addEventListener?.("change", handleSystemChange);
      applyTheme();
    }

    return {
      bind,
      getPreference: () => preference,
      getResolvedTheme: resolveTheme,
    };
  }

  app.theme = { create };
})();
