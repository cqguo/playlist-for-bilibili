const addButton = document.querySelector("#add-current-video");
const description = document.querySelector("#add-current-video-description");
const message = document.querySelector("#popup-message");
let currentVideo = null;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  message.classList.add("is-visible");
}

function getVideoFromTab(tab) {
  if (!tab?.url) return null;

  try {
    const url = new URL(tab.url);
    if (url.hostname !== "www.bilibili.com") return null;
    const bvid = url.pathname.match(/^\/video\/(BV[\w]+)/i)?.[1];
    if (!bvid) return null;
    const page = Number(url.searchParams.get("p") || 1);

    const title = String(tab.title || bvid)
      .replace(/_哔哩哔哩_bilibili\s*$/i, "")
      .replace(/[-_]\s*哔哩哔哩\s*$/i, "")
      .trim();
    return {
      bvid,
      page: Number.isInteger(page) && page > 0 ? page : undefined,
      title: title || bvid
    };
  } catch {
    return null;
  }
}

async function initialize() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentVideo = getVideoFromTab(tab);
    if (currentVideo && tab?.id != null) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "get-current-video-title"
        });
        const nativeItemTitle = String(response?.title || "").trim();
        if (nativeItemTitle) currentVideo.title = nativeItemTitle;
      } catch {
        // The page may predate the latest content script; keep the tab title fallback.
      }
    }
  } catch {
    currentVideo = null;
  }

  if (!currentVideo) {
    addButton.disabled = true;
    description.textContent = "请先打开一个 B 站视频页面";
    return;
  }

  addButton.disabled = false;
  description.textContent = currentVideo.title;
}

addButton.addEventListener("click", async () => {
  if (!currentVideo) return;

  addButton.disabled = true;
  description.textContent = "正在添加…";

  try {
    const result = await PlaylistStore.addVideo(currentVideo);
    if (result.status === "exists") {
      showMessage("这个视频已经在默认歌单中了。");
    } else if (result.status === "updated") {
      showMessage("视频已在歌单中，名称已更新为当前列表项名称。");
    } else if (result.status === "full") {
      showMessage("默认歌单已达到 100 个视频的上限。", true);
    } else {
      showMessage(`已添加到默认歌单，共 ${result.playlist.items.length} 个视频。`);
    }
  } catch {
    showMessage("添加失败，请重新加载插件后再试。", true);
  } finally {
    addButton.disabled = false;
    description.textContent = currentVideo.title;
  }
});

initialize();
