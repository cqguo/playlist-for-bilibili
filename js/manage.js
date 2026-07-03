const playlistsContainer = document.querySelector("#manage-playlists");
const createPlaylistForm = document.querySelector("#create-playlist-form");
const newPlaylistName = document.querySelector("#new-playlist-name");
const manageMessage = document.querySelector("#manage-message");
const expandedPlaylistIds = new Set();

function showMessage(text, isError = false) {
  manageMessage.textContent = text;
  manageMessage.classList.toggle("is-error", isError);
  manageMessage.classList.add("is-visible");
}

function createSongRow(playlist, item, index) {
  const row = document.createElement("li");
  row.className = "video-row video-row--editable";

  const order = document.createElement("span");
  order.className = "video-row__order";
  order.textContent = String(index + 1).padStart(2, "0");

  const title = document.createElement("input");
  title.className = "video-row__title-input";
  title.type = "text";
  title.value = item.title;
  title.maxLength = 120;
  title.setAttribute("aria-label", `第 ${index + 1} 个视频的标题`);

  const actions = document.createElement("span");
  actions.className = "video-row__edit-actions";

  const confirmButton = document.createElement("button");
  confirmButton.className = "video-row__edit-button video-row__edit-button--confirm";
  confirmButton.type = "button";
  confirmButton.textContent = "✓";
  confirmButton.title = "确认修改";
  confirmButton.setAttribute("aria-label", `确认修改第 ${index + 1} 个视频的标题`);

  const cancelButton = document.createElement("button");
  cancelButton.className = "video-row__edit-button video-row__edit-button--cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "×";
  cancelButton.title = "取消修改";
  cancelButton.setAttribute("aria-label", `取消修改第 ${index + 1} 个视频的标题`);

  actions.append(confirmButton, cancelButton);

  const deleteButton = document.createElement("button");
  deleteButton.className = "video-row__delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "删除";
  deleteButton.title = "删除视频";
  deleteButton.setAttribute("aria-label", `删除第 ${index + 1} 个视频：${item.title}`);

  let savedTitle = item.title;

  const saveTitle = async () => {
    const nextTitle = title.value.trim();
    if (!nextTitle) {
      title.value = savedTitle;
      title.focus();
      return false;
    }
    if (nextTitle === savedTitle) {
      title.value = nextTitle;
      row.classList.remove("is-editing");
      title.blur();
      return true;
    }

    title.disabled = true;
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    item.title = nextTitle;
    try {
      await PlaylistStore.savePlaylist(playlist);
      savedTitle = nextTitle;
      title.value = nextTitle;
      deleteButton.setAttribute("aria-label", `删除第 ${index + 1} 个视频：${nextTitle}`);
      row.classList.remove("is-editing");
      title.blur();
      return true;
    } catch (error) {
      item.title = savedTitle;
      title.value = savedTitle;
      showMessage("视频标题保存失败，请重试。", true);
      console.error("保存视频标题失败", error);
      return false;
    } finally {
      title.disabled = false;
      confirmButton.disabled = false;
      cancelButton.disabled = false;
    }
  };

  const cancelEdit = () => {
    title.value = savedTitle;
    row.classList.remove("is-editing");
    title.blur();
  };

  title.addEventListener("focus", () => row.classList.add("is-editing"));
  title.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveTitle();
    if (event.key === "Escape") cancelEdit();
  });
  confirmButton.addEventListener("click", saveTitle);
  cancelButton.addEventListener("click", cancelEdit);
  deleteButton.addEventListener("click", async () => {
    const shouldDelete = window.confirm(`确定要从“${playlist.name}”中删除《${savedTitle}》吗？`);
    if (!shouldDelete) return;

    const itemIndex = playlist.items.indexOf(item);
    if (itemIndex === -1) return;

    deleteButton.disabled = true;
    playlist.items.splice(itemIndex, 1);
    try {
      await PlaylistStore.savePlaylist(playlist);
      await renderPlaylists();
    } catch (error) {
      playlist.items.splice(itemIndex, 0, item);
      deleteButton.disabled = false;
      showMessage("视频删除失败，请重试。", true);
      console.error("删除视频失败", error);
    }
  });

  row.append(order, title, actions, deleteButton);
  return row;
}

function createPlaylistCard(playlist, index) {
  const isExpanded = expandedPlaylistIds.has(playlist.id);
  const card = document.createElement("section");
  card.className = `playlist-card playlist-card--collapsible${isExpanded ? " is-expanded" : ""}`;

  const top = document.createElement("div");
  top.className = "playlist-card__top";

  const icon = document.createElement("span");
  icon.className = "panel__icon";
  icon.textContent = "♪";

  const heading = document.createElement("div");
  heading.className = "playlist-card__heading";

  const name = document.createElement("h2");
  name.textContent = playlist.name;

  const meta = document.createElement("p");
  meta.textContent = `${playlist.items.length} 个视频 · 点击标题可修改`;
  heading.append(name, meta);

  const headerActions = document.createElement("div");
  headerActions.className = "playlist-card__actions";

  const listId = `manage-video-list-${index}`;
  const toggle = document.createElement("button");
  toggle.className = "secondary-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(isExpanded));
  toggle.setAttribute("aria-controls", listId);
  toggle.innerHTML =
    `<span class="secondary-button__label">${isExpanded ? "收起列表" : "展开列表"}</span>` +
    '<span class="secondary-button__chevron" aria-hidden="true">⌄</span>';

  const deletePlaylistButton = document.createElement("button");
  deletePlaylistButton.className = "danger-button";
  deletePlaylistButton.type = "button";
  deletePlaylistButton.textContent = "删除播放列表";
  deletePlaylistButton.setAttribute("aria-label", `删除播放列表：${playlist.name}`);

  headerActions.append(toggle, deletePlaylistButton);
  top.append(icon, heading, headerActions);

  const list = document.createElement("ol");
  list.id = listId;
  list.className = "video-list video-list--editable";
  list.hidden = !isExpanded;
  for (const [itemIndex, item] of playlist.items.entries()) {
    list.append(createSongRow(playlist, item, itemIndex));
  }
  if (!playlist.items.length) {
    const empty = document.createElement("li");
    empty.className = "playlist-card__empty";
    empty.textContent = "播放列表还是空的，可从 B 站视频页面添加视频。";
    list.append(empty);
  }

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.querySelector(".secondary-button__label").textContent =
      expanded ? "展开列表" : "收起列表";
    list.hidden = expanded;
    card.classList.toggle("is-expanded", !expanded);
    if (expanded) expandedPlaylistIds.delete(playlist.id);
    else expandedPlaylistIds.add(playlist.id);
  });

  deletePlaylistButton.addEventListener("click", async () => {
    const detail = playlist.items.length
      ? `其中的 ${playlist.items.length} 个视频也会一并删除。`
      : "此操作无法撤销。";
    const shouldDelete = window.confirm(`确定要删除播放列表“${playlist.name}”吗？${detail}`);
    if (!shouldDelete) return;

    deletePlaylistButton.disabled = true;
    try {
      await PlaylistStore.deletePlaylist(playlist.id);
      expandedPlaylistIds.delete(playlist.id);
      showMessage(`已删除播放列表“${playlist.name}”。`);
      await renderPlaylists();
    } catch (error) {
      deletePlaylistButton.disabled = false;
      showMessage("播放列表删除失败，请重试。", true);
      console.error("删除播放列表失败", error);
    }
  });

  card.append(top, list);
  return card;
}

async function renderPlaylists() {
  const playlists = await PlaylistStore.getPlaylists();
  playlistsContainer.replaceChildren();

  if (!playlists.length) {
    const empty = document.createElement("section");
    empty.className = "panel";
    empty.innerHTML =
      '<span class="panel__icon">♪</span>' +
      "<h2>还没有播放列表</h2>" +
      "<p>在上方输入名称，创建你的第一个播放列表。</p>";
    playlistsContainer.append(empty);
    return;
  }

  playlists.forEach((playlist, index) => {
    playlistsContainer.append(createPlaylistCard(playlist, index));
  });
}

createPlaylistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = newPlaylistName.value.trim();
  if (!name) {
    newPlaylistName.focus();
    return;
  }

  const submitButton = createPlaylistForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const result = await PlaylistStore.addPlaylist(name);
    newPlaylistName.value = "";
    expandedPlaylistIds.add(result.playlist.id);
    showMessage(`已创建播放列表“${result.playlist.name}”。`);
    await renderPlaylists();
  } catch (error) {
    showMessage("播放列表创建失败，请重试。", true);
    console.error("创建播放列表失败", error);
  } finally {
    submitButton.disabled = false;
  }
});

renderPlaylists().catch((error) => {
  showMessage("播放列表读取失败，请重新加载页面。", true);
  console.error("读取播放列表失败", error);
});
