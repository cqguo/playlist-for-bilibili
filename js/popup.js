const addButton = document.querySelector("#add-current-video");
const description = document.querySelector("#add-current-video-description");
const message = document.querySelector("#popup-message");
const playlistPicker = document.querySelector("#playlist-picker");
const playlistPickerList = document.querySelector("#playlist-picker-list");
const closePlaylistPickerButton = document.querySelector("#close-playlist-picker");
let currentVideo = null;
let playlists = [];
let pickerButtons = [];

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

function renderPlaylistOptions() {
  playlistPickerList.replaceChildren();
  pickerButtons = [];

  for (const playlist of playlists) {
    const option = document.createElement("button");
    option.className = "popup__playlist-option";
    option.type = "button";

    const icon = document.createElement("span");
    icon.className = "popup__playlist-option-icon";
    icon.textContent = "♪";

    const content = document.createElement("span");
    content.className = "popup__playlist-option-content";

    const name = document.createElement("strong");
    name.textContent = playlist.name;

    const count = document.createElement("small");
    count.textContent = `${playlist.items.length} 个视频`;

    content.append(name, count);
    option.append(icon, content);
    option.addEventListener("click", () => addToPlaylist(playlist));
    playlistPickerList.append(option);
    pickerButtons.push(option);
  }
}

function closePlaylistPicker() {
  playlistPicker.hidden = true;
  document.body.classList.remove("is-picker-open");
  addButton.setAttribute("aria-expanded", "false");
}

function updateAddButtonState() {
  if (!playlists.length) {
    addButton.disabled = true;
    description.textContent = "请先在播放列表管理中创建播放列表";
    return;
  }
  if (!currentVideo) {
    addButton.disabled = true;
    description.textContent = "请先打开一个 B 站视频页面";
    return;
  }

  addButton.disabled = false;
  description.textContent = currentVideo.title;
}

async function initialize() {
  try {
    playlists = await PlaylistStore.getPlaylists();
  } catch {
    playlists = [];
    showMessage("播放列表读取失败，请重新加载插件后再试。", true);
  }
  renderPlaylistOptions();

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

  updateAddButtonState();
}

addButton.addEventListener("click", () => {
  if (!currentVideo || !playlists.length) return;

  playlistPicker.hidden = false;
  document.body.classList.add("is-picker-open");
  addButton.setAttribute("aria-expanded", "true");
  pickerButtons[0]?.focus();
});

closePlaylistPickerButton.addEventListener("click", () => {
  closePlaylistPicker();
  addButton.focus();
});

async function addToPlaylist(selectedPlaylist) {
  if (!currentVideo) return;

  pickerButtons.forEach((button) => {
    button.disabled = true;
  });
  closePlaylistPickerButton.disabled = true;
  description.textContent = "正在添加…";

  try {
    const result = await PlaylistStore.addVideo(currentVideo, selectedPlaylist.id);
    if (result.status === "exists") {
      showMessage(`这个视频已经在“${selectedPlaylist.name}”中了。`);
    } else if (result.status === "updated") {
      showMessage(`视频已在“${selectedPlaylist.name}”中，标题已更新。`);
    } else if (result.status === "full") {
      showMessage(`“${selectedPlaylist.name}”已达到 500 个视频的上限。`, true);
    } else if (result.status === "no_playlist") {
      showMessage("所选播放列表已不存在，请重新打开插件。", true);
    } else {
      selectedPlaylist.items = result.playlist.items;
      renderPlaylistOptions();
      showMessage(
        `已添加到“${selectedPlaylist.name}”，共 ${result.playlist.items.length} 个视频。`
      );
    }
    closePlaylistPicker();
  } catch {
    showMessage("添加失败，请重新加载插件后再试。", true);
  } finally {
    pickerButtons.forEach((button) => {
      button.disabled = false;
    });
    closePlaylistPickerButton.disabled = false;
    updateAddButtonState();
  }
}

initialize();
