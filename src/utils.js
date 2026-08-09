(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });

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

  function createId(prefix = "item") {
    if (window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function clone(value) {
    if (window.structuredClone) {
      return window.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeScenarioName(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
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

  function isValidDateString(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function encodeBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeBase64Url(value) {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  app.utils = {
    clampInteger,
    clone,
    createFileSafeName,
    createId,
    cssEscape,
    decodeBase64Url,
    encodeBase64Url,
    formatNumber,
    isValidDateString,
    normalizeNonNegativeInteger,
    normalizeScenarioName,
    removeFileExtension,
  };
})();
