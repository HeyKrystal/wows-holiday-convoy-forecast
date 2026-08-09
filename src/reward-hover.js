(() => {
  "use strict";

  const app = window.HolidayConvoy;
  const { createNationFlag, createTypeIcon } = app.shipIcons;

  const RATING_LABELS = {
    survivability: "Survivability",
    artillery: "Artillery",
    torpedoes: "Torpedoes",
    antiAircraft: "AA Defense",
    maneuverability: "Maneuverability",
    concealment: "Concealment",
    aircraft: "Aircraft",
  };

  function tierToRoman(tier) {
    const values = [
      [10, "X"],
      [9, "IX"],
      [8, "VIII"],
      [7, "VII"],
      [6, "VI"],
      [5, "V"],
      [4, "IV"],
      [3, "III"],
      [2, "II"],
      [1, "I"],
    ];
    return values.find(([value]) => Number(tier) === value)?.[1] ?? String(tier ?? "");
  }

  function rarityLabel(rarity) {
    return rarity
      ? `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`
      : "Ship";
  }

  function pointerPointFrom(event) {
    if (
      typeof event?.clientX !== "number" ||
      typeof event?.clientY !== "number"
    ) {
      return null;
    }

    if (event.type === "click" && event.detail === 0) {
      return null;
    }

    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function create({ config, body, shipCatalog }) {
    const popover = createPopover();
    document.body.append(popover);

    let activeTrigger = null;
    let activeRewardId = null;
    let pointerPoint = null;
    let pinned = false;
    let requestNumber = 0;

    function createPopover() {
      const element = document.createElement("section");
      element.className = "ship-hover-card";
      element.id = "shipHoverCard";
      element.hidden = true;
      element.dataset.pinned = "false";
      element.setAttribute("role", "tooltip");
      element.setAttribute("aria-label", "Ship details");
      return element;
    }

    function bind() {
      body.addEventListener("pointerover", handlePointerOver);
      body.addEventListener("pointermove", handlePointerMove);
      body.addEventListener("pointerout", handlePointerOut);
      body.addEventListener("focusin", handleFocusIn);
      body.addEventListener("focusout", handleFocusOut);
      body.addEventListener("click", handleClick);
      document.addEventListener("click", handleDocumentClick);
      document.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", position);
      window.addEventListener("scroll", handleScroll, true);
    }

    function findTrigger(target) {
      return target.closest?.(".reward-ship-trigger") ?? null;
    }

    function rewardFor(trigger) {
      return config.rewards.find(
        (reward) => reward.id === trigger?.dataset.rewardId,
      );
    }

    function handlePointerOver(event) {
      const trigger = findTrigger(event.target);
      if (!trigger || trigger.contains(event.relatedTarget) || pinned) {
        return;
      }
      show(trigger, false, pointerPointFrom(event));
    }

    function handlePointerMove(event) {
      if (
        pinned ||
        popover.hidden ||
        !activeTrigger ||
        !activeTrigger.contains(event.target)
      ) {
        return;
      }

      pointerPoint = pointerPointFrom(event);
      position();
    }

    function handlePointerOut(event) {
      const trigger = findTrigger(event.target);
      if (!trigger || trigger.contains(event.relatedTarget) || pinned) {
        return;
      }
      close();
    }

    function handleFocusIn(event) {
      const trigger = findTrigger(event.target);
      if (trigger && !pinned) {
        show(trigger, false, null);
      }
    }

    function handleFocusOut(event) {
      const trigger = findTrigger(event.target);
      if (!trigger || pinned) {
        return;
      }
      close();
    }

    function handleClick(event) {
      const trigger = findTrigger(event.target);
      if (!trigger) {
        return;
      }

      event.preventDefault();
      if (activeTrigger === trigger && pinned) {
        close();
        return;
      }

      show(trigger, true, pointerPointFrom(event));
    }

    function handleDocumentClick(event) {
      if (
        pinned &&
        !popover.hidden &&
        !popover.contains(event.target) &&
        !findTrigger(event.target)
      ) {
        close();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !popover.hidden) {
        const trigger = activeTrigger;
        close();
        trigger?.focus();
      }
    }

    function handleScroll() {
      if (popover.hidden) {
        return;
      }

      if (!pinned) {
        close();
        return;
      }

      position();
    }

    async function show(trigger, shouldPin, nextPointerPoint) {
      const reward = rewardFor(trigger);
      if (!reward) {
        return;
      }

      if (activeTrigger && activeTrigger !== trigger) {
        activeTrigger.setAttribute("aria-expanded", "false");
      }

      const keepPinned = activeTrigger === trigger && pinned;
      activeTrigger = trigger;
      activeRewardId = reward.id;
      pinned = shouldPin || keepPinned;
      pointerPoint = nextPointerPoint;

      trigger.setAttribute("aria-expanded", "true");
      popover.hidden = false;
      popover.dataset.pinned = String(pinned);
      popover.dataset.rarity = reward.rarity ?? "common";
      popover.setAttribute("role", pinned ? "dialog" : "tooltip");

      renderLoading(reward);
      position();

      const currentRequest = ++requestNumber;
      if (!reward.shipId) {
        renderUnavailable(reward, "Full ship details will be added after the ship is revealed.");
        position();
        return;
      }

      try {
        await shipCatalog.load();
        if (currentRequest !== requestNumber || activeRewardId !== reward.id) {
          return;
        }
        const ship = shipCatalog.get(reward.shipId);
        if (ship) {
          renderShip(reward, ship);
        } else {
          renderUnavailable(
            reward,
            "This ship is not present in the latest shared dataset yet.",
          );
        }
      } catch {
        if (currentRequest !== requestNumber || activeRewardId !== reward.id) {
          return;
        }
        renderUnavailable(
          reward,
          "Ship details are temporarily unavailable. The planner still works normally.",
        );
      }
      position();
    }

    function close() {
      requestNumber += 1;
      activeTrigger?.setAttribute("aria-expanded", "false");
      activeTrigger = null;
      activeRewardId = null;
      pointerPoint = null;
      pinned = false;
      popover.hidden = true;
      popover.dataset.pinned = "false";
      popover.replaceChildren();
    }

    function renderLoading(reward) {
      popover.replaceChildren(
        createCardHeader(reward, null),
        createMessage("Loading ship details…"),
        createAvailability(reward),
      );
    }

    function renderUnavailable(reward, message) {
      popover.replaceChildren(
        createCardHeader(reward, null),
        createMessage(message),
        createAvailability(reward),
      );
    }

    function renderShip(reward, ship) {
      const fragment = document.createDocumentFragment();
      fragment.append(createCardHeader(reward, ship));

      const imageUrl = ship.images?.large ?? ship.images?.medium ?? ship.images?.small;
      if (imageUrl) {
        const imageFrame = document.createElement("div");
        imageFrame.className = "ship-hover-image-frame";
        const image = document.createElement("img");
        image.className = "ship-hover-image";
        image.src = imageUrl;
        image.alt = "";
        image.loading = "lazy";
        imageFrame.append(image);
        fragment.append(imageFrame);
      }

      if (ship.description) {
        const description = document.createElement("p");
        description.className = "ship-hover-description";
        description.tabIndex = pinned ? 0 : -1;
        description.setAttribute("aria-label", "Ship description");
        description.textContent = ship.description;
        fragment.append(description);
      }

      const ratings = createRatings(ship.ratings);
      if (ratings) {
        fragment.append(ratings);
      }

      fragment.append(createAvailability(reward));
      popover.replaceChildren(fragment);
    }

    function createCardHeader(reward, ship) {
      const header = document.createElement("header");
      header.className = "ship-hover-header";

      const titleBlock = document.createElement("div");
      const rarity = document.createElement("span");
      rarity.className = "ship-hover-rarity";
      rarity.textContent = rarityLabel(reward.rarity);

      const title = document.createElement("h3");
      title.textContent = ship?.name ?? reward.name;
      titleBlock.append(rarity, title);

      if (ship) {
        const metadata = document.createElement("p");
        metadata.className = "ship-hover-metadata";

        const nationFlag = createNationFlag(ship, "ship-hover-nation-flag");
        if (nationFlag) {
          metadata.append(nationFlag);
        }

        const typeIcon = createTypeIcon(ship, "ship-hover-type-icon");
        if (typeIcon) {
          metadata.append(typeIcon);
        }

        const tier = tierToRoman(ship.tier);
        metadata.append(
          document.createTextNode(
            [`Tier ${tier}`, ship.type?.label]
              .filter(Boolean)
              .join(" "),
          ),
        );
        titleBlock.append(metadata);
      }

      const closeButton = document.createElement("button");
      closeButton.className = "ship-hover-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close ship details");
      closeButton.textContent = "×";
      closeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        close();
      });

      header.append(titleBlock, closeButton);
      return header;
    }

    function createRatings(ratings = {}) {
      const entries = Object.entries(RATING_LABELS)
        .map(([key, label]) => [label, Number(ratings[key])])
        .filter(([, value]) => Number.isFinite(value) && value > 0)
        .slice(0, 6);

      if (!entries.length) {
        return null;
      }

      const section = document.createElement("section");
      section.className = "ship-hover-ratings";
      section.setAttribute("aria-label", "Ship ratings");

      for (const [label, rawValue] of entries) {
        const value = Math.max(0, Math.min(100, rawValue));
        const row = document.createElement("div");
        row.className = "ship-rating";

        const labelElement = document.createElement("span");
        labelElement.textContent = label;
        const valueElement = document.createElement("strong");
        valueElement.textContent = String(rawValue);

        const track = document.createElement("div");
        track.className = "ship-rating-track";
        const fill = document.createElement("div");
        fill.className = "ship-rating-fill";
        fill.style.width = `${value}%`;
        track.append(fill);

        row.append(labelElement, valueElement, track);
        section.append(row);
      }

      return section;
    }

    function createMessage(text) {
      const message = document.createElement("p");
      message.className = "ship-hover-message";
      message.textContent = text;
      return message;
    }

    function createAvailability(reward) {
      const footer = document.createElement("footer");
      footer.className = "ship-hover-footer";
      const label = document.createElement("span");
      label.textContent = "Availability";
      const value = document.createElement("strong");
      value.textContent = reward.availability || "Not specified";
      footer.append(label, value);
      return footer;
    }

    function position() {
      if (popover.hidden || !activeTrigger) {
        return;
      }

      if (window.matchMedia("(max-width: 640px)").matches) {
        popover.style.removeProperty("left");
        popover.style.removeProperty("top");
        return;
      }

      const cardRect = popover.getBoundingClientRect();
      const gap = 16;
      const margin = 12;
      let left;
      let top;

      if (pointerPoint) {
        left = pointerPoint.x + gap;
        top = pointerPoint.y + gap;

        if (left + cardRect.width > window.innerWidth - margin) {
          left = pointerPoint.x - cardRect.width - gap;
        }
        if (top + cardRect.height > window.innerHeight - margin) {
          top = pointerPoint.y - cardRect.height - gap;
        }
      } else {
        const triggerRect = activeTrigger.getBoundingClientRect();
        left = triggerRect.left;
        top = triggerRect.bottom + 10;

        if (left + cardRect.width > window.innerWidth - margin) {
          left = window.innerWidth - cardRect.width - margin;
        }
        if (top + cardRect.height > window.innerHeight - margin) {
          top = triggerRect.top - cardRect.height - 10;
        }
      }

      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - cardRect.width - margin),
      );
      top = Math.max(
        margin,
        Math.min(top, window.innerHeight - cardRect.height - margin),
      );

      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    }

    return { bind, close };
  }

  app.rewardHover = { create };
})();
