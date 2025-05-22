function showEmulators(consoleName) {
  const modalTitle = document.getElementById("emulatorModalLabel");
  const emulatorList = document.getElementById("emulatorList");
  const consoleData = emulators[consoleName]

  modalTitle.innerHTML = `<i class="fas fa-gamepad mr-2 text-warning"></i>${recommended} | ${consoleName}`;
  emulatorList.innerHTML = "";

  // Create console icon at the top of the modal
  const consoleIconContainer = document.createElement("div");
  consoleIconContainer.className = "text-center mb-4";
  consoleIconContainer.innerHTML = `
        <img src="/proxy-image?url=${encodeURIComponent(
          consoleData.icon
        )}" alt="${consoleName}" style="max-height: 80px;">
        <h4 class="mt-3 text-warning">${consoleName}</h4>
        <div class="separator my-3"><span></span></div>
      `;
  emulatorList.appendChild(consoleIconContainer);

  Object.entries(consoleData.emulators).forEach(
    ([emulatorName, emulatorData]) => {
      const emulatorCard = document.createElement("div");
      emulatorCard.className = "emulator-card";

      let platformsHtml = "";
      emulatorData.platforms.forEach((platform) => {
        let iconClass = "";
        switch (platform.toLowerCase()) {
          case "windows":
            iconClass = "fab fa-windows";
            break;
          case "linux":
            iconClass = "fab fa-linux";
            break;
          case "macos":
            iconClass = "fab fa-apple";
            break;
          case "android":
            iconClass = "fab fa-android";
            break;
          case "ios":
            iconClass = "fab fa-app-store-ios";
            break;
          default:
            iconClass = "fas fa-desktop";
        }
        platformsHtml += `<span class="platform-badge"><i class="${iconClass} mr-2"></i>${platform}</span>`;
      });

      emulatorCard.innerHTML = `
          <div class="emulator-header">
            <h5>${emulatorName}</h5>
          </div>
          <div class="emulator-body">
            <div class="row">
              <div class="col-md-4">
                <div class="emulator-logo-container">
                  <img src="/proxy-image?url=${encodeURIComponent(
                    emulatorData.logo
                  )}" alt="${emulatorName}" class="emulator-logo">
                </div>
              </div>
              <div class="col-md-8">
                <div class="emulator-description">${
                  emulatorData.description
                }</div>
                <div class="platform-badges">
                  ${platformsHtml}
                </div>
                <a href="${
                  emulatorData.url
                }" target="_blank" class="btn download-btn">
                  <i class="fas fa-download mr-2"></i>${download}
                </a>
              </div>
            </div>
          </div>
        `;

      emulatorList.appendChild(emulatorCard);
    }
  );

  // Show the modal
  $("#emulatorModal").modal("show");
}
