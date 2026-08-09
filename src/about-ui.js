(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function create({ config, elements }) {
    const eventInfo = config.eventInfo;
    let midnightTimer = null;

    function start() {
      validateEventInfo(eventInfo);
      renderSchedule();
      updateStatus();
      scheduleNextMidnightUpdate();
    }

    function renderSchedule() {
      const earnStart = parseLocalDate(eventInfo.earnStartDate);
      const earnEnd = parseLocalDate(eventInfo.earnEndDate);
      const spendEnd = parseLocalDate(eventInfo.spendEndDate);

      elements.earnDateRange.textContent =
        `${dateFormatter.format(earnStart)} to ${dateFormatter.format(earnEnd)}`;
      elements.spendDateRange.textContent =
        `Until ${dateFormatter.format(spendEnd)}`;
      elements.officialEventLink.href = eventInfo.eventPageUrl;
    }

    function updateStatus(now = new Date()) {
      elements.eventStatusText.textContent = getEventStatus(eventInfo, now);
    }

    function scheduleNextMidnightUpdate() {
      clearTimeout(midnightTimer);

      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2,
      );

      midnightTimer = window.setTimeout(() => {
        updateStatus();
        scheduleNextMidnightUpdate();
      }, nextMidnight.getTime() - now.getTime());
    }

    return { start, updateStatus };
  }

  function getEventStatus(eventInfo, now = new Date()) {
    validateEventInfo(eventInfo);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const earnStart = parseLocalDate(eventInfo.earnStartDate);
    const earnEnd = parseLocalDate(eventInfo.earnEndDate);
    const spendEnd = parseLocalDate(eventInfo.spendEndDate);

    if (today < earnStart) {
      return describeCountdown("Event starts", daysBetween(today, earnStart));
    }

    if (today <= earnEnd) {
      return describeCountdown(
        "Token earning ends",
        daysBetween(today, earnEnd),
      );
    }

    if (today <= spendEnd) {
      return describeCountdown("Spending ends", daysBetween(today, spendEnd));
    }

    return "Event has ended";
  }

  function describeCountdown(label, days) {
    if (days <= 0) {
      return `${label} today`;
    }
    if (days === 1) {
      return `${label} tomorrow`;
    }
    return `${label} in ${days} days`;
  }

  function daysBetween(fromDate, toDate) {
    return Math.round((toDayNumber(toDate) - toDayNumber(fromDate)) / DAY_MS);
  }

  function toDayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) {
      throw new Error(`Invalid event date: ${value}`);
    }

    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    ) {
      throw new Error(`Invalid event date: ${value}`);
    }

    return date;
  }

  function validateEventInfo(eventInfo) {
    if (!eventInfo || typeof eventInfo !== "object") {
      throw new Error("eventInfo is missing from HOLIDAY_CONVOY_CONFIG.");
    }

    const earnStart = parseLocalDate(eventInfo.earnStartDate);
    const earnEnd = parseLocalDate(eventInfo.earnEndDate);
    const spendEnd = parseLocalDate(eventInfo.spendEndDate);

    if (earnEnd < earnStart) {
      throw new Error("earnEndDate cannot be before earnStartDate.");
    }
    if (spendEnd < earnEnd) {
      throw new Error("spendEndDate cannot be before earnEndDate.");
    }
    if (!eventInfo.eventPageUrl) {
      throw new Error("eventPageUrl is required in eventInfo.");
    }
  }

  app.aboutUI = {
    create,
    getEventStatus,
    parseLocalDate,
    validateEventInfo,
  };
})();
