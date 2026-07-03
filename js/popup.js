const addButton = document.querySelector("#add-current-video");
const description = document.querySelector("#add-current-video-description");
const message = document.querySelector("#popup-message");
const playlistPicker = document.querySelector("#playlist-picker");
const playlistPickerList = document.querySelector("#playlist-picker-list");
const closePlaylistPickerButton = document.querySelector("#close-playlist-picker");
const batchButton = document.querySelector("#add-video-batch");
const batchDescription = document.querySelector("#add-video-batch-description");
const batchPicker = document.querySelector("#batch-picker");
const batchPickerList = document.querySelector("#batch-picker-list");
const batchPickerSummary = document.querySelector("#batch-picker-summary");
const closeBatchPickerButton = document.querySelector("#close-batch-picker");
const batchSelectAll = document.querySelector("#batch-select-all");
const batchNextButton = document.querySelector("#batch-next");
let currentVideo = null;
let batchItems = [];
let playlists = [];
let pickerButtons = [];
let pendingBatchItems = null;

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

function normalizeBatchItems(items) {
  const normalized = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || !/^BV[\w]+$/i.test(item.bvid)) continue;
    const page =
      Number.isInteger(Number(item.page)) && Number(item.page) > 0
        ? Number(item.page)
        : undefined;
    const key = `${item.bvid.toLowerCase()}:${page || 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      bvid: item.bvid,
      page,
      title: String(item.title || item.bvid).trim().slice(0, 120)
    });
    if (normalized.length >= 2000) break;
  }
  return normalized;
}

function getEpisodeBatchItems(episode) {
  const bvid = episode?.bvid || episode?.arc?.bvid;
  if (!bvid) return [];
  const episodeTitle = String(
    episode.title || episode.arc?.title || episode.long_title || ""
  ).trim();
  const pages = Array.isArray(episode.pages) ? episode.pages : [];
  if (!pages.length) return [{ bvid, title: episodeTitle || bvid }];

  return pages.map((page, index) => {
    const partTitle = String(page.part || "").trim();
    return {
      bvid,
      page: Number(page.page) || index + 1,
      title:
        pages.length > 1 && episodeTitle && partTitle !== episodeTitle
          ? `${episodeTitle} · ${partTitle}`
          : episodeTitle || partTitle || bvid
    };
  });
}

async function getBatchItemsFromApi(bvid) {
  const response = await fetch(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`
  );
  if (!response.ok) return [];

  const payload = await response.json();
  const data = payload?.data;
  if (!data) return [];

  const sections = Array.isArray(data.ugc_season?.sections)
    ? data.ugc_season.sections
    : [];
  const currentSection = sections.find((section) =>
    section.episodes?.some(
      (episode) =>
        (episode.bvid || episode.arc?.bvid)?.toLowerCase() ===
        bvid.toLowerCase()
    )
  );
  const collectionItems = currentSection?.episodes?.flatMap(
    getEpisodeBatchItems
  );
  if (collectionItems?.length > 1) {
    return normalizeBatchItems(collectionItems);
  }

  return normalizeBatchItems(
    (Array.isArray(data.pages) ? data.pages : []).map((page, index) => ({
      bvid: data.bvid || bvid,
      page: Number(page.page) || index + 1,
      title: page.part
    }))
  );
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
    option.addEventListener("click", () => {
      if (pendingBatchItems) addBatchToPlaylist(playlist);
      else addToPlaylist(playlist);
    });
    playlistPickerList.append(option);
    pickerButtons.push(option);
  }
}

function closePlaylistPicker() {
  playlistPicker.hidden = true;
  addButton.setAttribute("aria-expanded", "false");
  if (batchPicker.hidden) document.body.classList.remove("is-picker-open");
}

function closeBatchPicker() {
  batchPicker.hidden = true;
  batchButton.setAttribute("aria-expanded", "false");
  if (playlistPicker.hidden) document.body.classList.remove("is-picker-open");
}

function getSelectedBatchItems() {
  const selectedKeys = new Set(
    [...batchPickerList.querySelectorAll("input:checked")].map(
      (input) => input.value
    )
  );
  return batchItems.filter((item) =>
    selectedKeys.has(`${item.bvid.toLowerCase()}:${item.page || 1}`)
  );
}

function updateBatchSelection() {
  const selectedCount = getSelectedBatchItems().length;
  const allSelected = selectedCount === batchItems.length && batchItems.length > 0;
  batchSelectAll.checked = allSelected;
  batchSelectAll.indeterminate = selectedCount > 0 && !allSelected;
  batchPickerSummary.textContent = selectedCount
    ? `已选择 ${selectedCount} / ${batchItems.length} 个条目`
    : `共 ${batchItems.length} 个条目，请至少选择一个`;
  batchNextButton.disabled = selectedCount === 0;
}

function renderBatchItems() {
  batchPickerList.replaceChildren();
  for (const item of batchItems) {
    const label = document.createElement("label");
    label.className = "popup__batch-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = `${item.bvid.toLowerCase()}:${item.page || 1}`;
    checkbox.addEventListener("change", updateBatchSelection);

    const content = document.createElement("span");
    content.className = "popup__batch-item-content";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("small");
    detail.textContent = item.page ? `${item.bvid} · P${item.page}` : item.bvid;
    content.append(title, detail);
    label.append(checkbox, content);
    batchPickerList.append(label);
  }
  updateBatchSelection();
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

  batchButton.hidden = batchItems.length < 2;
  if (batchItems.length >= 2) {
    batchButton.disabled = false;
    batchDescription.textContent = `可选择当前列表中的 ${batchItems.length} 个条目`;
  }
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
          type: "get-current-video-context"
        });
        const nativeItemTitle = String(response?.title || "").trim();
        if (nativeItemTitle) currentVideo.title = nativeItemTitle;
        if (Array.isArray(response?.items)) {
          batchItems = response.items.filter(
            (item) => item && /^BV[\w]+$/i.test(item.bvid)
          );
        }
      } catch {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: "get-current-video-title"
          });
          const nativeItemTitle = String(response?.title || "").trim();
          if (nativeItemTitle) currentVideo.title = nativeItemTitle;
        } catch {
          // The page may predate the content script; keep the tab title fallback.
        }
      }

      try {
        const apiItems = await getBatchItemsFromApi(currentVideo.bvid);
        batchItems = apiItems;
      } catch {
        // Keep the content-script result when the public API is unavailable.
      }
    }
  } catch {
    currentVideo = null;
  }

  updateAddButtonState();
}

addButton.addEventListener("click", () => {
  if (!currentVideo || !playlists.length) return;

  pendingBatchItems = null;
  closeBatchPicker();
  renderPlaylistOptions();
  playlistPicker.hidden = false;
  document.body.classList.add("is-picker-open");
  addButton.setAttribute("aria-expanded", "true");
  pickerButtons[0]?.focus();
});

batchButton.addEventListener("click", () => {
  if (batchItems.length < 2 || !playlists.length) return;

  pendingBatchItems = null;
  closePlaylistPicker();
  renderBatchItems();
  batchPicker.hidden = false;
  document.body.classList.add("is-picker-open");
  batchButton.setAttribute("aria-expanded", "true");
  batchPickerList.querySelector("input")?.focus();
});

closePlaylistPickerButton.addEventListener("click", () => {
  closePlaylistPicker();
  (pendingBatchItems ? batchButton : addButton).focus();
  pendingBatchItems = null;
});

closeBatchPickerButton.addEventListener("click", () => {
  closeBatchPicker();
  batchButton.focus();
});

batchSelectAll.addEventListener("change", () => {
  for (const checkbox of batchPickerList.querySelectorAll("input")) {
    checkbox.checked = batchSelectAll.checked;
  }
  updateBatchSelection();
});

batchNextButton.addEventListener("click", () => {
  const selectedItems = getSelectedBatchItems();
  if (!selectedItems.length) return;

  pendingBatchItems = selectedItems;
  closeBatchPicker();
  renderPlaylistOptions();
  playlistPicker.hidden = false;
  document.body.classList.add("is-picker-open");
  pickerButtons[0]?.focus();
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
      showMessage(`“${selectedPlaylist.name}”已达到 2000 个视频的上限。`, true);
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

async function addBatchToPlaylist(selectedPlaylist) {
  if (!pendingBatchItems?.length) return;

  const selectedItems = pendingBatchItems;
  pickerButtons.forEach((button) => {
    button.disabled = true;
  });
  closePlaylistPickerButton.disabled = true;
  batchDescription.textContent = `正在添加 ${selectedItems.length} 个条目…`;

  try {
    const result = await PlaylistStore.addVideos(
      selectedItems,
      selectedPlaylist.id
    );
    if (result.status === "no_playlist") {
      showMessage("所选播放列表已不存在，请重新打开插件。", true);
    } else {
      selectedPlaylist.items = result.playlist.items;
      renderPlaylistOptions();
      const details = [`新增 ${result.added} 个`];
      if (result.updated) details.push(`更新 ${result.updated} 个`);
      if (result.existing) details.push(`跳过重复 ${result.existing} 个`);
      if (result.full) details.push(`因达到上限未添加 ${result.full} 个`);
      showMessage(
        `已批量处理到“${selectedPlaylist.name}”：${details.join("，")}。`,
        result.full > 0
      );
    }
    closePlaylistPicker();
  } catch {
    showMessage("批量添加失败，请重新加载插件后再试。", true);
  } finally {
    pendingBatchItems = null;
    pickerButtons.forEach((button) => {
      button.disabled = false;
    });
    closePlaylistPickerButton.disabled = false;
    updateAddButtonState();
  }
}

initialize();
