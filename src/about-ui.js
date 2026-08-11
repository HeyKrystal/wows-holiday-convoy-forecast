(() => {
  "use strict";

  const app = window.HolidayConvoy;

  const REGION_STORAGE_KEY = "holiday-convoy-region";

  const MINUTE_MS = 60 * 1000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;
  const DETAILED_COUNTDOWN_THRESHOLD_MS = 3 * DAY_MS;

  const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  function create({ config, elements }) {
    const eventInfo = config.eventInfo;

    let selectedRegionId = null;
    let statusTimer = null;

    function start() {
      validateEventInfo(eventInfo);

      populateRegionSelect();

      selectedRegionId = resolveInitialRegion();
      elements.eventRegionSelect.value = selectedRegionId;

      renderTimeZoneNote();
      renderSchedule();
      updateStatus();

      elements.eventRegionSelect.addEventListener(
        "change",
        handleRegionChange,
      );

      startStatusTimer();
    }

    function populateRegionSelect() {
      elements.eventRegionSelect.replaceChildren();

      for (const [regionId, region] of Object.entries(eventInfo.regions)) {
        const option = document.createElement("option");

        option.value = regionId;
        option.textContent = region.label;

        elements.eventRegionSelect.append(option);
      }
    }

    function resolveInitialRegion() {
      const savedRegion = loadRegionPreference();

      if (isValidRegion(eventInfo, savedRegion)) {
        return savedRegion;
      }

      const inferredRegion = inferRegionFromTimeZone();

      if (isValidRegion(eventInfo, inferredRegion)) {
        return inferredRegion;
      }

      return eventInfo.defaultRegion;
    }

    function handleRegionChange(event) {
      const regionId = event.target.value;

      if (!isValidRegion(eventInfo, regionId)) {
        return;
      }

      selectedRegionId = regionId;

      saveRegionPreference(regionId);

      renderSchedule();
      updateStatus();
    }

    function renderSchedule() {
      const region = getRegion(eventInfo, selectedRegionId);

      const earnStart = parseUtcTimestamp(region.earnStart);
      const earnEnd = parseUtcTimestamp(region.earnEnd);
      const spendEnd = parseUtcTimestamp(region.spendEnd);

      elements.earnDateRange.textContent =
        `${dateTimeFormatter.format(earnStart)} to ` +
        `${dateTimeFormatter.format(earnEnd)}`;

      elements.spendDateRange.textContent =
        `Until ${dateTimeFormatter.format(spendEnd)}`;

      elements.officialEventLink.href = eventInfo.eventPageUrl;
    }

    function renderTimeZoneNote() {
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

      elements.eventTimeZoneText.textContent = timeZone
        ? `Times are shown in your local time (${timeZone}).`
        : "Times are shown in your local time.";
    }

    function updateStatus(now = new Date()) {
      elements.eventStatusText.textContent = getEventStatus(
        eventInfo,
        now,
        selectedRegionId,
      );
    }

    function startStatusTimer() {
      clearInterval(statusTimer);

      statusTimer = window.setInterval(
        () => updateStatus(),
        MINUTE_MS,
      );
    }

    return {
      start,
      updateStatus,
    };
  }

  function getEventStatus(
    eventInfo,
    now = new Date(),
    regionId = eventInfo.defaultRegion,
  ) {
    validateEventInfo(eventInfo);

    const region = getRegion(eventInfo, regionId);

    const earnStart = parseUtcTimestamp(region.earnStart);
    const earnEnd = parseUtcTimestamp(region.earnEnd);
    const spendEnd = parseUtcTimestamp(region.spendEnd);

    if (now < earnStart) {
      return describeCountdown(
        "Event starts",
        earnStart.getTime() - now.getTime(),
      );
    }

    if (now < earnEnd) {
      return describeCountdown(
        "Token earning ends",
        earnEnd.getTime() - now.getTime(),
      );
    }

    if (now < spendEnd) {
      return describeCountdown(
        "Spending ends",
        spendEnd.getTime() - now.getTime(),
      );
    }

    return `Event has concluded for ${region.label}`;
  }

  function describeCountdown(label, remainingMs) {
    if (remainingMs <= 0) {
      return label;
    }

    if (remainingMs < HOUR_MS) {
      const minutes = Math.max(
        1,
        Math.floor(remainingMs / MINUTE_MS),
      );

      return `${label} in ${formatUnit(minutes, "minute")}`;
    }

    if (remainingMs < DAY_MS) {
      const hours = Math.floor(remainingMs / HOUR_MS);
      const minutes = Math.floor(
        (remainingMs % HOUR_MS) / MINUTE_MS,
      );

      return `${label} in ${formatDuration([
        [hours, "hour"],
        [minutes, "minute"],
      ])}`;
    }

    if (remainingMs < DETAILED_COUNTDOWN_THRESHOLD_MS) {
      const days = Math.floor(remainingMs / DAY_MS);
      const hours = Math.floor(
        (remainingMs % DAY_MS) / HOUR_MS,
      );

      return `${label} in ${formatDuration([
        [days, "day"],
        [hours, "hour"],
      ])}`;
    }

    const days = Math.ceil(remainingMs / DAY_MS);

    return `${label} in ${formatUnit(days, "day")}`;
  }

  function formatDuration(parts) {
    return parts
      .filter(([value]) => value > 0)
      .map(([value, unit]) => formatUnit(value, unit))
      .join(", ");
  }

  function formatUnit(value, unit) {
    return `${value} ${unit}${value === 1 ? "" : "s"}`;
  }

  function inferRegionFromTimeZone() {
    const timeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

    if (
      timeZone.startsWith("America/") ||
      timeZone === "Pacific/Honolulu"
    ) {
      return "na";
    }

    if (
      timeZone.startsWith("Europe/") ||
      timeZone.startsWith("Africa/")
    ) {
      return "eu";
    }

    if (
      timeZone.startsWith("Asia/") ||
      timeZone.startsWith("Australia/") ||
      timeZone.startsWith("Indian/") ||
      timeZone.startsWith("Pacific/")
    ) {
      return "asia";
    }

    return null;
  }

  function loadRegionPreference() {
    try {
      return localStorage.getItem(REGION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function saveRegionPreference(regionId) {
    try {
      localStorage.setItem(
        REGION_STORAGE_KEY,
        regionId,
      );
    } catch {
      // The region still works for this visit when storage is unavailable.
    }
  }

  function getRegion(eventInfo, regionId) {
    const region = eventInfo.regions?.[regionId];

    if (!region) {
      throw new Error(`Unknown event region: ${regionId}`);
    }

    return region;
  }

  function isValidRegion(eventInfo, regionId) {
    return Boolean(
      regionId &&
      Object.prototype.hasOwnProperty.call(
        eventInfo.regions,
        regionId,
      ),
    );
  }

  function parseUtcTimestamp(value) {
    if (
      typeof value !== "string" ||
      !value.endsWith("Z")
    ) {
      throw new Error(
        `Event timestamp must be ISO 8601 UTC and end in Z: ${value}`,
      );
    }

    const timestamp = new Date(value);

    if (Number.isNaN(timestamp.getTime())) {
      throw new Error(`Invalid event timestamp: ${value}`);
    }

    return timestamp;
  }

  function validateEventInfo(eventInfo) {
    if (!eventInfo || typeof eventInfo !== "object") {
      throw new Error(
        "eventInfo is missing from HOLIDAY_CONVOY_CONFIG.",
      );
    }

    if (
      !eventInfo.regions ||
      typeof eventInfo.regions !== "object"
    ) {
      throw new Error(
        "eventInfo.regions is required.",
      );
    }

    if (!isValidRegion(eventInfo, eventInfo.defaultRegion)) {
      throw new Error(
        "eventInfo.defaultRegion must reference a configured region.",
      );
    }

    for (const [regionId, region] of Object.entries(
      eventInfo.regions,
    )) {
      if (!region.label) {
        throw new Error(
          `eventInfo.regions.${regionId}.label is required.`,
        );
      }

      const earnStart = parseUtcTimestamp(region.earnStart);
      const earnEnd = parseUtcTimestamp(region.earnEnd);
      const spendEnd = parseUtcTimestamp(region.spendEnd);

      if (earnEnd <= earnStart) {
        throw new Error(
          `${region.label} earnEnd must be after earnStart.`,
        );
      }

      if (spendEnd <= earnEnd) {
        throw new Error(
          `${region.label} spendEnd must be after earnEnd.`,
        );
      }
    }

    if (!eventInfo.eventPageUrl) {
      throw new Error(
        "eventPageUrl is required in eventInfo.",
      );
    }
  }

  app.aboutUI = {
    create,
    getEventStatus,
    inferRegionFromTimeZone,
    parseUtcTimestamp,
    validateEventInfo,
  };
})();