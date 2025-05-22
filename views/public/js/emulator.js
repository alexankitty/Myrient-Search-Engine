// Check if   in a context that supports SharedArrayBuffer
const isHttps = window.location.protocol === "https:";
const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
const isCrossOriginIsolated = window.crossOriginIsolated === true;
const canUseThreads = hasSharedArrayBuffer && isCrossOriginIsolated;

// Display security warnings
const warningsDiv = document.getElementById("security-warnings");

if (!isHttps) {
  warningsDiv.innerHTML += `
    <div class="alert security-alert alert-danger py-2">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <strong>${emuStrings.warning.https.split(":")[0]}:</strong>
        ${emuStrings.warning.https.split(":")[1]}
    </div>
    `;
}

// Display important notice immediately
console.log(
  "%cAbout this Page",
  "font-size: 20px; font-weight: bold; color: #4CAF50;"
);
console.log(
  `%c ${emuStrings.console.about} \n` +
    `${emuStrings.console.disclaimer} \n` +
    `${emuStrings.console.more_info}`,
  "font-size: 14px; color: #90CAF9;"
);
console.log(
  `%c${window.location.origin}/about`,
  "font-size: 14px; color: #90CAF9;"
);

// Configure EmulatorJS
console.log("[Emulator] Starting emulator configuration");
console.log("[Emulator] System:", emulatorConfig.system);
console.log("[Emulator] Core:", emulatorConfig.core);

console.log("[Emulator] SharedArrayBuffer available:", hasSharedArrayBuffer);
console.log("[Emulator] Cross-Origin-Isolation status:", isCrossOriginIsolated);
console.log("[Emulator] Can use threads:", canUseThreads);

window.EJS_player = "#game";

window.EJS_core = emulatorConfig.core;
window.EJS_gameUrl = `/proxy-rom/${romFile.id}`;
window.EJS_pathtodata = "/emulatorjs/data/";
window.EJS_startOnLoaded = true;
window.EJS_gameID = 1;

// Using threads improves performance by a lot
// But also creates freezes, crashes and some emulators need to be reconfigured to work
// This should be revisited in the future.
// We're using threads only on PSP for now
window.EJS_threads =
  emulatorConfig.system === "Sony PlayStation Portable"
    ? navigator.hardwareConcurrency || 4
    : false;
window.EJS_gameName = romFile.filename.replace(/\.[^/.]+$/, "");
window.EJS_backgroundBlur = true;
window.EJS_defaultOptions = {
  "save-state-slot": 1,
  "save-state-location": "local",
};

// BIOS configuration
window.EJS_biosUrl = emulatorConfig.bios
  ? "/proxy-bios?url=" +
    encodeURIComponent(
      JSON.stringify(Object.values(emulatorConfig.bios.files)[0].url)
    )
  : undefined;

console.log("[Emulator] BIOS configuration:", window.EJS_biosUrl);

// Required for Sega CD ??
window.EJS_loadStateURL = window.location.href;
window.EJS_saveStateURL = window.location.href;
window.EJS_cheats = true;

// Add error event listener for the emulator
window.EJS_onGameStart = () => {
  console.log("[Emulator] Game started successfully");
};

window.EJS_onLoadState = (state) => {
  console.log("[Emulator] Load state:", state);
};

window.EJS_onSaveState = (state) => {
  console.log("[Emulator] Save state:", state);
};

window.EJS_onLoadError = (error) => {
  console.error("[Emulator] Load error:", error);
};

async function loadRom() {
  try {
    console.log("[Emulator] Starting ROM load process");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("download-progress");
    const progressText = document.getElementById("progress-text");
    progressContainer.style.display = "flex";
    const isCompressed = /\.(zip|7z)$/i.test(`${romFile.filename}`);
    const shouldUnpack = emulatorConfig.unpackRoms;
    console.log(
      `[Emulator] ROM compression status: ${
        isCompressed ? "compressed" : "uncompressed"
      }`
    );
    console.log(`[Emulator] Should unpack: ${shouldUnpack}`);

    progressText.textContent = `${emuStrings.loading.downloading} (0%)`;
    console.log("[Emulator] Initiating ROM download");

    const response = await fetch(EJS_gameUrl);
    if (!response.ok) {
      throw new Error(
        `${emuStrings.error.http_error}, { status: "response.status" })`.replace(
          "response.status",
          response.status
        )
      );
    }

    // If we're not unpacking, still show download progress but return direct URL
    if (!isCompressed || !shouldUnpack) {
      const contentLength = response.headers.get("content-length");
      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        const percent = Math.round((loaded / total) * 100);
        progressBar.style.width = percent + "%";
        progressText.textContent = `${emuStrings.loading.downloading} (${percent}%)`;
      }

      console.log("[Emulator] Using direct URL for ROM");
      progressContainer.style.display = "none";

      // Create blob from chunks for direct loading
      const blob = new Blob(chunks);
      return URL.createObjectURL(blob);
    }

    // For compressed files that need unpacking, continue with decompression
    const contentLength = response.headers.get("content-length");
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      const percent = Math.round((loaded / total) * 100);
      progressBar.style.width = percent + "%";
      progressText.textContent = `${emuStrings.loading.downloading} (${percent}%)`;
    }

    // Decompression phase
    progressText.textContent = `${emuStrings.loading.decompressing}`;
    console.log("[Emulator] Starting ZIP extraction");

    const blob = new Blob(chunks);
    const zip = await JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);
    console.log("[Emulator] ZIP contents:", files);

    const rom = files.find((f) => !zip.files[f].dir);
    if (!rom) {
      throw new Error(emuStrings.error.no_rom);
    }
    console.log("[Emulator] Found ROM file in ZIP:", romFile);

    const romData = await zip.files[rom].async("blob");
    console.log("[Emulator] ROM extraction complete");
    progressContainer.style.display = "none";
    return URL.createObjectURL(romData);
  } catch (error) {
    console.error("[Emulator] Error in loadRom:", error);
    throw error;
  }
}

loadRom()
  .then((romUrl) => {
    console.log("[Emulator] ROM loaded successfully, initializing EmulatorJS");
    window.EJS_gameUrl = romUrl;

    // We need to wait a moment to ensure cross-origin isolation is properly applied
    setTimeout(() => {
      const script = document.createElement("script");
      script.src = `${window.EJS_pathtodata}loader.js`;
      script.onerror = (error) => {
        const gameDiv = document.getElementById("game");
        gameDiv.innerHTML = `<div class="alert alert-danger">
            Failed to load EmulatorJS. Please refresh the page or try again later.
        </div>`;
      };
      document.body.appendChild(script);
    }, 500);
  })
  .catch((error) => {
    const gameDiv = document.getElementById("game");
    gameDiv.innerHTML = `<div class="alert alert-danger">
        ${emuStrings.error.loading}: ${error.message}
    </div>`;
  });
