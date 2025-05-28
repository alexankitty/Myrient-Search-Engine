// index.js
const videos = [];
const tag = document.createElement("script");
const firstScriptTag = document.getElementsByTagName("script")[0];

tag.src = "https://www.youtube.com/iframe_api";
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// YouTube wants this function, don't rename it
function onYouTubeIframeAPIReady() {
  const slides = Array.from(document.querySelectorAll(".carousel-item"));
  slides.forEach((slide, index) => {
    // does this slide have a video?
    const video = slide.querySelector(".video-player");
    if (video && video.dataset) {
      const player = createPlayer({
        id: video.id,
        videoId: video.dataset.videoId,
      });
      videos.push({ player, index });
    }
  });
}

function createPlayer(playerInfo) {
  return new YT.Player(playerInfo.id, {
    videoId: playerInfo.videoId,
    playerVars: {
      showinfo: 0,
    },
  });
}