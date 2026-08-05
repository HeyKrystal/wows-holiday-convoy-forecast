(() => {
  "use strict";

  const app = window.HolidayConvoy;

  function createImage(url, className = "") {
    if (!url) {
      return null;
    }

    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    if (className) {
      image.className = className;
    }
    return image;
  }

  function createTypeIcon(ship, className = "") {
    const images = ship?.type?.images ?? {};
    const icon = document.createElement("span");
    icon.className = ["ship-type-icon", className].filter(Boolean).join(" ");
    icon.setAttribute("aria-hidden", "true");

    if (ship?.special && images.premium && images.default) {
      const goldWreathLayer = createImage(
        images.premium,
        "ship-type-icon-layer ship-type-icon-wreath-layer",
      );
      const silverShipLayer = createImage(
        images.default,
        "ship-type-icon-layer ship-type-icon-ship-layer",
      );

      icon.dataset.composite = "special";
      icon.append(goldWreathLayer, silverShipLayer);
      return icon;
    }

    const imageUrl = ship?.special
      ? images.special ?? images.default ?? images.premium
      : ship?.premium
        ? images.premium ?? images.default
        : images.default;

    const image = createImage(imageUrl, "ship-type-icon-layer");
    if (!image) {
      return null;
    }

    icon.append(image);
    return icon;
  }

  function createNationFlag(ship, className = "") {
    const imageUrl =
      ship?.nation?.images?.tiny ??
      ship?.nation?.images?.small ??
      ship?.nation?.image ??
      null;

    const image = createImage(
      imageUrl,
      ["ship-nation-flag", className].filter(Boolean).join(" "),
    );
    if (image && ship?.nation?.label) {
      image.title = ship.nation.label;
    }
    return image;
  }

  app.shipIcons = {
    createNationFlag,
    createTypeIcon,
  };
})();
