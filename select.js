function encodePlaylist(items) {
  const bytes = new TextEncoder().encode(JSON.stringify(items));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function buildVideoUrl(playlist, index) {
  const item = playlist.items[index];
  const params = new URLSearchParams({
    bili_playlist: "1",
    playlist_name: playlist.name,
    play_mode: "loop",
    index: String(index),
    list: encodePlaylist(playlist.items)
  });
  const query = item.page ? `?p=${item.page}` : "";
  return `https://www.bilibili.com/video/${item.bvid}/${query}#${params.toString()}`;
}

function initializeCollapse() {
  const card = document.querySelector("#default-playlist-card");
  const toggle = document.querySelector("#toggle-playlist");
  const label = toggle.querySelector(".secondary-button__label");
  const preview = document.querySelector("#playlist-preview");

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    label.textContent = expanded ? "展开列表" : "收起列表";
    preview.hidden = expanded;
    card.classList.toggle("is-expanded", !expanded);
  });
}

async function renderPlaylist() {
  const playlist = await PlaylistStore.getPlaylist();
  const count = document.querySelector("#playlist-count");
  const preview = document.querySelector("#playlist-preview");
  const enter = document.querySelector("#enter-playlist");

  count.textContent = `${playlist.items.length} 个视频`;
  enter.href = buildVideoUrl(playlist, 0);
  enter.textContent = "打开默认歌单";

  for (const [index, item] of playlist.items.entries()) {
    const row = document.createElement("li");
    row.className = "video-row";

    const link = document.createElement("a");
    link.className = "video-row__link";
    link.href = buildVideoUrl(playlist, index);
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
}

initializeCollapse();
renderPlaylist();
