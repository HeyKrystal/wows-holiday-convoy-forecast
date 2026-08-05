(() => {
  "use strict";

  const app = window.HolidayConvoy;

  function create(options = {}) {
    const urls = Array.isArray(options.urls)
      ? options.urls.filter(Boolean)
      : [options.url].filter(Boolean);
    const timeoutMs = Number(options.requestTimeoutMs) || 8000;
    const shipsById = new Map();
    let loadPromise = null;
    let status = urls.length ? "idle" : "disabled";
    let lastError = null;

    function get(shipId) {
      return shipsById.get(String(shipId ?? "")) ?? null;
    }

    function getStatus() {
      return status;
    }

    function getLastError() {
      return lastError;
    }

    async function fetchDataset(url) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload.ships)) {
          throw new Error("The ships dataset does not contain a ships array.");
        }

        return payload;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    async function loadFromAvailableUrl() {
      if (!urls.length) {
        status = "disabled";
        return null;
      }

      status = "loading";
      const failures = [];

      for (const url of urls) {
        try {
          const payload = await fetchDataset(url);
          shipsById.clear();
          for (const ship of payload.ships) {
            if (ship?.id != null) {
              shipsById.set(String(ship.id), ship);
            }
          }
          status = "ready";
          lastError = null;
          return payload;
        } catch (error) {
          failures.push(`${url}: ${error.message}`);
        }
      }

      status = "error";
      lastError = new Error(`Unable to load ship data. ${failures.join(" | ")}`);
      throw lastError;
    }

    function load() {
      if (!loadPromise) {
        loadPromise = loadFromAvailableUrl().catch((error) => {
          loadPromise = null;
          throw error;
        });
      }
      return loadPromise;
    }

    return {
      get,
      getLastError,
      getStatus,
      load,
    };
  }

  app.shipData = { create };
})();
