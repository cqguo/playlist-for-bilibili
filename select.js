function encodePlaylist(items) {
  const bytes = new TextEncoder().encode(JSON.stringify(items));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function buildVideoUrl(playlist, index) {
  const params = new URLSearchParams({
    bili_playlist: "1",
    playlist_name: playlist.name,
    index: String(index),
    list: encodePlaylist(playlist.items)
  });
  return `https://www.bilibili.com/video/${playlist.items[index].bvid}/#${params.toString()}`;
}

const playlist = globalThis.DEFAULT_PLAYLIST;
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
  bvid.textContent = item.bvid;

  info.append(title, bvid);
  link.append(order, info);
  row.append(link);
  preview.append(row);
}
