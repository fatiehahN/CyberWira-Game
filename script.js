const gameFrame = document.getElementById("cyberwira-game");
const gameFrameWrap = document.getElementById("game-frame-wrap");
const gamePlaceholder = document.getElementById("game-placeholder");
const fullscreenButton = document.getElementById("fullscreen-button");
const reloadButton = document.getElementById("reload-button");
const currentYear = document.getElementById("current-year");

currentYear.textContent = new Date().getFullYear();

// Show the setup message until a real itch.io embed URL has been added.
const embedUrl = gameFrame.getAttribute("src");
if (embedUrl && !embedUrl.includes("PASTE_YOUR_ITCH_EMBED_URL_HERE")) {
  gamePlaceholder.hidden = true;
} else {
  gameFrame.style.visibility = "hidden";
}

fullscreenButton.addEventListener("click", async () => {
  try {
    // Target the wrapper container instead of the iframe directly
    if (gameFrameWrap.requestFullscreen) {
      await gameFrameWrap.requestFullscreen();
    } else if (gameFrameWrap.webkitRequestFullscreen) { /* Safari */
      await gameFrameWrap.webkitRequestFullscreen();
    } else if (gameFrameWrap.msRequestFullscreen) { /* IE11 */
      await gameFrameWrap.msRequestFullscreen();
    } else {
      alert("Fullscreen is not supported by this browser.");
    }
  } catch (error) {
    console.error("Could not enter fullscreen:", error);
    alert("Please use the fullscreen option inside the game if available.");
  }
});

reloadButton.addEventListener("click", () => {
  if (embedUrl && !embedUrl.includes("PASTE_YOUR_ITCH_EMBED_URL_HERE")) {
    gameFrame.src = embedUrl;
  } else {
    alert("Add your itch.io embed URL to index.html first.");
  }
});