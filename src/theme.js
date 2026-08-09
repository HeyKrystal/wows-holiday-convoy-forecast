(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const STORAGE_KEY = "holiday-convoy-theme";
  const SYSTEM_QUERY = "(prefers-color-scheme: dark)";
  const VALID_PREFERENCES = new Set(["system", "light", "dark"]);

  /**
   * Creates the footer theme control.
   *
   * The page still stores exactly the same three preferences it always has:
   * System, Light, and Dark. The only change is presentation—the old <select>
   * has been replaced by a segmented button control like Collections Calc.
   */
  function create({ control }) {
    const systemPreference = window.matchMedia(SYSTEM_QUERY);
    const buttons = Array.from(control.querySelectorAll("[data-theme-choice]"));
    let preference = readPreference();

    if (buttons.length === 0) {
      throw new Error("The theme control does not contain any theme choice buttons.");
    }

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

    /**
     * Applies the resolved theme and keeps aria-pressed synchronized so the
     * selected segment is clear visually and to assistive technology.
     */
    function applyTheme() {
      document.documentElement.dataset.theme = resolveTheme();
      document.documentElement.dataset.themePreference = preference;

      for (const button of buttons) {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.themeChoice === preference),
        );
      }
    }

    function savePreference() {
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch (error) {
        // The selected theme still works for this page load if storage is
        // unavailable; it simply cannot be remembered for the next visit.
        console.warn("Could not save the theme preference.", error);
      }
    }

    function handleControlClick(event) {
      const button = event.target.closest("[data-theme-choice]");
      if (!button || !control.contains(button)) {
        return;
      }

      const nextPreference = button.dataset.themeChoice;
      if (!VALID_PREFERENCES.has(nextPreference)) {
        return;
      }

      preference = nextPreference;
      savePreference();
      applyTheme();
    }

    function handleSystemChange() {
      // A System preference should follow OS/browser theme changes live.
      // Explicit Light or Dark choices intentionally ignore those changes.
      if (preference === "system") {
        applyTheme();
      }
    }

    function bind() {
      control.addEventListener("click", handleControlClick);
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
