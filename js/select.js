function encodePlaylist(items) {
  const bytes = new TextEncoder().encode(JSON.stringify(items));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function buildVideoUrl(playlist, index, playMode) {
  const item = playlist.items[index];
  const params = new URLSearchParams({
    bili_playlist: "1",
    playlist_id: playlist.id,
    playlist_name: playlist.name,
    play_mode: playMode,
    index: String(index),
    list: encodePlaylist(playlist.items)
  });
  const query = item.page ? `?p=${item.page}` : "";
  return `https://www.bilibili.com/video/${item.bvid}/${query}#${params.toString()}`;
}

function createPlaylistCard(playlist, cardIndex, playMode) {
  const card = document.createElement("section");
  card.className = "playlist-card playlist-card--collapsible";

  const top = document.createElement("div");
  top.className = "playlist-card__top";

  const icon = document.createElement("span");
  icon.className = "panel__icon";
  icon.textContent = "♪";

  const heading = document.createElement("div");
  heading.className = "playlist-card__heading";

  const name = document.createElement("h2");
  name.textContent = playlist.name;

  const count = document.createElement("p");
  count.textContent = `${playlist.items.length} 个视频`;
  heading.append(name, count);

  const actions = document.createElement("div");
  actions.className = "playlist-card__actions";

  const listId = `playlist-preview-${cardIndex}`;
  const toggle = document.createElement("button");
  toggle.className = "secondary-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", listId);
  toggle.innerHTML =
    '<span class="secondary-button__label">展开列表</span>' +
    '<span class="secondary-button__chevron" aria-hidden="true">⌄</span>';

  actions.append(toggle);
  if (playlist.items.length) {
    const enter = document.createElement("a");
    enter.className = "primary-button";
    enter.href = buildVideoUrl(playlist, 0, playMode);
    enter.target = "_blank";
    enter.rel = "noreferrer";
    enter.textContent = "打开播放列表";
    actions.append(enter);
  } else {
    const emptyButton = document.createElement("span");
    emptyButton.className = "primary-button is-disabled";
    emptyButton.textContent = "播放列表为空";
    actions.append(emptyButton);
  }

  top.append(icon, heading, actions);

  const preview = document.createElement("ol");
  preview.id = listId;
  preview.className = "video-list";
  preview.hidden = true;

  for (const [index, item] of playlist.items.entries()) {
    const row = document.createElement("li");
    row.className = "video-row";

    const link = document.createElement("a");
    link.className = "video-row__link";
    link.href = buildVideoUrl(playlist, index, playMode);
    link.target = "_blank";
    link.rel = "noreferrer";

    const order = document.createElement("span");
    order.className = "video-row__order";
    order.textContent = String(index + 1).padStart(2, "0");

    const info = document.createElement("span");
    info.className = "video-row__info";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const bvid = document.createElement("small");
    bvid.textContent = item.page ? `${item.bvid} · P${item.page}` : item.bvid;

    info.append(title, bvid);
    link.append(order, info);
    row.append(link);
    preview.append(row);
  }

  if (!playlist.items.length) {
    const empty = document.createElement("li");
    empty.className = "playlist-card__empty";
    empty.textContent = "这个播放列表还没有视频。";
    preview.append(empty);
  }

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.querySelector(".secondary-button__label").textContent =
      expanded ? "展开列表" : "收起列表";
    preview.hidden = expanded;
    card.classList.toggle("is-expanded", !expanded);
  });

  card.append(top, preview);
  return card;
}

async function renderPlaylists() {
  const playlists = await PlaylistStore.getPlaylists();
  const playModes = await Promise.all(
    playlists.map((playlist) => PlaylistStore.getPlayMode(playlist.id))
  );
  const container = document.querySelector("#select-playlists");
  container.replaceChildren();

  if (!playlists.length) {
    const empty = document.createElement("section");
    empty.className = "panel";
    empty.innerHTML =
      '<span class="panel__icon">♪</span>' +
      "<h2>还没有播放列表</h2>" +
      "<p>请先前往播放列表管理页面新建播放列表。</p>";
    container.append(empty);
    return;
  }

  playlists.forEach((playlist, index) => {
    container.append(createPlaylistCard(playlist, index, playModes[index]));
  });
}

renderPlaylists();
