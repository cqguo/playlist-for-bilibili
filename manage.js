const playlist = globalThis.DEFAULT_PLAYLIST;

document.querySelector("#manage-playlist-name").textContent = playlist.name;
document.querySelector("#manage-playlist-meta").textContent =
  `${playlist.items.length} 个视频 · 内置歌单`;

const list = document.querySelector("#manage-video-list");
for (const [index, item] of playlist.items.entries()) {
  const row = document.createElement("li");
  row.className = "video-row";

  const order = document.createElement("span");
  order.className = "video-row__order";
  order.textContent = String(index + 1).padStart(2, "0");

  const info = document.createElement("span");
  info.className = "video-row__info";

  const title = document.createElement("strong");
  title.textContent = item.title;

  const bvid = document.createElement("small");
  bvid.textContent = item.bvid;

  info.append(title, bvid);
  row.append(order, info);
  list.append(row);
}
